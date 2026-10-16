const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

let fixture;
let child;
let port;
const home = '<!doctype html><html lang="pl"><title>DAWKOZ</title><body>Witaj!</body></html>';

before(async () => {
  fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'dawkoz-server-test-'));
  await fs.mkdir(path.join(fixture, 'public'));
  await fs.mkdir(path.join(fixture, 'public-private'));
  await fs.copyFile(path.join(__dirname, '..', 'server.js'), path.join(fixture, 'server.js'));
  await fs.writeFile(path.join(fixture, 'public', 'index.html'), home);
  await fs.writeFile(path.join(fixture, 'public', 'demo.mp4'), '0123456789abcdef');
  await fs.writeFile(path.join(fixture, 'public', 'hello world.txt'), 'public file');
  await fs.writeFile(path.join(fixture, 'public', '.env'), 'private fixture');
  await fs.writeFile(path.join(fixture, 'public-private', 'secret.html'), 'outside public');
  await fs.symlink(path.join(fixture, 'public-private', 'secret.html'), path.join(fixture, 'public', 'outside.html'));
  child = spawn(process.execPath, ['server.js'], {
    cwd: fixture,
    env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => {
      clearTimeout(timeout);
      if (!port) reject(new Error('Server exited before readiness'));
    });
    let output = '';
    child.stdout.on('data', data => {
      output += data;
      const ready = output.match(/listening on (\d+)/);
      if (!ready) return;
      port = Number(ready[1]);
      clearTimeout(timeout);
      resolve();
    });
  });
});

after(async () => {
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
  if (fixture) await fs.rm(fixture, { recursive: true, force: true });
});

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    // A raw request preserves traversal paths that URL/fetch would normalize.
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, ...options }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', data => { body += data; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.setTimeout(3000, () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

test('serves the public page, query strings and encoded filenames', async () => {
  for (const target of ['/', '/index.html?source=test']) {
    const response = await request(target);
    assert.equal(response.status, 200);
    assert.equal(response.body, home);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  }
  assert.equal((await request('/hello%20world.txt')).body, 'public file');
});

test('HEAD returns headers without a response body', async () => {
  const response = await request('/', { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(Number(response.headers['content-length']), Buffer.byteLength(home));
  assert.equal(response.body, '');
});

test('serves MP4 with its media type and supports metadata HEAD requests', async () => {
  const response = await request('/demo.mp4');
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'video/mp4');
  assert.equal(response.headers['accept-ranges'], 'bytes');
  assert.equal(response.body, '0123456789abcdef');
  const head = await request('/demo.mp4', { method: 'HEAD', headers: { range: 'bytes=0-3' } });
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], '16');
  assert.equal(head.body, '');
});

test('supports bounded, open-ended and suffix video ranges for playback and seeking', async () => {
  for (const [range, body, contentRange] of [
    ['bytes=2-5', '2345', 'bytes 2-5/16'],
    ['bytes=12-', 'cdef', 'bytes 12-15/16'],
    ['bytes=-4', 'cdef', 'bytes 12-15/16'],
    ['bytes=13-100', 'def', 'bytes 13-15/16'],
  ]) {
    const response = await request('/demo.mp4', { headers: { range } });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers['content-range'], contentRange);
    assert.equal(Number(response.headers['content-length']), body.length);
    assert.equal(response.body, body);
  }
});

test('rejects invalid or unsatisfiable video ranges without terminating the server', async () => {
  for (const range of ['bytes=99-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=foo', 'bytes=0-1,4-5', 'bytes=999999999999999999999-']) {
    const response = await request('/demo.mp4', { headers: { range } });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers['content-range'], 'bytes */16');
  }
  assert.equal((await request('/')).status, 200);
});

test('blocks traversal, encoded traversal, hidden files and escaping symlinks', async () => {
  for (const target of ['/../public-private/secret.html', '/%2e%2e/public-private/secret.html', '/.env', '/outside.html']) {
    const response = await request(target);
    assert.equal(response.status, 403, target);
    assert.equal(response.body, 'Forbidden');
    assert.ok(!response.body.includes('outside public'));
  }
});

test('rejects invalid URL encoding, null bytes and backslash paths', async () => {
  for (const target of ['/%ZZ', '/%00', '/..%5cpublic-private%5csecret.html']) {
    assert.equal((await request(target)).status, 400, target);
  }
  assert.equal((await request('/')).status, 200, 'server remains available after malformed requests');
});

test('rejects write methods and handles missing files', async () => {
  const response = await request('/', { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
  assert.equal((await request('/missing.html')).status, 404);
});

test('redirects HTTP behind the production proxy to the fixed HTTPS domain', async () => {
  const response = await request('/index.html?source=test', {
    headers: { 'x-forwarded-proto': 'http', host: 'attacker.example' },
  });
  assert.equal(response.status, 308);
  assert.equal(response.headers.location, 'https://dawkoz.com/index.html?source=test');
  assert.equal(response.headers['strict-transport-security'], undefined);
});

test('serves HTTPS proxy requests without a redirect loop and sets HSTS', async () => {
  const response = await request('/', { headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(response.status, 200);
  assert.equal(response.body, home);
  assert.equal(response.headers.location, undefined);
  assert.equal(response.headers['strict-transport-security'], 'max-age=86400');
  assert.equal((await request('/')).headers['strict-transport-security'], undefined);
});

test('protects success and error responses against framing, sniffing and inline scripts', async () => {
  for (const target of ['/', '/missing.html', '/.env']) {
    const { headers } = await request(target);
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.equal(headers['referrer-policy'], 'no-referrer');
    assert.match(headers['content-security-policy'], /script-src 'self'(?:;|$)/);
    assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(headers['permissions-policy'], /microphone=\(\)/);
  }
});
