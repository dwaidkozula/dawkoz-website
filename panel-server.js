const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

module.exports = function createPanelHandler({ production }) {
  const password = process.env.DAWKOZ_PANEL_PASSWORD || '';
  const configured = password.trim().length >= 16 && password.length <= 256;
  const salt = crypto.randomBytes(32);
  const expected = configured ? scrypt(password, salt, 64) : null;
  const root = __dirname;
  const sessions = new Map();
  const attempts = new Map();
  const sessionDuration = 8 * 60 * 60 * 1000;
  const cookieName = 'dawkoz_panel_session';
  const appCsp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

  function cookie(value, secure, maxAge = sessionDuration / 1000) {
    return `${cookieName}=${value}; Path=/app; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  }
  function sessionKey(req) {
    const raw = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`));
    const token = raw ? raw.slice(cookieName.length + 1) : '';
    return /^[a-f0-9]{64}$/.test(token) ? crypto.createHash('sha256').update(token).digest('hex') : '';
  }
  function authenticated(req) {
    const key = sessionKey(req);
    const expires = sessions.get(key);
    if (expires && expires > Date.now()) return true;
    sessions.delete(key);
    return false;
  }
  function sameOrigin(req) {
    if (!req.headers.origin) return false;
    if (production) return ['https://dawkoz.com', 'https://www.dawkoz.com'].includes(req.headers.origin);
    try {
      const origin = new URL(req.headers.origin);
      return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host;
    } catch { return false; }
  }
  async function body(req) {
    return new Promise((resolve, reject) => {
      let text = '';
      let size = 0;
      let exceeded = false;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 4096) { exceeded = true; text = ''; }
        else if (!exceeded) text += chunk.toString('utf8');
      });
      req.on('end', () => exceeded ? reject(new Error('too-large')) : resolve(text));
      req.on('error', reject);
    });
  }

  return async function handlePanel(req, res, urlPath, send) {
    res.setHeader('Content-Security-Policy', appCsp + (production ? '; upgrade-insecure-requests' : ''));
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // Same-origin form POSTs need an Origin for CSRF validation. no-referrer
    // can turn their Origin into null in browsers; never send referrers off-site.
    res.setHeader('Referrer-Policy', 'same-origin');
    const secure = production || req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    const redirect = target => { res.setHeader('Location', target); send(303, ''); };
    const file = async (target, type, download) => {
      if (download) res.setHeader('Content-Disposition', `attachment; filename="${download}"`);
      send(200, await fs.readFile(target), type);
    };
    try {
      if (urlPath === '/app' || urlPath === '/app/') {
        if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(405, 'Method Not Allowed'); }
        return redirect(authenticated(req) ? '/app/documents' : '/app/login');
      }
      if (urlPath === '/app/assets/panel.css' && ['GET', 'HEAD'].includes(req.method)) {
        return await file(path.join(root, 'panel/panel.css'), 'text/css; charset=utf-8');
      }
      if (urlPath === '/app/login') {
        if (['GET', 'HEAD'].includes(req.method)) {
          if (configured && authenticated(req)) return redirect('/app/documents');
          const query = new URLSearchParams(req.url.split('?')[1] || '');
          const message = !configured ? 'Panel oczekuje na aktywację przez administratora.'
            : query.get('error') === 'credentials' ? 'Nieprawidłowe hasło. Spróbuj ponownie.' : '';
          const html = (await fs.readFile(path.join(root, 'panel/login.html'), 'utf8'))
            .replace('<!-- FEEDBACK -->', message ? `<p class="login-feedback" role="status">${message}</p>` : '')
            .replace('<!-- DISABLED -->', configured ? '' : 'disabled');
          return send(configured ? 200 : 503, html, 'text/html; charset=utf-8');
        }
        if (req.method !== 'POST') { res.setHeader('Allow', 'GET, HEAD, POST'); return send(405, 'Method Not Allowed'); }
        if (!sameOrigin(req)) { req.resume(); return send(403, 'Forbidden'); }
        if (!configured) { req.resume(); return send(503, 'Panel wymaga aktywacji.'); }
        if (!String(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) { req.resume(); return send(415, 'Unsupported Media Type'); }
        const now = Date.now();
        for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
        const address = req.socket.remoteAddress || 'unknown';
        const record = attempts.get(address) || { count: 0, until: now + 15 * 60 * 1000 };
        if (record.count >= 5) {
          req.resume();
          res.setHeader('Retry-After', String(Math.ceil((record.until - now) / 1000)));
          return send(429, 'Zbyt wiele prób. Spróbuj ponownie później.');
        }
        if (attempts.size >= 1000 && !attempts.has(address)) { req.resume(); return send(429, 'Spróbuj ponownie później.'); }
        record.count += 1;
        attempts.set(address, record);
        const form = new URLSearchParams(await body(req));
        const candidate = form.get('password') || '';
        const hash = await scrypt(candidate.slice(0, 257), salt, 64);
        if (candidate.length > 256 || !crypto.timingSafeEqual(hash, await expected)) return redirect('/app/login?error=credentials');
        attempts.delete(address);
        for (const [key, expiry] of sessions) if (expiry <= now) sessions.delete(key);
        if (sessions.size >= 25) sessions.delete(sessions.keys().next().value);
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(crypto.createHash('sha256').update(token).digest('hex'), now + sessionDuration);
        res.setHeader('Set-Cookie', cookie(token, secure));
        return redirect('/app/documents');
      }
      if (urlPath === '/app/logout') {
        if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, 'Method Not Allowed'); }
        req.resume();
        if (!sameOrigin(req)) return send(403, 'Forbidden');
        sessions.delete(sessionKey(req));
        res.setHeader('Set-Cookie', cookie('', secure, 0));
        return redirect('/app/login');
      }
      if (!authenticated(req)) {
        if (urlPath.startsWith('/app/api/') || urlPath.startsWith('/app/templates/') || urlPath.startsWith('/app/guide/')) return send(401, 'Wymagane logowanie.');
        return redirect('/app/login');
      }
      if (!['GET', 'HEAD'].includes(req.method)) { req.resume(); res.setHeader('Allow', 'GET, HEAD'); return send(405, 'Method Not Allowed'); }
      const assets = {
        '/app/documents': ['panel/documents.html', 'text/html; charset=utf-8'],
        '/app/guide': ['panel/guide.html', 'text/html; charset=utf-8'],
        '/app/assets/panel.js': ['panel/panel.js', 'text/javascript; charset=utf-8'],
        '/app/assets/docx.js': ['panel/docx.js', 'text/javascript; charset=utf-8'],
        '/app/assets/guide.css': ['panel/guide.css', 'text/css; charset=utf-8'],
        '/app/assets/guide.js': ['panel/guide.js', 'text/javascript; charset=utf-8'],
        '/app/api/templates': ['documents/catalog.json', 'application/json; charset=utf-8'],
      };
      if (assets[urlPath]) return await file(path.join(root, assets[urlPath][0]), assets[urlPath][1]);
      if (urlPath === '/app/guide/manual.pdf') return await file(path.join(root, 'manual/generated/dawkoz-instrukcja-realizacji-zamowien.pdf'), 'application/pdf', 'dawkoz-instrukcja-realizacji-zamowien.pdf');
      if (urlPath === '/app/guide/bot-technical.pdf') return await file(path.join(root, 'manual/generated/dawkoz-instrukcja-techniczna-bota.pdf'), 'application/pdf', 'dawkoz-instrukcja-techniczna-bota.pdf');
      if (urlPath === '/app/guide/bot-starter.zip') return await file(path.join(root, 'manual/generated/dawkoz-bot-starter.zip'), 'application/zip', 'dawkoz-bot-starter.zip');
      const guideImage = /^\/app\/guide\/images\/([a-z0-9-]+\.(png|webp))$/.exec(urlPath);
      if (guideImage) {
        const images = new Set(['panel-library.png', 'panel-preset.png', 'panel-fields.png', 'panel-export.png', 'public-offers.png', 'client-demo.png', 'guide-navigation.png', 'bot-demo.png']);
        if (!images.has(guideImage[1])) return send(404, '404');
        return await file(path.join(root, 'manual/assets', guideImage[1]), guideImage[2] === 'png' ? 'image/png' : 'image/webp');
      }
      if (urlPath === '/app/templates/package.zip') return await file(path.join(root, 'documents/generated/dawkoz-wzory-dokumentow.zip'), 'application/zip', 'dawkoz-wzory-dokumentow.zip');
      const download = /^\/app\/templates\/([a-z-]+)\.(pdf|docx|md)$/.exec(urlPath);
      if (download) {
        const catalog = JSON.parse(await fs.readFile(path.join(root, 'documents/catalog.json'), 'utf8'));
        if (!catalog.templates.some(item => item.id === download[1])) return send(404, '404');
        const filename = `${download[1]}.${download[2]}`;
        const type = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', md: 'text/markdown; charset=utf-8' }[download[2]];
        return await file(path.join(root, 'documents/generated', filename), type, filename);
      }
      return send(404, '404');
    } catch (error) {
      if (error.code === 'ENOENT') return send(404, '404');
      return send(error.message === 'too-large' ? 413 : 500, error.message === 'too-large' ? 'Żądanie jest zbyt duże.' : 'Nie udało się obsłużyć panelu.');
    }
  };
};
