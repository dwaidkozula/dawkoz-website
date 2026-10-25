(() => {
  'use strict';

  const wrapper = document.querySelector('[data-offer-carousel]');
  const track = wrapper?.querySelector('#offer-track');
  if (!track) return;

  const cards = [...track.children].filter(node => node.tagName === 'ARTICLE');
  if (!cards.length) return;

  const previous = wrapper.querySelector('[data-offer-prev]');
  const next = wrapper.querySelector('[data-offer-next]');
  const more = wrapper.querySelector('[data-offer-more]');
  const range = wrapper.querySelector('[data-offer-range]');
  const progress = wrapper.querySelector('[data-offer-progress]');
  let labels = {};
  try { labels = JSON.parse(document.documentElement.dataset.ui || '{}'); } catch { /* Polish labels remain available. */ }
  const label = (key, fallback) => labels[key] || fallback;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const extrasIndex = Math.max(0, cards.findIndex(card => card.id === 'offer-website'));
  const number = new Intl.NumberFormat(document.documentElement.lang || 'pl', { useGrouping: false });
  let frame = 0;
  let activeIndex = 0;
  let previousWidth = track.clientWidth;

  function viewport() {
    const box = track.getBoundingClientRect();
    const style = window.getComputedStyle(track);
    const left = box.left + track.clientLeft + (parseFloat(style.paddingLeft) || 0);
    const right = box.left + track.clientLeft + track.clientWidth - (parseFloat(style.paddingRight) || 0);
    return { left, right, width: Math.max(1, right - left) };
  }

  function maximum() {
    return Math.max(0, track.scrollWidth - track.clientWidth);
  }

  function position(index) {
    return Math.min(maximum(), Math.max(0, track.scrollLeft + cards[index].getBoundingClientRect().left - viewport().left));
  }

  function visibleCards() {
    const view = viewport();
    const visible = [];
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    let largestIntersection = -1;
    let largestIndex = 0;
    cards.forEach((card, index) => {
      const box = card.getBoundingClientRect();
      const intersection = Math.max(0, Math.min(box.right, view.right) - Math.max(box.left, view.left));
      if (intersection / Math.min(Math.max(1, box.width), view.width) >= 0.7) visible.push(index);
      if (intersection > largestIntersection) {
        largestIntersection = intersection;
        largestIndex = index;
      }
      const distance = Math.abs(box.left - view.left);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    if (!visible.length) visible.push(largestIndex);
    return { indices: visible, nearestIndex };
  }

  function scroll(left, animate = true) {
    const behavior = animate && !motion.matches && !document.documentElement.classList.contains('motion-paused') ? 'smooth' : 'auto';
    track.scrollTo({ left: Math.min(maximum(), Math.max(0, left)), behavior });
    schedule();
  }

  function scrollToCard(index, animate = true) {
    scroll(position(Math.min(cards.length - 1, Math.max(0, index))), animate);
  }

  function atEnd() {
    return track.scrollLeft >= maximum() - 2;
  }

  function nextIndex() {
    const visible = visibleCards().indices;
    return Math.min(cards.length - 1, visible[visible.length - 1] + 1);
  }

  function moreTarget() {
    if (atEnd()) return 0;
    return track.scrollLeft < position(extrasIndex) - 2 ? extrasIndex : nextIndex();
  }

  function update() {
    frame = 0;
    // Preserve the card being read when a breakpoint changes the rail width.
    if (Math.abs(previousWidth - track.clientWidth) > 0.5) {
      previousWidth = track.clientWidth;
      track.scrollTo({ left: position(activeIndex), behavior: 'auto' });
    }
    const visible = visibleCards();
    activeIndex = visible.nearestIndex;
    const start = visible.indices[0] + 1;
    const end = visible.indices[visible.indices.length - 1] + 1;
    const total = cards.length;
    const firstPage = track.scrollLeft <= 2;
    const lastPage = atEnd();
    previous?.setAttribute('aria-disabled', String(firstPage));
    next?.setAttribute('aria-disabled', String(lastPage));
    if (previous) previous.setAttribute('aria-label', label('offerPrevious', 'Poprzednie oferty'));
    if (next) next.setAttribute('aria-label', label('offerNext', 'Następne oferty'));
    if (range) {
      const values = { start: number.format(start), end: number.format(end), total: number.format(total) };
      const text = label('offerRange', 'Oferty {start}–{end} z {total}').replace(/\{(start|end|total)\}/g, (_, key) => values[key]);
      if (range.textContent !== text) range.textContent = text;
    }
    if (progress) {
      progress.max = total;
      progress.value = end;
    }
    if (more) {
      const text = lastPage ? label('offerFirst', 'Wróć do pierwszych ofert') : label('offerMore', 'Zobacz więcej ofert');
      // Retain decorative children such as an arrow when the label has its own span.
      const caption = more.querySelector('[data-offer-more-label]');
      if (caption) caption.textContent = text;
      else if (more.textContent !== text) more.textContent = text;
      const target = cards[moreTarget()];
      more.setAttribute('href', target.id ? `#${target.id}` : '#offer');
    }
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  previous?.addEventListener('click', () => {
    if (track.scrollLeft <= 2) return;
    const visible = visibleCards().indices;
    scrollToCard(visible[0] - visible.length);
  });

  next?.addEventListener('click', () => {
    if (!atEnd()) scrollToCard(nextIndex());
  });

  more?.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    scrollToCard(moreTarget());
  });

  track.addEventListener('keydown', event => {
    // Arrow keys on links and other controls keep their normal browser behavior.
    if (event.target !== track || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!atEnd()) scrollToCard(nextIndex());
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const visible = visibleCards().indices;
      scrollToCard(visible[0] - visible.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      scrollToCard(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollToCard(cards.length - 1);
    }
  });

  track.addEventListener('focusin', event => {
    if (event.target === track) return;
    const card = event.target.closest('article');
    if (!card || card.parentElement !== track) return;
    const box = card.getBoundingClientRect();
    const view = viewport();
    if (box.left < view.left - 1 || box.width > view.width) {
      scrollToCard(cards.indexOf(card), false);
    } else if (box.right > view.right + 1) {
      // Scrolling the rail itself never moves the page vertically.
      scroll(track.scrollLeft + box.right - view.right, false);
    }
  });

  function revealHash() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const target = document.getElementById(id);
    const index = cards.findIndex(card => card === target || (target && card.contains(target)));
    if (index >= 0) scrollToCard(index, false);
  }

  track.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(track);
  window.addEventListener('hashchange', revealHash);
  wrapper.classList.add('is-enhanced');
  update();
  revealHash();
})();
