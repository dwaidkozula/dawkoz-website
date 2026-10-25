const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const offer = require('../commercial/offer.json');
const { evaluate } = require('../commercial/costs');
const { presets } = require('../commercial/presets');
const catalog = require('../documents/catalog.json');
const { languages, renderPage, catalogs } = require('../i18n');
const home = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('planning distinguishes VAT, labor and reserve from real profit and preserves losses', () => {
  const result = evaluate(offer.plans.combo, offer.costAssumptions);
  assert.equal(result.monthlyNetCents, 73089);
  assert.equal(result.monthlyCostCents, 55500);
  assert.equal(result.monthlySurplusCents, 17589);
  assert.equal(result.firstYearGrossCents, 1477800);
  assert.equal(evaluate(offer.plans.combo, offer.costAssumptions, { vatPercent: 0 }).monthlySurplusCents, 34400);
  assert.ok(evaluate(offer.plans.combo, offer.costAssumptions, { variableMultiplierPercent: 300 }).monthlySurplusCents < 0);
  for (const plan of Object.values(offer.plans)) {
    assert.ok(evaluate(plan, offer.costAssumptions).setupSurplusCents > 0);
    assert.ok(evaluate(plan, offer.costAssumptions, { variableMultiplierPercent: offer.costAssumptions.stressMultiplierPercent }).monthlySurplusCents > 0);
  }
  assert.throws(() => evaluate(offer.plans.combo, offer.costAssumptions, { vatPercent: -1 }), RangeError);
  assert.throws(() => evaluate({ ...offer.plans.combo, minutes: NaN }, offer.costAssumptions), RangeError);
  assert.equal(offer.costAssumptions.verifiedSupplierRates, false);
});

test('document presets carry commercial terms without inventing client, seller or tax identities', () => {
  assert.deepEqual(catalog.presets, presets());
  assert.equal(catalog.fields.monthly_fee.default, '');
  assert.equal(catalog.fields.seller_nip.default, '');
  for (const preset of catalog.presets) {
    const plan = offer.plans[preset.id];
    assert.equal(preset.values.minute_limit, String(plan.minutes));
    assert.equal(preset.values.sms_limit, String(plan.smsParts));
    assert.match(preset.values.extra_budget, /^0,00 zł/);
    for (const id of ['client_name', 'seller_name', 'seller_nip', 'bank_account', 'vat_clause']) assert.ok(!Object.hasOwn(preset.values, id));
    for (const [id, value] of Object.entries(preset.values)) {
      const field = catalog.fields[id]; assert.ok(field, id);
      assert.equal(typeof value, 'string');
      assert.ok(value.length <= (field.type === 'textarea' ? 6000 : 500), `${preset.id}/${id}`);
      if (field.type === 'select') assert.ok(field.options.includes(value));
    }
  }
});

test('new examples and bot deliverables are translated, scoped and consistent with the offer', () => {
  for (const { code } of languages) {
    const html = renderPage(home, code, 'index.html');
    for (const key of ['conversationScope', 'integrationDetail', 'testingScope', 'trafficAdvice']) {
      const value = catalogs[code]['offer.' + key].replaceAll('&', '&amp;').replaceAll("'", '&#39;');
      assert.ok(html.includes(value), `${code}/${key}`);
    }
    for (const key of ['inquiriesPrice', 'remindersPrice', 'invoicesPrice', 'invoicesDetails', 'priceNote', 'panelNote']) {
      const value = catalogs[code]['automation.v1.' + key].replaceAll('&', '&amp;').replaceAll("'", '&#39;');
      assert.ok(html.includes(value), `${code}/${key}`);
    }
    assert.ok(html.includes(`/panel-klienta.html${code === 'pl' ? '' : '?lang=' + code}`));
    assert.ok(!html.includes('{faqAnswers}'));
  }
  assert.equal(offer.plans.bot.minutes, 200);
  assert.ok(!home.includes('POZYTYWNYCH OPINII'));
  assert.ok(!home.includes('1500+'));
  for (const p of Object.values(offer.otherServices.automation.examples)) {
    const net = Math.round(p.setupCents / 1.23);
    assert.ok(net > p.setupLaborHours * offer.costAssumptions.laborHourCostCents + p.externalCostCents + p.reserveCents);
  }
});

test('commercial limits and conditional extra charges are present in all eleven public languages', () => {
  for (const { code } of languages) {
    const html = renderPage(home, code, 'index.html');
    assert.ok(html.includes(catalogs[code]['offer.minutes.combo']), code);
    assert.ok(html.includes(catalogs[code]['offer.sms.combo']), code);
    assert.ok(html.includes(catalogs[code]['offer.changes.combo']), code);
    assert.ok(html.includes(catalogs[code]['offer.finalPrices']), code);
    assert.ok(html.includes(catalogs[code]['offer.limits']), code);
    assert.ok(!html.includes('{maxCallMinutes}'), code);
    if (code !== 'pl') {
      assert.ok(!html.includes(catalogs.pl['offer.finalPrices']), code);
      assert.ok(!html.includes('od 3 900 zł'), code);
    }
  }
});
