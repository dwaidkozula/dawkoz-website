const http = require('http');
const fs = require('fs');
const path = require('path');
const { renderPage, resolveLocale } = require('./i18n');
const port = process.env.PORT || 3000;
const publicRoot = path.join(__dirname, 'public');
const production = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
const handlePanel = require('./panel-server')({ production });
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
};
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  // The animation script and the no-JavaScript layout use inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  ...(production ? ['upgrade-insecure-requests'] : []),
].join('; ');

function insidePublic(file) {
  const relative = path.relative(publicRoot, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Railway terminates TLS and supplies the original connection protocol.
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (production && forwardedProtocol === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=86400');
  }

  function send(status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    req.resume();
    return send(405, 'Method Not Allowed');
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    return send(400, 'Bad Request');
  }
  if (!urlPath.startsWith('/') || urlPath.includes('\0') || urlPath.includes('\\')) {
    return send(400, 'Bad Request');
  }
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.resolve(publicRoot, `.${urlPath}`);
  if (!insidePublic(file) || urlPath.split('/').some(segment => segment.startsWith('.'))) {
    return send(403, 'Forbidden');
  }

  if (production && forwardedProtocol === 'http') {
    // Use the site's known hostname rather than a user-supplied Host header.
    res.setHeader('Location', `https://dawkoz.com${req.url}`);
    return send(308, 'Redirecting to HTTPS');
  }

  if (urlPath === '/app' || urlPath.startsWith('/app/')) return handlePanel(req, res, urlPath, send);
  if (req.method === 'POST') {
    req.resume();
    res.setHeader('Allow', 'GET, HEAD');
    return send(405, 'Method Not Allowed');
  }

  try {
    const realFile = await fs.promises.realpath(file);
    if (!insidePublic(realFile)) return send(403, 'Forbidden');
    const stat = await fs.promises.stat(realFile);
    if (!stat.isFile()) return send(404, '404');
    const type = types[path.extname(realFile)] || 'application/octet-stream';
    if (type === 'video/mp4') {
      res.setHeader('Accept-Ranges', 'bytes');
      let start = 0;
      let end = stat.size - 1;
      let status = 200;
      if (req.method === 'GET' && req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range.trim());
        if (range && (range[1] || range[2])) {
          if (range[1]) {
            start = Number(range[1]);
            end = range[2] ? Number(range[2]) : end;
          } else {
            const suffix = Number(range[2]);
            start = Number.isSafeInteger(suffix) && suffix > 0 ? Math.max(0, stat.size - suffix) : -1;
          }
        } else {
          start = -1;
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= stat.size || end < start) {
          res.setHeader('Content-Range', `bytes */${stat.size}`);
          return send(416, 'Range Not Satisfiable');
        }
        end = Math.min(end, stat.size - 1);
        status = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Math.max(0, end - start + 1) });
      if (req.method === 'HEAD' || stat.size === 0) return res.end();
      const stream = fs.createReadStream(realFile, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
      return;
    }
    const data = await fs.promises.readFile(realFile);
    if (path.extname(realFile) === '.html') {
      const locale = resolveLocale(new URLSearchParams(req.url.split('?')[1] || '').get('lang'));
      send(200, renderPage(data.toString('utf8'), locale, path.basename(realFile)), type);
    } else send(200, data, type);
  } catch {
    send(404, '404');
  }
});

server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.maxHeadersCount = 100;
server.listen(port, '0.0.0.0', () => console.log(`DAWKOZ website listening on ${server.address().port}`));
