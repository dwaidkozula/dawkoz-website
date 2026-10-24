(() => {
  'use strict';
  const labels = JSON.parse(document.documentElement.dataset.ui || '{}');
  const label = (key, fallback) => labels[key] || fallback;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.scroll-progress');
  const nav = document.querySelector('#main-nav');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileLayout = window.matchMedia('(max-width: 900px)');
  const motionButton = document.querySelector('.motion-toggle');
  let motionPaused = motionPreference.matches;
  try {
    motionPaused = motionPaused || window.localStorage.getItem('dawkoz-pause-motion') === 'true';
  } catch { /* Storage can be unavailable in private browsing. */ }
  function updateMotionButton() {
    document.documentElement.classList.toggle('motion-paused', motionPaused);
    motionButton.setAttribute('aria-pressed', String(motionPaused));
    motionButton.textContent = motionPaused ? label('motionOn', 'Włącz animacje') : label('motionOff', 'Wyłącz animacje');
    motionButton.disabled = motionPreference.matches;
    if (motionPreference.matches) motionButton.textContent = label('motionReduced', 'Animacje wyłączone');
  }
  updateMotionButton();
  motionButton.addEventListener('click', () => {
    motionPaused = !motionPaused;
    try { window.localStorage.setItem('dawkoz-pause-motion', String(motionPaused)); } catch { /* Optional preference. */ }
    updateMotionButton();
  });

  function closeMenu({ restoreFocus = false } = {}) {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', label('menuOpen', 'Otwórz menu'));
    document.body.classList.remove('menu-open');
    if (restoreFocus) menuButton.focus();
  }

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    if (!open) return closeMenu();
    nav.classList.add('is-open');
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', label('menuClose', 'Zamknij menu'));
    document.body.classList.add('menu-open');
  });
  header.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !mobileLayout.matches) return;
    closeMenu();
    // Move keyboard focus into the chosen section, after its link becomes hidden.
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
  });
  document.addEventListener('keydown', event => {
    if (menuButton.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') {
      closeMenu({ restoreFocus: true });
    } else if (event.key === 'Tab') {
      const controls = [...header.querySelectorAll('a, button')].filter(element => element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeMenu();
  });
  mobileLayout.addEventListener('change', () => closeMenu());
  document.addEventListener('dawkoz:language-open', () => closeMenu());

  let framePending = false;
  function updateScroll() {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 15);
    const range = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, y / range)) : 0})`;
    framePending = false;
  }
  function requestScrollUpdate() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(updateScroll);
    }
  }
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate);
  updateScroll();

  if ('IntersectionObserver' in window) {
    const revealTargets = document.querySelectorAll('.hero-text, .automation, .proof-stat, .section-head, .intro > div, .bento article, .dash-copy, .dash-ui, .case-copy, .case-console, .price-grid article, .subscription, .steps article, .who-grid, .faq-list, .contact-grid');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('show');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    revealTargets.forEach(element => {
      element.setAttribute('data-reveal', '');
      if (element.parentElement.matches('.bento, .price-grid, .steps, .proof-stats')) {
        const index = [...element.parentElement.children].indexOf(element);
        element.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 80}ms`);
      }
      observer.observe(element);
    });
    if (!motionPaused) document.documentElement.classList.add('motion-ready');
    // Keyboard and anchor navigation should never land in invisible content.
    document.addEventListener('focusin', event => {
      const container = event.target.closest('[data-reveal]');
      if (container) container.classList.add('show');
    });
    const sections = [...nav.querySelectorAll('a[href^="#"]')].map(link => document.getElementById(link.getAttribute('href').slice(1))).filter(Boolean);
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        nav.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    sections.forEach(section => sectionObserver.observe(section));
  }

  motionPreference.addEventListener('change', event => {
    motionPaused = event.matches;
    try { motionPaused = motionPaused || window.localStorage.getItem('dawkoz-pause-motion') === 'true'; } catch { /* Optional preference. */ }
    if (motionPaused) document.documentElement.classList.remove('motion-ready');
    updateMotionButton();
  });

  const copyButton = document.querySelector('.copy-email');
  const copyStatus = document.querySelector('.copy-status');
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('kontakt@dawkoz.com');
      copyStatus.textContent = label('copyDone', 'Adres e-mail skopiowany.');
    } catch {
      // Keep the original contact link functional when browser permissions deny copying.
      copyStatus.textContent = label('copyFallback', 'Adres do skopiowania: kontakt@dawkoz.com');
    }
  });
})();
