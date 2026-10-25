'use strict';
// Materialize the agreed commercial policy into static HTML, locales and templates.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const offer = require('../commercial/offer.json');
const copy = require('../commercial/copy.json');
const credibility = require('../commercial/credibility-copy.json');
const carousel = require('../commercial/carousel-copy.json');
const { presets } = require('../commercial/presets');
const languages = Object.keys(copy.finalPrices);
const catalogs = Object.fromEntries(languages.map(code => [code, JSON.parse(fs.readFileSync(path.join(root, 'locales', `${code}.json`), 'utf8'))]));
for (const [key, versions] of Object.entries(credibility)) {
  for (const code of languages) {
    if (!versions[code]) throw new Error(`Missing credibility translation ${key}/${code}`);
    catalogs[code][`credibility.${key}`] = versions[code];
  }
}
const uiPath = path.join(root, 'locales/ui.json');
const ui = JSON.parse(fs.readFileSync(uiPath, 'utf8'));
for (const [key, versions] of Object.entries(carousel)) {
  for (const code of languages) {
    if (!versions[code]) throw new Error(`Missing carousel translation ${key}/${code}`);
    catalogs[code][`carousel.${key}`] = versions[code];
    ui[code][`offer${key[0].toUpperCase()}${key.slice(1)}`] = versions[code];
  }
}
fs.writeFileSync(uiPath, JSON.stringify(ui, null, 2) + '\n');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const money = (cents, code = 'pl') => new Intl.NumberFormat(code === 'no' ? 'nb' : code, { maximumFractionDigits: 2, useGrouping: 'always' }).format(cents / 100).replace(/[\u00a0\u202f]/g, ' ') + (code === 'pl' ? ' zł' : ' PLN');
function variables(code) {
  return {
    launchProjects: offer.launch.aiProjects, ivrOptions: offer.plans.ivr.ivrOptions,
    alertPercent: offer.billing.alertPercent, maxCallMinutes: offer.billing.maxCallMinutes, maxForwardedCallMinutes: offer.billing.maxForwardedCallMinutes,
    ivrExtra: money(offer.billing.ivrExtraMinuteCents, code), aiExtra: money(offer.billing.aiExtraMinuteCents, code),
    smsExtra: money(offer.billing.extraSmsPartCents, code), workExtra: money(offer.billing.extraWorkHourCents, code),
    criticalHours: offer.billing.criticalResponseWorkingHours, normalDays: offer.billing.normalResponseBusinessDays,
    advancePercent: offer.billing.advancePercent, paymentDays: offer.billing.paymentDays, noticeDays: offer.billing.noticeDays,
    websiteSetup: money(offer.otherServices.website.setupCents, code), websiteSections: offer.otherServices.website.sections,
    automationSetup: money(offer.otherServices.automation.setupCents, code), automationApps: offer.otherServices.automation.applications,
    websiteCare: money(offer.otherServices.website.careMonthlyCents, code), automationCare: money(offer.otherServices.automation.careMonthlyCents, code),
    websiteChanges: offer.otherServices.website.changeMinutes, automationChanges: offer.otherServices.automation.changeMinutes,
    comboMinutes: offer.plans.combo.minutes, comboSms: offer.plans.combo.smsParts, comboChanges: offer.plans.combo.changeMinutes,
    faqAnswers: offer.plans.bot.faqAnswers, botMinutes: offer.plans.bot.minutes,
  };
}
function text(key, planId) {
  const catalogKey = `offer.${key}${planId ? '.' + planId : ''}`;
  for (const code of languages) {
    if (!copy[key]?.[code]) throw new Error(`Missing translation ${key}/${code}`);
    const vars = { ...variables(code), ...(planId ? offer.plans[planId] : {}) };
    catalogs[code][catalogKey] = copy[key][code].replace(/\{(\w+)\}/g, (_, name) => {
      if (!Object.hasOwn(vars, name)) throw new Error(`Missing value ${name}`);
      return vars[name];
    });
  }
  return catalogs.pl[catalogKey];
}
function price(cents) {
  const key = `offer.price.${cents}`;
  for (const code of languages) catalogs[code][key] = money(cents, code);
  return money(cents);
}
let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const start = html.indexOf('<!-- OFFER CARDS START -->'), end = html.indexOf('<!-- OFFER CARDS END -->');
if (start < 0 || end < start) throw new Error('Pricing anchors missing');
let count = 0;
const plans = Object.entries(offer.plans);
const grid = html.slice(start, end).replace(/<article class="package-card(?: featured)?"[\s\S]*?<\/article>/g, card => {
  const [id, p] = plans[count++];
  const features = id === 'ivr'
    ? [text('ivrScope'), text('minutes', id), text('changes', id), 'Wsparcie po uruchomieniu']
    : [...(id === 'combo' ? [text('ivrScope')] : []), text('aiScope'), text('integrationScope'), text('faqAnswers'), text('minutes', id), text('sms', id), text('changes', id), text('aiCosts')];
  card = card.replace(/<ul>[\s\S]*?<\/ul>/, `<ul>\n${features.map(value => `<li>${escape(value)}</li>`).join('\n')}</ul>`);
  card = card.replace(/(<div class="dual-price">\s*<div><small>JEDNORAZOWE WDROŻENIE<\/small><strong>)[\s\S]*?(<\/strong>)/, `$1od ${money(p.setupCents)}$2`);
  card = card.replace(/(<small>ABONAMENT<\/small><strong>)[\s\S]*?(<em>)/, `$1${price(p.monthlyCents)} $2`);
  return card;
});
if (count !== plans.length) throw new Error('Unexpected package count');
html = html.slice(0, start) + grid + html.slice(end);
const included = `<!-- BOT SCOPE START -->
<div class="bot-included" aria-labelledby="bot-included-title"><h3 id="bot-included-title">${escape(text('includedTitle'))}</h3><div class="bot-included-grid">${[['conversationTitle', 'conversationScope'], ['handoffTitle', 'integrationDetail'], ['testingTitle', 'testingScope']].map(([heading, body]) => `<article><h4>${escape(text(heading))}</h4><p>${escape(text(body))}</p></article>`).join('')}</div><p class="price-note">${escape(text('trafficAdvice'))}</p></div>
<!-- BOT SCOPE END -->`;
if (html.includes('<!-- BOT SCOPE START -->')) html = html.replace(/<!-- BOT SCOPE START -->[\s\S]*?<!-- BOT SCOPE END -->/, included);
else html = html.replace('<div class="pricing-explainer subscription">', included + '\n<div class="pricing-explainer subscription">');
const terms = `<!-- COMMERCIAL TERMS START -->\n<p class="price-note">${escape(text('finalPrices'))}</p>\n<p class="price-note">${escape(text('launch'))}</p>\n<details class="plan-terms"><summary>${escape(text('terms'))}<span aria-hidden="true">+</span></summary><div>${['limits', 'meter', 'extras', 'support', 'payments'].map(key => `<p>${escape(text(key))}</p>`).join('\n')}</div></details>\n<!-- COMMERCIAL TERMS END -->`;
if (html.includes('<!-- COMMERCIAL TERMS START -->')) html = html.replace(/<!-- COMMERCIAL TERMS START -->[\s\S]*?<!-- COMMERCIAL TERMS END -->/, terms);
else html = html.replace(/<p class="price-note">Kwoty „od”[\s\S]*?<\/p>/, terms);
for (const [id, cents] of [['website', offer.otherServices.website.setupCents], ['custom-automation', offer.otherServices.automation.setupCents]]) {
  const pattern = new RegExp(`<article\\b[^>]*data-offer-id="${id}"[^>]*>[\\s\\S]*?<\\/article>`);
  if (!pattern.test(html)) throw new Error(`Missing offer card ${id}`);
  html = html.replace(pattern, card => card.replace(/(<div class="price"><small>WYCENA<\/small><strong>)[\s\S]*?(<\/strong>)/, `$1od ${money(cents)}$2`));
}
html = html.replace(/<!-- OTHER SCOPE START -->[\s\S]*?<!-- OTHER SCOPE END -->/, `<!-- OTHER SCOPE START --><p class="price-note">${escape(text('otherScope'))}</p><!-- OTHER SCOPE END -->`);
html = html.replace(/(<h3>System może rozwijać się razem z firmą\.<\/h3>\s*<p>)[\s\S]*?(<\/p>)/, `$1${escape(text('otherCare'))}$2`);
html = html.replace(/(<!-- OTHER CARE START -->[\s\S]*?<small>ABONAMENT<\/small><strong>)[\s\S]*?(<\/strong>)/, `$1od ${money(offer.otherServices.website.careMonthlyCents)}$2`);
html = html.replace(/(<summary>Co obejmuje abonament 899 zł miesięcznie\?[\s\S]*?<\/summary>\s*<p>)[\s\S]*?(<\/p>)/, `$1${escape(text('bundleFaq'))}$2`);
fs.writeFileSync(path.join(root, 'public/index.html'), html);
for (const code of languages) fs.writeFileSync(path.join(root, 'locales', `${code}.json`), JSON.stringify(catalogs[code], null, 2) + '\n');
const catalogPath = path.join(root, 'documents/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
catalog.presets = presets();
catalog.version = '1.2';
// Financial fields stay blank until an operator deliberately selects a package.
catalog.fields.monthly_fee.default = '';
catalog.fields.price_basis.default = 'brutto';
catalog.fields.seller_nip.default = '';
catalog.fields.usage_metering = { id: 'usage_metering', label: 'Sposób liczenia minut i SMS', group: 'Opieka', type: 'textarea', default: '' };
for (const template of catalog.templates) {
  template.version = '1.2';
  if (template.id === 'opieka') {
    template.description = 'Usługa, opieka i uzgodnione limity wybranego pakietu.';
    template.notes = template.notes.replace('sama kwota 899 zł', 'sama kwota abonamentu');
  }
  if (['oferta', 'opieka'].includes(template.id) && !JSON.stringify(template.sections).includes('{{usage_metering}}')) {
    const section = template.sections.find(s => s.title.includes(template.id === 'oferta' ? 'Abonament i zużycie' : 'Pakiet rozmów'));
    section.paragraphs.push('Sposób pomiaru i rozliczania: {{usage_metering}}.');
  }
  template.fields = [...new Set([...JSON.stringify(template.sections).matchAll(/\{\{([a-z_]+)\}\}/g)].map(match => match[1]))];
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log('Updated commercial terms, eleven locales and three explicit document presets.');
