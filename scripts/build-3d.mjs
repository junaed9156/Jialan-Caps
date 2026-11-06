import { build, context } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';

await rm('dist/js', { recursive: true, force: true });
const options = {
  entryPoints: ['src/3d/main.js'], bundle: true, splitting: true, format: 'esm', minify: true,
  target: 'es2020', outdir: 'dist/js', chunkNames: 'chunk-[hash]', legalComments: 'none', logLevel: 'info', metafile: true,
  plugins: [{ name: 'version-assets', setup(builder) {
    builder.onEnd(async result => { if (result.errors.length) return; await preloadCriticalScenes(result.metafile); return versionAssets(); });
  } }],
};

// Fetch both interactive entry points with the page. Their shared engine is requested only once.
async function preloadCriticalScenes(meta) {
  const outputs = meta.outputs;
  const entryPoints = new Set(['src/3d/hero.js', 'src/3d/studio.js']);
  const need = new Set(), stack = Object.keys(outputs).filter(o => entryPoints.has(outputs[o].entryPoint));
  if (stack.length !== entryPoints.size) throw new Error('Missing a critical 3D entry point');
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

if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
