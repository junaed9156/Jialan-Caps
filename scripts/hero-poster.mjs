// Photographs the hero's first 3D frame as the posters the page paints before WebGL is ready
// (and keeps as the no-WebGL fallback). Run after changing src/3d/hero.js, kit.js or sequence.js:
//
//   npm run build:3d
//   npm i --no-save playwright-core && pip install --break-system-packages pillow
//   CHROME=/path/to/chrome node scripts/hero-poster.mjs
//
// Wide panels keep the scene's height fixed and portrait panels keep its width (see hero.js `distance`),
// so the wide poster is shot at aspect 1.4 (shown height-fit) and the tall one at 0.66 (shown width-fit).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const POSTERS = [
  { name: 'hero-poster-wide', width: 1680, height: 1200 },
  { name: 'hero-poster-tall', width: 800, height: 1212 },
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = path.endsWith('/') || path.endsWith('\\') ? path + 'index.html' : path;
    const body = await readFile(join('dist', file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  for (const poster of POSTERS) {
    const page = await browser.newPage({ viewport: { width: poster.width + 200, height: poster.height + 400 }, deviceScaleFactor: 1 });
    // Freeze the clock the moment the scene first draws: that frame (pose 0, ambient 0) is the poster.
    await page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.documentElement.dataset.heroState === 'ready') document.body.classList.add('motion-paused');
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-hero-state'] });   // <html> may not exist yet
    });
    await page.goto(origin + '/', { waitUntil: 'load' });
    await page.addStyleTag({ content: `
      .hero-scene { width: ${poster.width}px !important; height: ${poster.height}px !important; min-height: 0 !important;
        max-width: none !important; flex: none !important; border: 0 !important; background: #101f2a !important; }
      .hero { display: block !important; } .hero-copy { display: none !important; }
      .hero-scene > :not(canvas) { visibility: hidden !important; } .hero-scene::after { display: none !important; }
      .hero-canvas { transition: none !important; }` });
    await page.waitForFunction(() => document.documentElement.dataset.heroState === 'ready', null, { timeout: 120000 });
    await page.waitForTimeout(400);
    const canvas = page.locator('.hero-canvas');
    const box = await canvas.boundingBox();
    if (Math.abs(box.width - poster.width) > 1 || Math.abs(box.height - poster.height) > 1) throw new Error(`${poster.name}: canvas is ${box.width}×${box.height}`);
    const png = `dist/assets/${poster.name}.png`;
    await canvas.screenshot({ path: png });
    execFileSync('python3', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");im.save(sys.argv[2],"WEBP",quality=82,method=6);import os;os.remove(sys.argv[1])', png, png.replace(/\.png$/, '.webp')]);
    console.log('wrote', png.replace(/\.png$/, '.webp'));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
