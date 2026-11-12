// Applies the admin's website edits (dist/site-content.json) to a copy of dist/ that is published.
//
//   node scripts/apply-content.mjs                 # dist/ → _site/ (what the Pages workflow uploads)
//   node scripts/apply-content.mjs --to preview    # local preview: serve the folder it writes
//
// dist/ itself is never changed, so the committed page stays the pristine source of every text,
// and an edit can be changed or reset any number of times. The admin page reads the list of
// editable texts, products and images from admin/content-base.json, which this script writes.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { collectSegments, encodeAttr, loadTranslator, renderChinese, rewrite } from './page-text.mjs';

// The contact details exactly as the source page states them. A test checks they are all present.
export const DEFAULTS = {
  email: 'helens@vip.163.com',
  whatsapp: '+86 138 1295 0775',
  wechat: '13812950775',
  company_en: 'Suzhou Maohan Metal Products Co., Ltd.',
  company_zh: '',
  address_en: 'No. 1 Fumin Road, Chengbei Industrial Park, Jingjiang City, Taizhou, Jiangsu Province, China',
  address_zh: '中国江苏省泰州市靖江市城北工业园区富民路 1 号',
  catalogue: 'assets/maohan-catalogue-2026.pdf',
};
// How those details are written in the page, besides their plain form.
const SOURCE = {
  addressSplit: 'No. 1 Fumin Road, Chengbei Industrial Park,<br>Jingjiang City, Taizhou, Jiangsu Province, China',
  addressSplitZh: '中国江苏省泰州市靖江市<br>城北工业园区富民路 1 号',
  addressMap: 'No.+1+Fumin+Road,+Chengbei+Industrial+Park,+Jingjiang,+Jiangsu,+China',
  addressParts: ['No. 1 Fumin Road', 'Jingjiang City, Taizhou', '中国江苏省泰州市靖江市', '城北工业园区富民路'],
};
// Pictures the admin may replace. Photos are cropped to fill; logos and icons are fitted whole.
export const IMAGES = [
  { src: 'assets/collection.webp', label: 'Made personal banner (also the scroll-story picture without 3D)', fit: 'cover' },
  { src: 'assets/hero-gold.webp', label: '3D studio picture (shown where 3D is unavailable)', fit: 'cover' },
  { src: 'assets/maohan-mark-96.png', label: 'Header logo mark', fit: 'contain' },
  { src: 'assets/maohan-logo-300.png', label: 'Footer logo', fit: 'contain' },
  { src: 'assets/maohan-logo.png', label: 'Logo for search engines and link previews', fit: 'contain' },
  { src: 'assets/favicon.png', label: 'Browser tab icon', fit: 'contain' },
  { src: 'assets/apple-touch-icon.png', label: 'Phone home-screen icon', fit: 'contain' },
];
const PRODUCT_FIELDS = ['name', 'name_zh', 'description', 'description_zh', 'badge', 'badge_zh'];
const LIMITS = { name: 80, name_zh: 80, description: 600, description_zh: 600, badge: 24, badge_zh: 24 };

const tidy = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, max);
const warn = msg => console.warn('apply-content:', msg);

// Everything in site-content.json is checked; anything unusable is skipped with a warning.
export function sanitize(raw, { exists = () => true } = {}) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const out = { contact: { ...DEFAULTS }, text: {}, images: {}, products: { order: [], edits: {} } };
  const k = c.contact || {};
  if (k.email !== undefined) {
    const v = tidy(k.email, 120);
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v)) out.contact.email = v; else warn('invalid email skipped');
  }
  if (k.whatsapp !== undefined) {
    const v = tidy(k.whatsapp, 30);
    if (/^\+?[0-9][0-9 ()-]{5,24}$/.test(v) && v.replace(/\D/g, '').length >= 7) out.contact.whatsapp = v; else warn('invalid WhatsApp number skipped');
  }
  if (k.wechat !== undefined) {
    const v = tidy(k.wechat, 40);
    if (/^[A-Za-z0-9_-]{3,40}$/.test(v)) out.contact.wechat = v; else warn('invalid WeChat ID skipped');
  }
  for (const f of ['company_en', 'company_zh', 'address_en', 'address_zh']) {
    if (k[f] === undefined) continue;
    const v = tidy(k[f], 200);
    if (/[<>"\\]/.test(v)) warn(`${f} contains < > " or \\ and was skipped`);
    else if (v || f === 'company_zh') out.contact[f] = v;
  }
  if (typeof c.catalogue === 'string') {
    if (/^assets\/site\/[\w-]+\.pdf$/.test(c.catalogue) && exists(c.catalogue)) out.contact.catalogue = c.catalogue;
    else warn('catalogue file missing or not an admin upload; the original PDF is kept');
  }
  for (const [key, v] of Object.entries(c.text || {})) {
    if (typeof key !== 'string' || key.length > 2000 || !v || typeof v !== 'object') continue;
    const en = tidy(v.en, 2000), zh = tidy(v.zh, 2000);
    if (en || zh) out.text[key] = { ...(en ? { en } : {}), ...(zh ? { zh } : {}) };
  }
  const editable = new Set(IMAGES.map(i => i.src));
  for (const [from, to] of Object.entries(c.images || {})) {
    if (!editable.has(from)) { warn(`image ${from} is not replaceable`); continue; }
    if (typeof to === 'string' && /^assets\/site\/[\w-]+\.(?:webp|png|jpg)$/.test(to) && exists(to)) out.images[from] = to;
    else warn(`replacement for ${from} missing; the original is kept`);
  }
  const p = c.products || {};
  if (Array.isArray(p.order)) out.products.order = p.order.filter(id => typeof id === 'string').slice(0, 500);
  for (const [id, e] of Object.entries(p.edits || {})) {
    if (!e || typeof e !== 'object') continue;
    const edit = {};
    if (e.hidden === true) edit.hidden = true;
    for (const f of PRODUCT_FIELDS) if (typeof e[f] === 'string') { const v = tidy(e[f], LIMITS[f]); if (v) edit[f] = v; }
    if (Object.keys(edit).length) out.products.edits[id] = edit;
  }
  return out;
}

// Replace several literal strings at once, longest first, so one value never edits another
// (the WeChat ID is part of the WhatsApp number, for example).
function replaceAll(text, pairs) {
  const list = pairs.filter(([from]) => from).sort((a, b) => b[0].length - a[0].length);
  list.forEach(([from], i) => { text = text.split(from).join(`\uE000${i}\uE001`); });
  return text.replace(/\uE000(\d+)\uE001/g, (m, i) => list[+i][1]);
}

function contactPairs(c, lang) {
  const d = DEFAULTS, html = s => encodeAttr(s);
  // Unchanged details keep their exact original markup (line breaks, map link); they are still
  // listed so that a longer value is never partly rewritten by a shorter one.
  const same = (from, changed, to) => [from, changed ? to : from];
  const enChanged = c.address_en !== d.address_en, zhChanged = c.address_zh !== d.address_zh;
  const address = lang === 'zh' ? (zhChanged ? c.address_zh : c.address_en) : c.address_en;
  const addressChanged = lang === 'zh' ? zhChanged || enChanged : enChanged;
  const company = lang === 'zh' ? (c.company_zh || c.company_en) : c.company_en;
  const pairs = [
    same(d.email, c.email !== d.email, html(c.email)),
    same(d.whatsapp.replace(/\D/g, ''), c.whatsapp !== d.whatsapp, c.whatsapp.replace(/\D/g, '')),
    same(d.whatsapp, c.whatsapp !== d.whatsapp, html(c.whatsapp)),
    same(d.wechat, c.wechat !== d.wechat, html(c.wechat)),
    same(SOURCE.addressSplit, lang === 'zh' ? addressChanged : enChanged, html(lang === 'zh' ? address : c.address_en)),
    same(d.address_en, lang === 'zh' ? addressChanged : enChanged, html(lang === 'zh' ? address : c.address_en)),
    same(SOURCE.addressMap, enChanged, encodeURIComponent(c.address_en).replace(/%20/g, '+')),
    same(d.company_en, company !== d.company_en, html(company)),
    same(d.catalogue, c.catalogue !== d.catalogue, c.catalogue),
  ];
  if (lang === 'zh') pairs.push(same(SOURCE.addressSplitZh, addressChanged, html(address)), same(d.address_zh, addressChanged, html(address)));
  return pairs;
}
// JavaScript and data files only get values made of safe characters (no quotes to escape).
function scriptPairs(c, images) {
  const d = DEFAULTS;
  return [
    [d.email, c.email],
    [d.whatsapp.replace(/\D/g, ''), c.whatsapp.replace(/\D/g, '')],
    [d.whatsapp, c.whatsapp],
    [d.wechat, c.wechat],
    [d.catalogue, c.catalogue],
    ...Object.entries(images),
  ];
}

// The search-engine description of the company, rebuilt from the current details.
function updateStructuredData(html, c, lang, images) {
  return html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (m, open, body, close) => {
    let data;
    try { data = JSON.parse(body); } catch { return m; }
    const before = JSON.stringify(data);
    data.name = lang === 'zh' ? (c.company_zh || c.company_en) : c.company_en;
    data.email = c.email;
    data.telephone = c.whatsapp;
    if (c.address_en !== DEFAULTS.address_en) data.address = { '@type': 'PostalAddress', streetAddress: c.address_en, addressCountry: 'CN' };
    if (typeof data.logo === 'string') for (const [from, to] of Object.entries(images)) data.logo = data.logo.replace(from, to);
    if (JSON.stringify(data) === before) return m;
    return open + JSON.stringify(data).replace(/</g, '\\u003c') + close;
  });
}
function withoutStructuredData(html, fn) {
  const block = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/);
  if (!block) return fn(html);
  const token = '\uE100structured-data\uE101';
  return fn(html.replace(block[0], token)).replace(token, block[0]);
}

const managed = key => [DEFAULTS.email, DEFAULTS.whatsapp, DEFAULTS.wechat, ...SOURCE.addressParts].some(v => key.includes(v));

function parseProducts(text) {
  const i = text.indexOf('window.JIALAN = ');
  if (i < 0) throw new Error('products.js has an unexpected format');
  const start = text.indexOf('{', i), end = text.lastIndexOf('}');
  return { head: text.slice(0, i), data: JSON.parse(text.slice(start, end + 1)) };
}
export function applyProducts(data, products) {
  const list = data.products.slice();
  const pos = new Map(products.order.map((id, n) => [id, n]));
  list.sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6 + data.products.indexOf(a)) - (pos.has(b.id) ? pos.get(b.id) : 1e6 + data.products.indexOf(b)));
  data.products = list.filter(p => !(products.edits[p.id] && products.edits[p.id].hidden)).map(p => {
    const e = products.edits[p.id];
    if (!e) return p;
    const q = { ...p };
    for (const f of PRODUCT_FIELDS) if (e[f]) q[f] = e[f];
    return q;
  });
  return data;
}

async function versionAssets(dir, html) {
  for (const m of [...html.matchAll(/\b(src|href)="([\w./-]+\.(?:js|css))\?v=[\w-]+"/g)]) {
    let bytes;
    try { bytes = await readFile(join(dir, m[2])); } catch { continue; }
    const v = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    html = html.split(m[0]).join(`${m[1]}="${m[2]}?v=${v}"`);
  }
  return html;
}

export async function applyContent({ from = 'dist', to = '_site', content } = {}) {
  const exists = async p => { try { return (await stat(join(from, p))).isFile(); } catch { return false; } };
  let raw = content;
  if (raw === undefined) {
    try { raw = JSON.parse(await readFile(join(from, 'site-content.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') warn(`site-content.json unreadable (${e.message}); publishing without edits`); raw = {}; }
  }
  // File checks need to be synchronous inside sanitize, so look them up first.
  const wanted = [raw && raw.catalogue, ...Object.values((raw && raw.images) || {})].filter(v => typeof v === 'string');
  const present = new Set();
  for (const p of wanted) if (await exists(p)) present.add(p);
  const c = sanitize(raw, { exists: p => present.has(p) });

  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  const source = await readFile(join(from, 'index.html'), 'utf8');
  const tr = await loadTranslator(join(from, 'i18n.js'));
  const textEdit = (key, lang, ctx) => {
    const e = c.text[key];
    if (!e) return null;
    // Names the Chinese page also shows in English (MAO HAN, model codes) follow the English edit.
    if (lang === 'zh') return e.zh || (ctx.keep || tr(key) === key ? e.en : null) || null;
    return e.en || null;
  };

  // English page and the pre-translated Chinese page, both from the pristine source.
  let en = rewrite(source, { onText: (k, ctx) => textEdit(k, 'en', ctx), onAttr: (n, k, ctx) => textEdit(k, 'en', ctx) });
  let zh = renderChinese(source, tr, (k, ctx) => textEdit(k, 'zh', ctx));
  const imagePairs = Object.entries(c.images);
  en = withoutStructuredData(en, h => replaceAll(h, [...contactPairs(c.contact, 'en'), ...imagePairs]));
  zh = withoutStructuredData(zh, h => replaceAll(h, [...contactPairs(c.contact, 'zh'), ...imagePairs]));
  en = updateStructuredData(en, c.contact, 'en', c.images);
  zh = updateStructuredData(zh, c.contact, 'zh', c.images);

  // Scripts, data and the 404 page.
  const sp = scriptPairs(c.contact, c.images);
  for (const file of await readdir(to)) {
    if (!/\.js$/.test(file) || file === 'products.js') continue;
    const text = await readFile(join(to, file), 'utf8');
    const next = replaceAll(text, sp);
    if (next !== text) await writeFile(join(to, file), next);
  }
  try {
    const page = await readFile(join(to, '404.html'), 'utf8');
    await writeFile(join(to, '404.html'), replaceAll(page, [...contactPairs(c.contact, 'en'), ...imagePairs]));
  } catch { /* no 404 page */ }
  const { head, data } = parseProducts(await readFile(join(from, 'products.js'), 'utf8'));
  const baseProducts = JSON.parse(JSON.stringify(data.products));
  applyProducts(data, c.products);
  const productsJs = replaceAll(`${head}window.JIALAN = ${JSON.stringify(data, null, 1).replace(/</g, '\\u003c')};\n`, sp);
  await writeFile(join(to, 'products.js'), productsJs);

  await writeFile(join(to, 'index.html'), await versionAssets(to, en));
  await writeFile(join(to, 'zh.html'), await versionAssets(to, zh));

  // What the admin page can edit, with the original English and Chinese of each item.
  const zhOf = s => (s ? tr(s) : '');
  const texts = collectSegments(source).filter(s => !managed(s.key)).map(s => ({ key: s.key, zh: s.keep ? s.key : zhOf(s.key), group: s.group, kind: s.kind, keep: s.keep || undefined }));
  const base = {
    generated: new Date().toISOString(),
    defaults: DEFAULTS,
    texts,
    images: IMAGES,
    products: baseProducts.map(p => ({
      id: p.id, model: p.model, category: p.category, image: p.images && p.images[0], source: p.source,
      name: p.name || '', name_zh: p.name_zh || zhOf(p.name), description: p.description || '', description_zh: p.description_zh || zhOf(p.description),
      badge: p.badge || '', badge_zh: p.badge ? zhOf(p.badge) : '',
    })),
    categories: data.categories,
  };
  await mkdir(join(to, 'admin'), { recursive: true });
  await writeFile(join(to, 'admin', 'content-base.json'), JSON.stringify(base));
  return { content: c, base };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const { content } = await applyContent({ from: arg('--from') || 'dist', to: arg('--to') || '_site' });
  const n = Object.keys(content.text).length, p = Object.keys(content.products.edits).length, im = Object.keys(content.images).length;
  console.log(`apply-content: ${n} text edits, ${p} product edits, ${im} pictures, contact ${content.contact.email} / ${content.contact.whatsapp}`);
}
