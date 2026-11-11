import { build, context, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

await rm('dist/js', { recursive: true, force: true });
const options = {
  entryPoints: ['src/3d/main.js'], bundle: true, splitting: true, format: 'esm', minify: true,
  target: 'es2020', outdir: 'dist/js', chunkNames: 'chunk-[hash]', legalComments: 'none', logLevel: 'info', metafile: true,
  plugins: [{ name: 'version-assets', setup(builder) {
    builder.onEnd(async result => {
      if (result.errors.length) return;
      await bundleStyles();
      await bundleApplication();
      await preloadCriticalScenes(result.metafile);
      await versionAssets();
      return prerenderChinese();
    });
  } }],
};

// The complete skin travels with the HTML, so there is no blocking CSS round trip or restyle.
// Keep a standalone copy for diagnostics; the four source files remain editable.
async function bundleStyles() {
  const names = ['styles.css', 'studio.css', 'scenes.css', 'atelier.css'];
  const sources = await Promise.all(names.map(name => readFile('dist/' + name, 'utf8')));
  const result = await transform(sources.join('\n'), { loader: 'css', minify: true, charset: 'utf8', legalComments: 'none' });
  await writeFile('dist/site.css', result.code);
  const style = `  <style id="site-styles">${result.code.trim()}</style>\n`;
  let linked = false;
  let html = (await readFile('dist/index.html', 'utf8')).replace(
    /  <link rel="stylesheet" href="(?:styles|studio|scenes|atelier|site)\.css(?:\?v=[\w-]+)?">\n/g,
    () => {
      if (linked) return '';
      linked = true;
      return style;
    },
  );
  if (!linked && /  <style id="site-styles">[\s\S]*?<\/style>\n/.test(html)) {
    html = html.replace(/  <style id="site-styles">[\s\S]*?<\/style>\n/, () => style);
    linked = true;
  }
  if (!linked) throw new Error('Missing website styles');
  await writeFile('dist/index.html', html);
}

// Keep product feeds separate: the existing admin can publish them without rebuilding the app.
async function bundleApplication() {
  const names = ['lang-boot.js', 'countries.js', 'i18n.js', 'app.js'];
  const sources = await Promise.all(names.map(name => readFile('dist/' + name, 'utf8')));
  // Translation strings dominate the application bytes. English visits never need them.
  // Keep the editable dictionary in i18n.js; derive an independent, content-hashed asset.
  const dictionary = sources[2].match(/  const ZH = (\{[\s\S]*?\n  \});/);
  if (!dictionary) throw new Error('Missing Chinese translation dictionary');
  const jsOptions = { loader: 'js', minify: true, target: 'es2020', charset: 'utf8', legalComments: 'none' };
  const translated = await transform('window.MAOHAN_ZH=' + dictionary[1] + ';', jsOptions);
  const hash = createHash('sha256').update(translated.code).digest('hex').slice(0, 10);
  const translationFile = `translations-${hash}.js`;
  for (const file of await readdir('dist')) if (/^translations-[a-f0-9]{10}\.js$/.test(file) && file !== translationFile) await rm('dist/' + file);
  await writeFile('dist/' + translationFile, translated.code);
  sources[2] = sources[2].replace(dictionary[0], '  const ZH = window.MAOHAN_ZH || {};');
  const loadTranslation = `
    if (new URLSearchParams(location.search).get('lang') === 'zh' || document.documentElement.dataset.lang === 'zh') {
      try { await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = '${translationFile}';
        script.onload = resolve; script.onerror = reject; document.head.append(script);
      }); } catch (error) { console.warn('Translation unavailable:', error); }
    }
  `;
  const result = await transform(`(async () => {\n${sources[0]}\n${loadTranslation}\n${sources.slice(1).join('\n;\n')}\n})();`, jsOptions);
  await writeFile('dist/site.js', result.code);
  let html = await readFile('dist/index.html', 'utf8');
  html = html.replace(/  <script src="(?:lang-boot|countries|i18n|app|site)\.js(?:\?v=[\w-]+)?"(?: defer)?><\/script>\n/g, '');
  html = html.replace(/(  <script src="admin-products\.js[^"\n]*" defer><\/script>\n)/, '$1  <script src="site.js" defer></script>\n');
  await writeFile('dist/index.html', html);
}

// Preload only the lightweight boot module's static dependencies. The WebGL engine is
// requested after the first paint, and only for a scene that is approaching the viewport.
async function preloadCriticalScenes(meta) {
  const outputs = meta.outputs;
  const main = Object.keys(outputs).find(o => outputs[o].entryPoint === 'src/3d/main.js');
  if (!main) throw new Error('Missing the 3D bootstrap');
  const need = new Set(), stack = outputs[main].imports.filter(i => i.kind === 'import-statement').map(i => i.path);
  while (stack.length) {
    const o = stack.pop();
    if (need.has(o)) continue;
    need.add(o);
    for (const imp of outputs[o].imports || []) if (imp.kind === 'import-statement') stack.push(imp.path);
  }
  const links = [...need].map(o => `  <link rel="modulepreload" href="${o.replace(/^dist\//, '')}">`).join('\n');
  let html = await readFile('dist/index.html', 'utf8');
  const block = `  <!-- 3d-preload -->\n${links}\n  <!-- /3d-preload -->`;
  html = /  <!-- 3d-preload -->[\s\S]*?<!-- \/3d-preload -->/.test(html)
    ? html.replace(/  <!-- 3d-preload -->[\s\S]*?<!-- \/3d-preload -->/, block)
    : html.replace(/(\s*<script type="module" src="js\/main\.js)/, `\n${block}$1`);
  await writeFile('dist/index.html', html);
}

// Existing visitors must get the matching entry script and chunks after deployment.
// Version all local CSS/JS references by content, including language and catalogue updates.
async function versionAssets() {
let html = await readFile('dist/index.html', 'utf8');
for (const match of [...html.matchAll(/\b(?:src|href)="([\w./-]+\.(?:js|css))(?:\?v=[\w-]+)?"/g)]) {
  // Chunk names already carry a content hash, and a preload must match the import URL exactly.
  if (match[1].startsWith('js/chunk-')) { html = html.replace(match[0], match[0].replace(/\?v=[\w-]+"$/, '"')); continue; }
  const bytes = await readFile('dist/' + match[1]);
  const version = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  html = html.replace(match[0], match[0].replace(/(?:\?v=[\w-]+)?"$/, `?v=${version}"`));
}
await writeFile('dist/index.html', html);
}

// Chinese visitors get /zh: index.html with every static string already translated by the same
// dictionary the browser uses, so the first paint is Chinese (no English flash, no hidden page).
// The markup is edited as text, so the page structure stays byte-for-byte the English design.
async function prerenderChinese() {
  const html = await readFile('dist/index.html', 'utf8');
  const root = { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, style: {} };
  const w = {}; w.self = w; w.top = w;
  const sandbox = {
    window: w, location: { search: '?lang=zh' }, URLSearchParams, setTimeout() {},
    document: { documentElement: root, body: {}, title: '', querySelector: () => null, getElementById: () => null,
      createTreeWalker: () => ({ nextNode: () => null }) },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 }, MutationObserver: class { observe() {} },
  };
  runInNewContext(await readFile('dist/i18n.js', 'utf8'), sandbox);
  const tr = w.I18N && w.I18N.t;
  if (!tr || w.I18N.lang !== 'zh') throw new Error('Chinese dictionary unavailable for /zh');
  const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&rsquo;/g, '’').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
  const encodeText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const encodeAttr = s => encodeText(s).replace(/"/g, '&quot;');
  const translate = raw => {
    const text = decode(raw);
    if (!/[A-Za-z]/.test(text)) return null;
    const out = tr(text);
    return typeof out === 'string' && out !== text.replace(/\s+/g, ' ').trim() && out !== text ? out : null;
  };
  const ATTRS = /\b(placeholder|aria-label|title|alt)="([^"]*)"/g;
  let skipDepth = 0;
  const parts = html.split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<noscript\b[\s\S]*?<\/noscript>|<!--[\s\S]*?-->|<[^>]+>)/);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) {
      if (/^<(script|style|noscript|!--)/i.test(part)) return part;
      if (/^<[a-z][^>]*\bdata-no-translate\b/i.test(part) && !/\/>$/.test(part)) skipDepth++;
      let tag = part.replace(ATTRS, (m, name, value) => {
        const t = translate(value);
        return t ? `${name}="${encodeAttr(t)}"` : m;
      });
      if (/^<meta\b[^>]*name="description"/.test(tag)) tag = tag.replace(/content="([^"]*)"/, (m, v) => { const t = translate(v); return t ? `content="${encodeAttr(t)}"` : m; });
      return tag;
    }
    if (skipDepth || !part.trim()) return part;
    const t = translate(part);
    if (!t) return part;
    const lead = part.match(/^\s*/)[0], trail = part.match(/\s*$/)[0];
    return lead + encodeText(t) + trail;
  });
  let zh = out.join('')
    .replace(/<html lang="en"/, '<html lang="zh-CN" data-lang="zh" class="lang-zh"')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://www.mao-han.cn/zh">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="https://www.mao-han.cn/zh">');
  if (!/data-lang="zh"/.test(zh)) throw new Error('Could not mark /zh as Chinese');
  await writeFile('dist/zh.html', zh);
}

if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
