(() => {
  'use strict';
  const search = document.getElementById('guide-search');
  const content = document.getElementById('guide-content');
  if (!search || !content) return;
  const chapters = [...content.querySelectorAll('[data-guide-chapter]')];
  const links = [...document.querySelectorAll('[data-guide-link]')];
  const count = document.getElementById('guide-search-count');
  const clear = document.getElementById('guide-clear');
  const empty = document.getElementById('guide-empty');
  const normalize = value => String(value).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
  const searchable = new Map(chapters.map(chapter => [chapter, normalize(`${chapter.dataset.title || ''} ${chapter.textContent}`)]));

  function filter() {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const chapter of chapters) {
      const matches = terms.every(term => searchable.get(chapter).includes(term));
      chapter.hidden = !matches;
      if (matches) visible += 1;
    }
    for (const link of links) {
      const chapter = chapters.find(item => `#${item.id}` === link.getAttribute('href'));
      link.hidden = Boolean(chapter?.hidden);
    }
    if (count) count.textContent = terms.length ? `Pasujące rozdziały: ${visible} z ${chapters.length}.` : `Dostępne rozdziały: ${chapters.length}. Wyszukuj nazwę usługi, etap lub przycisk.`;
    if (empty) empty.hidden = visible > 0;
    if (clear) clear.hidden = !terms.length;
  }

  function showAll({ focus = false } = {}) {
    search.value = '';
    filter();
    if (focus) search.focus();
  }

  search.addEventListener('input', filter);
  clear?.addEventListener('click', () => showAll({ focus: true }));
  document.getElementById('guide-show-all')?.addEventListener('click', () => showAll({ focus: true }));
  document.getElementById('guide-print')?.addEventListener('click', () => window.print());
  document.getElementById('guide-toc')?.addEventListener('click', event => {
    const link = event.target.closest('a[data-guide-link]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const chapter = chapters.find(item => `#${item.id}` === link.getAttribute('href'));
    const heading = chapter?.querySelector('h2');
    if (heading) {
      event.preventDefault();
      history.pushState(null, '', `#${encodeURIComponent(chapter.id)}`);
      chapter.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
  window.addEventListener('hashchange', () => {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const chapter = chapters.find(item => item.id === id);
    if (chapter?.hidden) showAll();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting && !entry.target.hidden).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      for (const link of links) {
        if (link.getAttribute('href') === `#${visible[0].target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
    for (const chapter of chapters) observer.observe(chapter);
  }
  document.documentElement.classList.add('guide-ready');
  filter();
})();
