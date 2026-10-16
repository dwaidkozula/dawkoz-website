const fs = require('node:fs');
const path = require('node:path');
const source = require('./locales/pl.json');
const ui = require('./locales/ui.json');

const languages = [
  { code: 'en', name: 'Angielski', native: 'English' },
  { code: 'fr', name: 'Francuski', native: 'Français' },
  { code: 'es', name: 'Hiszpański', native: 'Español' },
  { code: 'de', name: 'Niemiecki', native: 'Deutsch' },
  { code: 'no', name: 'Norweski', native: 'Norsk' },
  { code: 'pl', name: 'Polski', native: 'Polski' },
  { code: 'pt', name: 'Portugalski', native: 'Português' },
  { code: 'ru', name: 'Rosyjski', native: 'Русский' },
  { code: 'sv', name: 'Szwedzki', native: 'Svenska' },
  { code: 'uk', name: 'Ukraiński', native: 'Українська' },
  { code: 'it', name: 'Włoski', native: 'Italiano' },
].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
const catalogs = Object.fromEntries(languages.map(({ code }) => [code, code === 'pl' ? source : JSON.parse(fs.readFileSync(path.join(__dirname, 'locales', `${code}.json`), 'utf8'))]));
const sourceKeys = new Map(Object.entries(source).map(([key, value]) => [value, key]));
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const decode = value => value.replace(/&(?:amp|quot|apos|nbsp|#39);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': '\u00a0' })[entity]);

function resolveLocale(value) {
  return languages.some(language => language.code === value) ? value : 'pl';
}

function translate(text, locale) {
  if (locale === 'pl') return text;
  const key = sourceKeys.get(text);
  if (key) return catalogs[locale][key] || text;
  if (text.endsWith(' — DAWKOZ')) return `${translate(text.slice(0, -9), locale)} — DAWKOZ`;
  const price = /^od ([\d ]+) zł$/.exec(text);
  if (price) return `${ui[locale].from} ${price[1]} PLN`;
  return text;
}

function href(page, locale, hash = '') {
  return `${page === 'index.html' ? '/' : `/${page}`}?lang=${locale}${hash}`;
}

function picker(locale, page) {
  const current = languages.find(language => language.code === locale);
  const labels = ui[locale];
  return `<details class="language-picker"><summary aria-label="${escape(labels.language + ': ' + current.native)}" title="${escape(labels.choose)}"><img class="language-flag" src="/flags/${locale}.svg" alt="" width="24" height="16"><b>${locale.toUpperCase()}</b><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></summary><div class="language-panel"><p>${escape(labels.choose)}</p><ul>${languages.map(language => `<li><a href="${escape(href(page, language.code))}" hreflang="${language.code}" data-language="${language.code}"${language.code === locale ? ' aria-current="true"' : ''}><img class="language-flag" src="/flags/${language.code}.svg" alt="" width="27" height="18"><span><span lang="pl">${language.name}</span><small lang="${language.code}">${language.native}</small></span>${language.code === locale ? '<span class="language-check" aria-hidden="true">✓</span>' : ''}</a></li>`).join('')}</ul></div></details>`;
}

function renderPage(html, locale, page) {
  if (!html.includes('class="site-header"') && !html.includes('class="legal-header"')) return html;
  locale = resolveLocale(locale);
  html = html.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/gi, token => {
    if (/^<(script|style|svg)\b|^<!--/i.test(token)) return token;
    if (token.startsWith('<')) {
      token = token.replace(/(aria-label|title)="([^"]*)"/g, (_, attribute, value) => `${attribute}="${escape(translate(decode(value), locale))}"`);
      if (/^<meta\b/i.test(token) && /(?:name="description"|property="og:description")/.test(token)) {
        token = token.replace(/content="([^"]*)"/, (_, value) => `content="${escape(translate(decode(value), locale))}"`);
      }
      if (locale !== 'pl') token = token.replace(/href="(\/(?:[a-z-]+\.html)?)(#[^"]*)?"/g, (_, target, hash = '') => `href="${escape(href(target.slice(1) || 'index.html', locale, hash))}"`);
      return token;
    }
    const trimmed = token.trim();
    const translated = translate(decode(trimmed), locale);
    return translated === decode(trimmed) ? token : token.replace(trimmed, () => escape(translated));
  });
  html = html.replace('<html lang="pl"', `<html lang="${locale}" data-ui="${escape(JSON.stringify(ui[locale]))}"`);
  const base = `https://dawkoz.com${page === 'index.html' ? '/' : `/${page}`}`;
  const canonical = locale === 'pl' ? base : `${base}?lang=${locale}`;
  const extras = `<link rel="stylesheet" href="/language.css?v=20261016"><script src="/language.js?v=20261016" defer></script><link rel="canonical" href="${canonical}">${languages.map(language => `<link rel="alternate" hreflang="${language.code}" href="${language.code === 'pl' ? base : `${base}?lang=${language.code}`}">`).join('')}<link rel="alternate" hreflang="x-default" href="${base}">`;
  html = html.replace('</head>', `${extras}</head>`);
  const control = picker(locale, page);
  if (html.includes('class="site-header"')) html = html.replace('<button class="menu-toggle"', `${control}<button class="menu-toggle"`);
  else html = html.replace(/(<div class="legal-header"[^>]*>[\s\S]*?<\/a>)/, match => match + control);
  if (page === 'index.html') {
    const tracks = languages.map(language => `<track kind="subtitles" src="/media/subtitles/${language.code}.vtt" srclang="${language.code}" label="${language.native}"${language.code === locale && locale !== 'pl' ? ' default' : ''}>`).join('');
    html = html.replace('<source src="/media/dawkoz-bot-demo.mp4" type="video/mp4">', `<source src="/media/dawkoz-bot-demo.mp4" type="video/mp4">${tracks}`);
  }
  return html;
}

module.exports = { languages, resolveLocale, translate, renderPage, source, catalogs };
