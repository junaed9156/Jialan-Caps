import { build, context } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';

await rm('dist/js', { recursive: true, force: true });
const options = {
  entryPoints: ['src/3d/main.js'], bundle: true, splitting: true, format: 'esm', minify: true,
  target: 'es2020', outdir: 'dist/js', chunkNames: 'chunk-[hash]', legalComments: 'none', logLevel: 'info',
  plugins: [{ name: 'version-assets', setup(builder) {
    builder.onEnd(result => { if (!result.errors.length) return versionAssets(); });
  } }],
};

// Existing visitors must get the matching entry script and chunks after deployment.
// Version all local CSS/JS references by content, including language and catalogue updates.
async function versionAssets() {
let html = await readFile('dist/index.html', 'utf8');
for (const match of [...html.matchAll(/\b(?:src|href)="([\w./-]+\.(?:js|css))(?:\?v=[\w-]+)?"/g)]) {
  const bytes = await readFile('dist/' + match[1]);
  const version = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  html = html.replace(match[0], match[0].replace(/(?:\?v=[\w-]+)?"$/, `?v=${version}"`));
}
await writeFile('dist/index.html', html);
}

if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
