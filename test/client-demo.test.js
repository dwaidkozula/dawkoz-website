const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, filterRequests, csvCell, exportRequestsCsv, requestSeed } = require('../public/client-demo');

test('client demo filters requests by status and Polish text without requiring diacritics', () => {
  const source = requestSeed.map(item => ({ ...item }));
  assert.equal(normalize('  Łączność  '), 'lacznosc');
  assert.equal(filterRequests(source, '', 'all').length, 7);
  assert.equal(filterRequests(source, '', 'new').length, 3);
  assert.deepEqual(filterRequests(source, 'AWARIA DOMOFONU', 'new').map(item => item.id), ['DEMO-007']);
  assert.equal(filterRequests(source, 'przegladu', 'progress').length, 1);
  assert.equal(filterRequests(source, 'przegladu', 'closed').length, 0);
  assert.equal(filterRequests(source, 'nieistniejący wpis', 'all').length, 0);
  assert.equal(source[0].status, 'new');
  source[0].status = 'closed';
  assert.equal(filterRequests(source, 'awaria', 'new').length, 0);
  assert.equal(filterRequests(source, 'awaria', 'closed').length, 1);
  assert.equal(requestSeed[0].status, 'new');
});

test('client demo CSV safely escapes cells and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('dwa; pola'), '"dwa; pola"');
  assert.equal(csvCell('firma "A"'), '"firma ""A"""');
  assert.equal(csvCell('wiersz\r\nnowy'), '"wiersz\r\nnowy"');
  for (const formula of ['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '\t =HYPERLINK("x")', '\r-3']) {
    assert.ok(csvCell(formula).startsWith('"\''), formula);
  }
  assert.equal(csvCell('opis = tekst'), '"opis = tekst"');
  const exported = exportRequestsCsv([{ ...requestSeed[0], title: '=1+1' }]);
  assert.ok(exported.startsWith('\uFEFF"DEMO — WYŁĄCZNIE DANE PRZYKŁADOWE"\r\n'));
  assert.ok(exported.includes('"\'=1+1"'));
  assert.ok(exported.includes('"Nowe"'));
  assert.ok(exported.endsWith('\r\n'));
  assert.equal(exported.split('\r\n').length, 4);
  assert.equal(exportRequestsCsv([]).split('\r\n').length, 3);
});
