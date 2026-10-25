'use strict';

// Development-only screenshots of the real local interface. No production login.
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

function playwright() {
  try { return require('playwright'); }
  catch {
    return require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  }
}

const root = path.join(__dirname, '..');
const out = path.join(root, 'manual/assets');
const { chromium } = playwright();

async function startServer() {
  const password = crypto.randomBytes(30).toString('base64url');
  const env = { ...process.env, NODE_ENV: 'development', PORT: '0', DAWKOZ_PANEL_PASSWORD: password };
  delete env.RAILWAY_ENVIRONMENT_ID;
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Local screenshot server did not start')), 10000);
    server.stdout.on('data', data => {
      output += data;
      const match = output.match(/listening on (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', () => { clearTimeout(timer); reject(new Error('Local screenshot server exited')); });
  });
  return { server, password, base: `http://127.0.0.1:${port}` };
}

async function clearAnnotations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-guide-annotation]').forEach(node => node.remove());
    document.querySelectorAll('[data-guide-highlight]').forEach(node => {
      node.style.outline = '';
      node.style.outlineOffset = '';
      node.removeAttribute('data-guide-highlight');
    });
  });
}

async function annotate(page, entries) {
  await clearAnnotations(page);
  for (const [selector, number, placement = 'left'] of entries) {
    const locator = page.locator(selector).first();
    if (!(await locator.isVisible())) throw new Error(`Screenshot target is not visible: ${selector}`);
    await locator.evaluate((target, { number, placement }) => {
      const box = target.getBoundingClientRect();
      target.dataset.guideHighlight = 'true';
      target.style.outline = '3px solid #235fd1';
      target.style.outlineOffset = '3px';
      const badge = document.createElement('span');
      badge.dataset.guideAnnotation = 'true';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = String(number);
      const x = placement === 'right' ? box.right - 12 : box.left - 12;
      Object.assign(badge.style, {
        position: 'fixed', left: `${Math.max(5, x)}px`, top: `${Math.max(5, box.top - 13)}px`,
        width: '27px', height: '27px', display: 'grid', placeItems: 'center', borderRadius: '50%',
        background: '#1b53b8', color: '#fff', border: '2px solid #fff', boxShadow: '0 2px 7px #10234855',
        font: '700 14px/1 Arial,sans-serif', zIndex: '10000', pointerEvents: 'none',
      });
      document.body.append(badge);
    }, { number, placement });
  }
}

async function screenshot(page, name, clip) {
  await page.screenshot({ path: path.join(out, name), clip, animations: 'disabled' });
  const stat = await fs.stat(path.join(out, name));
  if (stat.size > 500 * 1024) throw new Error(`${name} is unnecessarily large`);
  console.log(`${name}: ${Math.round(stat.size / 1024)} KB`);
}

async function main() {
  await fs.mkdir(out, { recursive: true });
  const local = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1400, height: 1050 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${local.base}/app/login`);
    await page.locator('#password').fill(local.password);
    await Promise.all([page.waitForURL('**/app/documents'), page.locator('button[type="submit"]').click()]);
    await page.locator('.template-card').first().waitFor();
    await annotate(page, [
      ['#search', 1],
      ['.template-card:first-child .use-template', 2],
      ['a[href="/app/templates/package.zip"]', 3, 'right'],
    ]);
    await screenshot(page, 'panel-library.png', { x: 230, y: 0, width: 1170, height: 760 });

    await clearAnnotations(page);
    await page.getByRole('button', { name: 'Użyj wzoru: Oferta wdrożenia', exact: true }).click();
    await page.locator('#offer-preset').selectOption('bot');
    await annotate(page, [['#offer-preset', 1], ['#apply-offer-preset', 2, 'right']]);
    await screenshot(page, 'panel-preset.png', { x: 245, y: 110, width: 1135, height: 410 });
    await clearAnnotations(page);
    await page.locator('#apply-offer-preset').click();
    await page.locator('#field-client_name').evaluate(node => { node.closest('details').open = true; });
    await page.locator('#field-client_name').fill('Klient DEMO');
    await page.locator('#field-reference').evaluate(node => {
      const details = node.closest('details');
      details.open = true;
    });
    await page.locator('#field-reference').fill('DEMO-001');
    await page.locator('#field-project_name').fill('Przykładowe wdrożenie AI');
    await page.locator('#field-client_name').evaluate(node => { node.closest('details').open = false; });
    await page.evaluate(() => window.scrollTo(0, 380));
    await annotate(page, [['#field-project_name', 1], ['#document-preview', 2, 'right']]);
    await screenshot(page, 'panel-fields.png', { x: 245, y: 80, width: 1135, height: 790 });

    await clearAnnotations(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await annotate(page, [
      ['#save-project', 1], ['#download-word', 2], ['#print-document', 3, 'right'], ['#import-project', 4],
    ]);
    await screenshot(page, 'panel-export.png', { x: 245, y: 0, width: 1135, height: 570 });

    const publicPage = await context.newPage();
    await publicPage.goto(`${local.base}/?lang=pl#offer`);
    await publicPage.locator('.offer-carousel.is-enhanced').waitFor();
    await publicPage.locator('.offer-carousel-controls').scrollIntoViewIfNeeded();
    await annotate(publicPage, [['[data-offer-more]', 1], ['[data-offer-next]', 2, 'right']]);
    const controlBox = await publicPage.locator('.offer-carousel-controls').boundingBox();
    await screenshot(publicPage, 'public-offers.png', { x: 110, y: Math.max(0, controlBox.y - 25), width: 1180, height: 650 });

    await publicPage.goto(`${local.base}/panel-klienta.html`);
    await publicPage.locator('.request-row').first().waitFor();
    await annotate(publicPage, [['#tab-requests', 1], ['#tab-documents', 2], ['#tab-usage', 3]]);
    await screenshot(publicPage, 'client-demo.png', { x: 0, y: 55, width: 1400, height: 820 });
    if (errors.length) throw new Error(`Screenshot page errors: ${errors.join('; ')}`);
    console.log('Six real-interface screenshots captured using synthetic sample data.');
  } finally {
    if (browser) await browser.close();
    if (local.server.exitCode === null) {
      const stopped = once(local.server, 'exit');
      local.server.kill();
      await stopped;
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
