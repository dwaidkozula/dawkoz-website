const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const root = path.join(__dirname, '..');
const password = crypto.randomBytes(30).toString('base64url');
const children = [];
let enabled, disabled;

async function start(value) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: '0', NODE_ENV: 'production', DAWKOZ_PANEL_PASSWORD: value },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Guide server did not start')), 5000);
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on (\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Guide server stopped')); });
  });
}

function request(port, target, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method: options.method || 'GET', headers: { 'x-forwarded-proto': 'https', ...options.headers } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, bytes, text: bytes.toString('utf8') });
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Guide request timed out')));
    req.on('error', reject);
    req.end(options.body);
  });
}

async function session() {
  const response = await request(enabled, '/app/login', {
    method: 'POST', headers: { origin: 'https://dawkoz.com', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }).toString(),
  });
  assert.equal(response.status, 303);
  return response.headers['set-cookie'][0].split(';')[0];
}

before(async () => { enabled = await start(password); disabled = await start(''); });
after(async () => {
  for (const child of children) if (child.exitCode === null) {
    const stopped = once(child, 'exit'); child.kill(); await stopped;
  }
});

test('guide keeps instructions and images private and fails closed without a password', async () => {
  for (const port of [enabled, disabled]) {
    for (const target of ['/app/guide', '/app/assets/guide.css', '/app/assets/guide.js']) {
      const response = await request(port, target);
      assert.equal(response.status, 303, target);
      assert.equal(response.headers.location, '/app/login');
    }
    for (const target of ['/app/guide/manual.pdf', '/app/guide/images/panel-library.png']) {
      assert.equal((await request(port, target)).status, 401, target);
    }
  }
  for (const target of ['/manual/generated/dawkoz-instrukcja-realizacji-zamowien.pdf', '/manual/assets/panel-library.png', '/panel/guide.html', '/panel/guide.js', '/panel/guide.css']) {
    assert.equal((await request(enabled, target)).status, 404, target);
  }
});

test('guide serves readable HTML and navigation only to the signed-in operator', async () => {
  const cookie = await session();
  const page = await request(enabled, '/app/guide', { headers: { cookie } });
  assert.equal(page.status, 200);
  assert.match(page.text, /Jak zrealizować zamówienie/);
  assert.match(page.text, /href="\/app\/guide\/manual\.pdf"/);
  assert.match(page.text, /GUIDE CONTENT START/);
  assert.match(page.headers['cache-control'], /no-store/);
  assert.match(page.headers['x-robots-tag'], /noindex/);
  assert.match(page.headers['content-security-policy'], /script-src 'self'/);
  assert.ok(!page.headers['content-security-policy'].includes("'unsafe-inline'"));
  const documents = await request(enabled, '/app/documents', { headers: { cookie } });
  assert.match(documents.text, /href="\/app\/guide"/);
  for (const [target, type] of [['/app/assets/guide.css', 'text/css; charset=utf-8'], ['/app/assets/guide.js', 'text/javascript; charset=utf-8']]) {
    const asset = await request(enabled, target, { headers: { cookie } });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers['content-type'], type);
  }
});

test('guide PDF and only whitelisted screenshots are genuine protected downloads with HEAD support', async () => {
  const cookie = await session();
  const pdfPath = path.join(root, 'manual/generated/dawkoz-instrukcja-realizacji-zamowien.pdf');
  const imagePath = path.join(root, 'manual/assets/panel-library.png');
  const expectedPdf = fs.readFileSync(pdfPath);
  const expectedImage = fs.readFileSync(imagePath);
  assert.ok(expectedPdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.ok(expectedImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  for (const [target, expected, type] of [['/app/guide/manual.pdf', expectedPdf, 'application/pdf'], ['/app/guide/images/panel-library.png', expectedImage, 'image/png']]) {
    const response = await request(enabled, target, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], type);
    assert.deepEqual(response.bytes, expected);
    if (type === 'application/pdf') assert.match(response.headers['content-disposition'], /attachment; filename="dawkoz-instrukcja-realizacji-zamowien.pdf"/);
    assert.match(response.headers['cache-control'], /no-store/);
    assert.match(response.headers['x-robots-tag'], /noindex/);
    const head = await request(enabled, target, { method: 'HEAD', headers: { cookie } });
    assert.equal(head.status, 200);
    assert.equal(head.bytes.length, 0);
    assert.equal(head.headers['content-length'], String(expected.length));
  }
  for (const target of ['/app/guide/images/not-published.png', '/app/guide/images/panel-library.png.js', '/app/guide/images/panel-library.svg', '/app/guide/images/catalog.json']) {
    assert.equal((await request(enabled, target, { headers: { cookie } })).status, 404, target);
  }
  assert.equal((await request(enabled, '/app/guide/images/%2e%2e/catalog.json', { headers: { cookie } })).status, 403);
});

test('guide rejects writes and access stops immediately after logout', async () => {
  const cookie = await session();
  for (const target of ['/app/guide', '/app/guide/manual.pdf', '/app/guide/images/panel-library.png']) {
    const response = await request(enabled, target, { method: 'POST', headers: { cookie, origin: 'https://dawkoz.com' }, body: 'customer-data' });
    assert.equal(response.status, 405, target);
  }
  const logout = await request(enabled, '/app/logout', { method: 'POST', headers: { cookie, origin: 'https://dawkoz.com' } });
  assert.equal(logout.status, 303);
  assert.equal((await request(enabled, '/app/guide', { headers: { cookie } })).status, 303);
  assert.equal((await request(enabled, '/app/guide/manual.pdf', { headers: { cookie } })).status, 401);
  assert.equal((await request(enabled, '/app/guide/images/panel-library.png', { headers: { cookie } })).status, 401);
});
