// The admin's website edits: site-content.json applied to a copy of dist/ by apply-content.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, copyFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyContent, DEFAULTS, IMAGES } from './apply-content.mjs';

const dist = new URL('../dist/', import.meta.url).pathname;
const read = (dir, f) => readFileSync(join(dir, f), 'utf8');

test('every original contact detail the admin can change is present in the source page', () => {
  const html = read(dist, 'index.html');
  for (const v of [DEFAULTS.email, DEFAULTS.whatsapp, DEFAULTS.whatsapp.replace(/\D/g, ''), DEFAULTS.wechat, DEFAULTS.company_en, DEFAULTS.catalogue,
    'No. 1 Fumin Road, Chengbei Industrial Park,<br>Jingjiang City, Taizhou, Jiangsu Province, China', DEFAULTS.address_en,
    'No.+1+Fumin+Road,+Chengbei+Industrial+Park,+Jingjiang,+Jiangsu,+China']) assert.ok(html.includes(v), `index.html no longer contains ${v}`);
  for (const img of IMAGES) assert.ok(html.includes(img.src), `${img.src} is no longer used by index.html`);
  assert.ok(read(dist, 'zh.html').includes(DEFAULTS.address_zh));
  assert.doesNotThrow(() => JSON.parse(read(dist, 'site-content.json')));
});

test('with no edits the published copy is byte-for-byte the build', async () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  try {
    await applyContent({ from: dist, to: out, content: {} });
    for (const f of ['index.html', 'zh.html', 'products.js', 'site.js', '404.html']) assert.equal(read(out, f), read(dist, f), f);
    const base = JSON.parse(read(out, 'admin/content-base.json'));
    assert.ok(base.texts.length > 150 && base.products.length > 10 && base.images.length === IMAGES.length);
    assert.ok(!base.texts.some(t => t.key.includes(DEFAULTS.email)), 'contact details are edited in their own form');
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('contact, text, products, pictures and the PDF are applied to both languages', async () => {
  const src = mkdtempSync(join(tmpdir(), 'dist-')), out = mkdtempSync(join(tmpdir(), 'site-'));
  try {
    cpSync(dist, src, { recursive: true, filter: p => !p.endsWith('.pdf') && !p.includes('/assets/p/') });
    mkdirSync(join(src, 'assets/site'), { recursive: true });
    copyFileSync(join(dist, 'assets/hero-gold.webp'), join(src, 'assets/site/collection-1.webp'));
    writeFileSync(join(src, 'assets/site/catalogue-1.pdf'), '%PDF-1.4');
    const content = {
      contact: { email: 'sales@example.cn', whatsapp: '+86 139 0000 1111', wechat: 'maohan_sales', company_en: 'Maohan & Co. Ltd.', company_zh: '茂涵公司',
        address_en: 'No. 8 Test Road, Jingjiang, China', address_zh: '中国靖江测试路 8 号' },
      catalogue: 'assets/site/catalogue-1.pdf',
      text: { 'Precision in every detail.': { en: 'Made to the last detail.', zh: '细节至上。' }, 'MAO HAN': { en: 'MAO HAN PRO' }, 'Bogus <script>': { en: 'x' } },
      images: { 'assets/collection.webp': 'assets/site/collection-1.webp', 'assets/favicon.png': 'assets/site/nope.png', 'assets/evil.webp': 'assets/site/collection-1.webp' },
      products: { order: ['jl35'], edits: { jl30: { hidden: true }, wl100: { name: 'The icon', name_zh: '标志款', badge: 'HOT', badge_zh: '热卖' } } },
    };
    await applyContent({ from: src, to: out, content });
    const en = read(out, 'index.html'), zh = read(out, 'zh.html'), js = read(out, 'site.js');
    for (const page of [en, zh]) {
      for (const gone of [DEFAULTS.email, DEFAULTS.wechat, DEFAULTS.whatsapp, 'Fumin', DEFAULTS.catalogue, 'assets/collection.webp']) assert.ok(!page.includes(gone), `still shows ${gone}`);
      for (const shown of ['sales@example.cn', 'wa.me/8613900001111', '+86 139 0000 1111', 'maohan_sales', 'assets/site/catalogue-1.pdf', 'assets/site/collection-1.webp', 'MAO HAN PRO', 'assets/favicon.png']) assert.ok(page.includes(shown), `missing ${shown}`);
    }
    assert.ok(en.includes('Made to the last detail.') && en.includes('No. 8 Test Road, Jingjiang, China') && en.includes('Maohan &amp; Co. Ltd.'));
    assert.ok(zh.includes('细节至上。') && zh.includes('中国靖江测试路 8 号') && zh.includes('茂涵公司'));
    const ld = JSON.parse(en.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld.name, 'Maohan & Co. Ltd.'); assert.equal(ld.email, 'sales@example.cn'); assert.equal(ld.address.streetAddress, 'No. 8 Test Road, Jingjiang, China');
    assert.ok(!js.includes(DEFAULTS.email) && js.includes('sales@example.cn') && /["'`]maohan_sales["'`]/.test(js) && js.includes('8613900001111'));
    const data = JSON.parse(read(out, 'products.js').replace(/^[\s\S]*?window\.JIALAN = /, '').replace(/;\s*$/, ''));
    assert.equal(data.pdf, 'assets/site/catalogue-1.pdf');
    assert.equal(data.products[0].id, 'jl35'); assert.ok(!data.products.some(p => p.id === 'jl30'));
    assert.deepEqual(['name', 'name_zh', 'badge', 'badge_zh'].map(k => data.products[1][k]), ['The icon', '标志款', 'HOT', '热卖']);
    assert.match(en, /src="site\.js\?v=(\w+)"/); assert.notEqual(en.match(/src="site\.js\?v=(\w+)"/)[1], read(dist, 'index.html').match(/src="site\.js\?v=(\w+)"/)[1], 'changed scripts get a new version');
  } finally { rmSync(src, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); }
});

test('the admin page has every element its script uses', () => {
  const html = read(dist, 'admin/index.html'), js = read(dist, 'admin/admin.js');
  const ids = new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]));
  for (const id of ids) {
    if (/^c-$/.test(id)) continue;
    assert.ok(html.includes(`id="${id}"`), `admin/index.html is missing #${id}`);
  }
  for (const f of ['email', 'whatsapp', 'wechat', 'company_en', 'company_zh', 'address_en', 'address_zh']) assert.ok(html.includes(`id="c-${f}"`));
});
