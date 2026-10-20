const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const docx = require('../panel/docx');
const catalog = require('../documents/catalog.json');

const password = crypto.randomBytes(30).toString('base64url');
const children = [];
let enabled, disabled;
async function start(value) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '0', NODE_ENV: 'production', DAWKOZ_PANEL_PASSWORD: value },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Panel server not ready')), 5000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on (\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Panel server stopped')); });
  });
}
before(async () => { enabled = await start(password); disabled = await start(''); });
after(async () => {
  for (const child of children) if (child.exitCode === null) {
    const stopped = once(child, 'exit'); child.kill(); await stopped;
  }
});
function request(port, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method: options.method || 'GET', headers: { 'x-forwarded-proto': 'https', ...options.headers } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => { const bytes = Buffer.concat(chunks); resolve({ status: res.statusCode, headers: res.headers, bytes, text: bytes.toString('utf8') }); });
    });
    req.setTimeout(5000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject); req.end(options.body);
  });
}
async function login(value = password, extra = {}) {
  return request(enabled, '/app/login', { method: 'POST', headers: { origin: 'https://dawkoz.com', 'content-type': 'application/x-www-form-urlencoded', ...extra }, body: new URLSearchParams({ password: value }).toString() });
}
async function cookie() { return (await login()).headers['set-cookie'][0].split(';')[0]; }

test('private library and assets require login and are unavailable through public paths', async () => {
  assert.equal((await request(enabled, '/app')).headers.location, '/app/login');
  for (const target of ['/app/documents', '/app/assets/panel.js', '/app/assets/docx.js']) {
    const response = await request(enabled, target);
    assert.equal(response.status, 303, target);
    assert.equal(response.headers.location, '/app/login');
    assert.ok(!response.text.includes('Umowa wdrożeniowa'));
  }
  for (const target of ['/app/api/templates', '/app/templates/package.zip', '/app/templates/oferta.pdf', '/app/templates/opieka.docx']) assert.equal((await request(enabled, target)).status, 401, target);
  for (const target of ['/documents/catalog.json', '/documents/generated/oferta.pdf', '/panel/documents.html', '/panel-server.js']) assert.equal((await request(enabled, target)).status, 404, target);
  assert.equal((await request(enabled, '/app/%2e%2e/documents/catalog.json')).status, 403);
});

test('missing password fails closed and does not accept a blank or supplied password', async () => {
  const page = await request(disabled, '/app/login');
  assert.equal(page.status, 503);
  assert.match(page.text, /Panel oczekuje na aktywację/);
  assert.match(page.text, /button[^>]+disabled/);
  const response = await request(disabled, '/app/login', { method: 'POST', headers: { origin: 'https://dawkoz.com', 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=' });
  assert.equal(response.status, 503);
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal((await request(disabled, '/app/api/templates')).status, 401);
  const weak = await start('short');
  assert.equal((await request(weak, '/app/login')).status, 503);
  assert.equal((await request(weak, '/app/api/templates')).status, 401);
});

test('login creates an opaque HttpOnly, Secure, SameSite session and protects against reflected query values', async () => {
  const wrong = await login('wrong');
  assert.equal(wrong.headers.location, '/app/login?error=credentials');
  assert.equal(wrong.headers['set-cookie'], undefined);
  const success = await login();
  assert.equal(success.status, 303);
  assert.equal(success.headers.location, '/app/documents');
  const session = success.headers['set-cookie'][0];
  assert.match(session, /dawkoz_panel_session=[a-f0-9]{64};/);
  for (const flag of ['Path=/app', 'HttpOnly', 'SameSite=Strict', 'Secure']) assert.ok(session.includes(flag));
  const forged = await request(enabled, '/app/api/templates', { headers: { cookie: 'dawkoz_panel_session=' + 'a'.repeat(64) } });
  assert.equal(forged.status, 401);
  const reflected = await request(enabled, '/app/login?error=%3Cscript%3Ealert(1)%3C/script%3E');
  assert.ok(!reflected.text.includes('<script>alert(1)</script>'));
});

test('authenticated users can read templates and downloads, including HEAD, with no-store and noindex', async () => {
  const session = await cookie();
  const response = await request(enabled, '/app/api/templates', { headers: { cookie: session } });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.text).templates.length, 12);
  assert.match(response.headers['cache-control'], /no-store/);
  assert.match(response.headers['x-robots-tag'], /noindex/);
  assert.equal(response.headers['referrer-policy'], 'same-origin');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.match(response.headers['content-security-policy'], /form-action 'self'/);
  const page = await request(enabled, '/app/documents', { headers: { cookie: session } });
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('Dokumenty do współpracy'));
  for (const [target, signature, type] of [
    ['/app/templates/oferta.pdf', '%PDF-', 'application/pdf'],
    ['/app/templates/opieka.docx', 'PK', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['/app/templates/package.zip', 'PK', 'application/zip'],
  ]) {
    const file = await request(enabled, target, { headers: { cookie: session } });
    assert.equal(file.status, 200);
    assert.ok(file.text.startsWith(signature));
    assert.equal(file.headers['content-type'], type);
    assert.match(file.headers['content-disposition'], /attachment;/);
    const head = await request(enabled, target, { method: 'HEAD', headers: { cookie: session } });
    assert.equal(head.bytes.length, 0);
    assert.equal(head.headers['content-length'], file.headers['content-length']);
  }
  assert.equal((await request(enabled, '/app/templates/not-a-template.pdf', { headers: { cookie: session } })).status, 404);
  assert.equal((await request(enabled, '/app/api/templates', { method: 'POST', headers: { cookie: session }, body: 'customer-data' })).status, 405);
});

test('cross-site and missing-origin authentication writes are rejected and logout revokes the session', async () => {
  assert.equal((await login(password, { origin: 'https://attacker.example' })).status, 403);
  const noOrigin = await request(enabled, '/app/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=wrong' });
  assert.equal(noOrigin.status, 403);
  const session = await cookie();
  assert.equal((await request(enabled, '/app/logout', { method: 'POST', headers: { cookie: session, origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request(enabled, '/app/logout', { headers: { cookie: session } })).status, 405);
  assert.equal((await request(enabled, '/app/logout', { method: 'POST', headers: { cookie: session, origin: 'https://dawkoz.com' } })).status, 303);
  assert.equal((await request(enabled, '/app/api/templates', { headers: { cookie: session } })).status, 401);
});

test('oversized login bodies are bounded and repeated password guesses are throttled', async () => {
  await cookie();
  const large = await request(enabled, '/app/login', { method: 'POST', headers: { origin: 'https://dawkoz.com', 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=' + 'x'.repeat(5000) });
  assert.equal(large.status, 413);
  await cookie();
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await login('incorrect')).status, 303);
  const blocked = await login('incorrect');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers['retry-after']) > 0);
});

test('every document has declared fields and real blank PDF, DOCX and text files', () => {
  assert.equal(catalog.templates.length, 12);
  assert.equal(new Set(catalog.templates.map(item => item.id)).size, 12);
  for (const template of catalog.templates) {
    const placeholders = [...new Set([...JSON.stringify(template.sections).matchAll(/\{\{([a-z_]+)\}\}/g)].map(match => match[1]))];
    assert.deepEqual(template.fields, placeholders, template.id);
    for (const field of template.fields) assert.ok(Object.hasOwn(catalog.fields, field), field);
    const base = path.join(__dirname, '..', 'documents/generated', template.id);
    assert.ok(fs.readFileSync(base + '.pdf', 'utf8').startsWith('%PDF-'));
    assert.ok(fs.readFileSync(base + '.docx').subarray(0, 2).equals(Buffer.from('PK')));
    assert.ok(fs.readFileSync(base + '.md', 'utf8').includes('Projekt do uzgodnienia'));
  }
  const care = catalog.templates.find(item => item.id === 'opieka');
  for (const field of ['monthly_fee', 'price_basis', 'minute_limit', 'sms_limit', 'limit_policy', 'extra_budget', 'response']) assert.ok(care.fields.includes(field));
  assert.equal(catalog.fields.monthly_fee.default, '899,00 zł');
});

test('Word export produces a real OOXML ZIP and escapes supplied content', () => {
  const bytes = docx.create({ title: 'Umowa <klient> & Łódź', version: '1.0', note: 'Projekt', sections: [{ title: '§ 1. Dane', paragraphs: ['<script>alert(1)</script> & "test"\nZażółć gęślą jaźń\u0000'] }] });
  const buffer = Buffer.from(bytes);
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50);
  const text = buffer.toString('utf8');
  assert.ok(text.includes('[Content_Types].xml'));
  assert.ok(text.includes('word/document.xml'));
  assert.ok(text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(text.includes('Zażółć gęślą jaźń'));
  assert.ok(!text.includes('<script>alert(1)</script>'));
});
