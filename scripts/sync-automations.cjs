'use strict';
// Run after the offer configuration and locale edits are complete.
// Reads the current catalog so other locale namespaces are preserved.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const offer = require('../commercial/offer.json');
const copy = require('../commercial/automation-copy.json');
const languages = Object.keys(copy.eyebrow);
const examples = offer.otherServices.automation.examples;
const money = (cents, code) => {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid automation price');
  return new Intl.NumberFormat(code === 'no' ? 'nb' : code, { maximumFractionDigits: 2, useGrouping: 'always' })
    .format(cents / 100).replace(/[\u00a0\u202f]/g, ' ') + (code === 'pl' ? ' zł' : ' PLN');
};
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const resolved = {};
for (const code of languages) {
  const variables = {
    inquiriesSetup: money(examples?.inquiries?.setupCents, code),
    remindersSetup: money(examples?.reminders?.setupCents, code),
    invoicesSetup: money(examples?.invoices?.setupCents, code),
    automationCare: money(offer.otherServices.automation.careMonthlyCents, code),
  };
  const file = path.join(root, 'locales', code + '.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  resolved[code] = {};
  for (const [key, translations] of Object.entries(copy)) {
    if (typeof translations[code] !== 'string' || !translations[code].trim()) throw new Error(`Missing ${key}/${code}`);
    const value = translations[code].replace(/\{(\w+)\}/g, (_, name) => {
      if (!Object.hasOwn(variables, name)) throw new Error(`Unknown automation variable ${name}`);
      return variables[name];
    });
    resolved[code][key] = value;
    catalog['automation.v1.' + key] = value;
  }
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
}
let fragment = fs.readFileSync(path.join(root, 'commercial/automation.html'), 'utf8');
fragment = fragment.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!Object.hasOwn(resolved.pl, key)) throw new Error('Unknown automation template key ' + key);
  return escape(resolved.pl[key]);
});
const file = path.join(root, 'public/index.html');
let html = fs.readFileSync(file, 'utf8');
const start = '<!-- AUTOMATION OFFERS START -->';
const end = '<!-- AUTOMATION OFFERS END -->';
const block = `${start}\n${fragment.trim()}\n${end}`;
if (html.includes(start)) {
  if (!html.includes(end)) throw new Error('Automation section end marker missing');
  html = html.replace(/<!-- AUTOMATION OFFERS START -->[\s\S]*?<!-- AUTOMATION OFFERS END -->/, block);
} else {
  const anchor = '<section class="process section" id="process">';
  if (!html.includes(anchor)) throw new Error('Automation insertion anchor missing');
  html = html.replace(anchor, block + '\n' + anchor);
}
if (!/href="\/automation\.css(?:\?[^"]*)?"/.test(html)) {
  html = html.replace('</head>', '<link rel="stylesheet" href="/automation.css?v=1">\n</head>');
}
fs.writeFileSync(file, html);
console.log('Updated three automation examples, client-panel demo link and eleven locale catalogs.');
