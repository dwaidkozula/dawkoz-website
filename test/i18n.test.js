const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { languages, resolveLocale, renderPage, source, catalogs } = require('../i18n');
const ui = require('../locales/ui.json');
const read = page => fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
const home = read('index.html');
const legal = ['polityka-prywatnosci.html', 'warunki-swiadczenia-uslug.html', 'przetwarzanie-danych.html'];
const escaped = text => text.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;');

test('offers the requested eleven languages in Polish alphabetical order', () => {
  assert.deepEqual(languages.map(({ name }) => name), [
    'Angielski', 'Francuski', 'Hiszpański', 'Niemiecki', 'Norweski', 'Polski',
    'Portugalski', 'Rosyjski', 'Szwedzki', 'Ukraiński', 'Włoski',
  ]);
  for (const { code } of languages) {
    assert.equal(resolveLocale(code), code);
    assert.ok(read(`flags/${code}.svg`).includes('<svg'));
  }
});

test('all language catalogs and interactive labels are complete', () => {
  for (const { code } of languages) {
    assert.deepEqual(Object.keys(catalogs[code]), Object.keys(source), code);
    assert.deepEqual(Object.keys(ui[code]), Object.keys(ui.pl), code);
    for (const value of [...Object.values(catalogs[code]), ...Object.values(ui[code])]) {
      assert.equal(typeof value, 'string', code);
      assert.ok(value.trim(), code);
    }
  }
});

test('renders translated content, accessible controls, prices and language links on the server', () => {
  for (const { code } of languages) {
    const html = renderPage(home, code, 'index.html');
    assert.ok(html.includes(`<html lang="${code}"`), code);
    assert.ok(html.includes(escaped(catalogs[code].h011)), code);
    assert.ok(html.includes(escaped(catalogs[code].h013)), code);
    assert.ok(html.includes(`aria-label="${escaped(catalogs[code].h003)}"`), code);
    assert.ok(html.includes('kontakt@dawkoz.com'), code);
    assert.ok(html.includes(code === 'pl' ? 'od 990 zł' : `${escaped(ui[code].from)} 990 PLN`), code);
    assert.equal((html.match(/data-language=/g) || []).length, 11, code);
    assert.equal((html.match(/data-language="[^"]+" aria-current="true"/g) || []).length, 1, code);
    assert.ok(html.includes(`data-language="${code}" aria-current="true"`), code);
    assert.equal((html.match(/rel="alternate"/g) || []).length, 12, code);
    assert.ok(html.includes(`rel="canonical" href="https://dawkoz.com/${code === 'pl' ? '' : `?lang=${code}`}"`), code);
    if (code !== 'pl') {
      assert.ok(!html.includes(source.h013), code);
      assert.ok(html.includes(`href="/polityka-prywatnosci.html?lang=${code}"`), code);
      assert.ok(html.includes(`srclang="${code}" label="${languages.find(l => l.code === code).native}" default`), code);
    }
  }
});

test('translates each legal document while preserving draft status, identity and language', () => {
  for (const { code } of languages) {
    for (const page of legal) {
      const html = renderPage(read(page), code, page);
      assert.ok(html.includes(`<html lang="${code}"`), `${code}/${page}`);
      assert.ok(html.includes('name="robots" content="noindex'), `${code}/${page}`);
      assert.ok(html.includes(escaped(catalogs[code].p003)), `${code}/${page}`);
      assert.ok(html.includes('Dawid Kozula'), `${code}/${page}`);
      assert.ok(html.includes('6272742701'), `${code}/${page}`);
      assert.ok(html.includes(`href="/${page}?lang=${code}"`), `${code}/${page}`);
      if (code !== 'pl') assert.ok(html.includes(`href="/?lang=${code}"`), `${code}/${page}`);
    }
  }
});

test('subtitle tracks exist for every language with five cues covering the full film', () => {
  for (const { code } of languages) {
    const vtt = read(`media/subtitles/${code}.vtt`);
    assert.ok(vtt.startsWith('WEBVTT\n\n'), code);
    assert.equal((vtt.match(/ --> /g) || []).length, 5, code);
    assert.ok(vtt.includes('00:00.000 --> 00:05.150'), code);
    assert.ok(vtt.includes('00:21.400 --> 00:25.000'), code);
    assert.ok(vtt.includes(catalogs[code].h012), code);
  }
});

test('unknown or malicious language values fall back to Polish without reflecting input', () => {
  for (const value of [undefined, null, '', 'EN', 'constructor', '__proto__', '../../en', '<script>alert(1)</script>']) {
    assert.equal(resolveLocale(value), 'pl');
    const html = renderPage(home, value, 'index.html');
    assert.ok(html.includes('<html lang="pl"'));
    assert.ok(!html.includes('<script>alert(1)</script>'));
  }
});

test('leaves scripts, styles, SVG and unrelated HTML intact', () => {
  const sample = '<html lang="pl"><head><script>const value="Kontakt";</script><style>/* Kontakt */</style></head><body><header class="site-header"><svg><title>Kontakt</title></svg></header><p>Kontakt</p></body></html>';
  const html = renderPage(sample, 'en', 'index.html');
  assert.ok(html.includes('<script>const value="Kontakt";</script>'));
  assert.ok(html.includes('<style>/* Kontakt */</style>'));
  assert.ok(html.includes('<svg><title>Kontakt</title></svg>'));
  assert.ok(html.includes('<p>Contact</p>'));
  assert.equal(renderPage('<html>Kontakt</html>', 'en', 'other.html'), '<html>Kontakt</html>');
});
