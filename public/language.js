(() => {
  'use strict';
  const supported = new Set(['pl', 'en', 'fr', 'es', 'de', 'no', 'pt', 'ru', 'sv', 'uk', 'it']);
  const picker = document.querySelector('.language-picker');
  const current = document.documentElement.lang;
  const query = new URLSearchParams(location.search);
  const key = 'dawkoz-language';
  try {
    if (supported.has(query.get('lang'))) localStorage.setItem(key, current);
    else if (!query.has('lang')) {
      const saved = localStorage.getItem(key);
      if (supported.has(saved) && saved !== current) {
        const target = new URL(location.href);
        target.searchParams.set('lang', saved);
        location.replace(target.href);
        return;
      }
    }
  } catch { /* Language links also work when browser storage is disabled. */ }
  if (!picker) return;
  picker.addEventListener('toggle', () => {
    if (picker.open) document.dispatchEvent(new Event('dawkoz:language-open'));
  });
  picker.addEventListener('click', event => {
    const link = event.target.closest('a[data-language]');
    if (!link) return;
    try { localStorage.setItem(key, link.dataset.language); } catch { /* Optional preference. */ }
    const target = new URL(link.href);
    target.hash = location.hash;
    link.href = target.href;
  });
  document.addEventListener('click', event => {
    if (!picker.contains(event.target)) picker.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && picker.open) {
      picker.open = false;
      picker.querySelector('summary').focus();
    }
  });
})();
