// Reading and rewriting the visible text of index.html as plain text (no DOM), shared by the
// build (pre-translated /zh page) and by apply-content.mjs (admin edits applied at deploy time).
// A "segment" is the text between two tags, or a readable attribute; its key is the decoded text
// with whitespace collapsed, which is also how the Chinese dictionary in i18n.js is keyed.
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

export const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&rsquo;/g, '’').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
export const encodeText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const encodeAttr = s => encodeText(s).replace(/"/g, '&quot;');
export const keyOf = s => decode(s).replace(/\s+/g, ' ').trim();
const readable = text => /[A-Za-z]/.test(text);

// The Chinese dictionary, run exactly as the browser runs it (i18n.js in a tiny sandbox).
export async function loadTranslator(i18nPath = 'dist/i18n.js') {
  const root = { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, style: {} };
  const w = {}; w.self = w; w.top = w;
  const sandbox = {
    window: w, location: { search: '?lang=zh' }, URLSearchParams, setTimeout() {},
    document: { documentElement: root, body: {}, title: '', querySelector: () => null, getElementById: () => null,
      createTreeWalker: () => ({ nextNode: () => null }) },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 }, MutationObserver: class { observe() {} },
  };
  runInNewContext(await readFile(i18nPath, 'utf8'), sandbox);
  const tr = w.I18N && w.I18N.t;
  if (!tr || w.I18N.lang !== 'zh') throw new Error('Chinese dictionary unavailable');
  return text => {
    const out = tr(text);
    return typeof out === 'string' ? out : text;
  };
}

const SPLIT = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<noscript\b[\s\S]*?<\/noscript>|<!--[\s\S]*?-->|<[^>]+>)/;
const ATTRS = /\b(placeholder|aria-label|title|alt)="([^"]*)"/g;
const META = /^<meta\b[^>]*\b(?:name="description"|property="og:(?:title|description)")/;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const GROUP = /^<(section|header|footer|aside|dialog|nav|main|form|title)\b(?:[^>]*?\bid="([^"]+)")?(?:[^>]*?\bclass="([^"]+)")?/i;

// Walk the page. `onText(key, ctx)` / `onAttr(name, key, ctx)` return replacement text or null.
// ctx: { group, keep } — keep is true inside an element marked data-no-translate (brand names).
export function rewrite(html, { onText = () => null, onAttr = () => null } = {}) {
  let keep = null;   // { tag, depth } while inside a data-no-translate element
  let group = 'head';
  const parts = html.split(SPLIT);
  return parts.map((part, i) => {
    const ctx = { group, keep: !!keep };
    if (i % 2 === 1) {
      if (/^<(script|style|noscript|!--)/i.test(part)) return part;
      const open = part.match(/^<([a-z][\w-]*)/i), close = part.match(/^<\/([a-z][\w-]*)/i);
      if (keep && open && open[1].toLowerCase() === keep.tag && !/\/>$/.test(part)) keep.depth++;
      if (keep && close && close[1].toLowerCase() === keep.tag && --keep.depth === 0) keep = null;
      if (!keep && open && /\sdata-no-translate(?=[\s>=/])/.test(part) && !VOID.has(open[1].toLowerCase()) && !/\/>$/.test(part)) keep = { tag: open[1].toLowerCase(), depth: 1 };
      const g = part.match(GROUP);
      if (g) group = g[1].toLowerCase() === 'title' ? 'head' : (g[2] || (g[3] || '').split(/\s+/)[0] || g[1].toLowerCase());
      const tagCtx = { group, keep: ctx.keep };
      let tag = part.replace(ATTRS, (m, name, value) => {
        const key = keyOf(value);
        if (!readable(key)) return m;
        const out = onAttr(name, key, tagCtx);
        return out != null && out !== key ? `${name}="${encodeAttr(out)}"` : m;
      });
      if (META.test(tag)) tag = tag.replace(/content="([^"]*)"/, (m, v) => {
        const key = keyOf(v);
        const out = readable(key) ? onAttr('content', key, { group: 'head', keep: false }) : null;
        return out != null && out !== key ? `content="${encodeAttr(out)}"` : m;
      });
      return tag;
    }
    if (!part.trim()) return part;
    const key = keyOf(part);
    if (!readable(key)) return part;
    const out = onText(key, ctx);
    if (out == null || out === key) return part;
    const lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
    return lead + encodeText(out) + trail;
  }).join('');
}

// Every readable segment of the page, once each, in page order.
export function collectSegments(html) {
  const seen = new Map();
  const add = (key, kind, ctx) => {
    const item = seen.get(key);
    if (item) { item.count++; return null; }
    seen.set(key, { key, kind, group: ctx.group, keep: ctx.keep, count: 1 });
    return null;
  };
  rewrite(html, { onText: (k, ctx) => add(k, 'text', ctx), onAttr: (name, k, ctx) => add(k, name, ctx) });
  return [...seen.values()];
}

export function markChinese(html) {
  const zh = html
    .replace(/<html lang="en"/, '<html lang="zh-CN" data-lang="zh" class="lang-zh"')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://www.mao-han.cn/zh">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="https://www.mao-han.cn/zh">');
  if (!/data-lang="zh"/.test(zh)) throw new Error('Could not mark /zh as Chinese');
  return zh;
}

// The Chinese page: each segment translated by the dictionary, or by `override(key)` when given.
export function renderChinese(html, tr, override = () => null) {
  const pick = (key, ctx) => {
    const o = override(key, ctx);
    if (o != null) return o;
    return ctx.keep ? null : tr(key);
  };
  return markChinese(rewrite(html, { onText: pick, onAttr: (name, key, ctx) => pick(key, ctx) }));
}
