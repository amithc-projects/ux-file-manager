import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { build as esbuild } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Copy officeparser browser bundle ─────────────────────────────────────────
const officeparserSrc  = join(root, 'node_modules/officeparser/dist/officeparser.browser.mjs');
const officeparserDest = join(root, 'dist/vendor/officeparser.mjs');
mkdirSync(join(root, 'dist/vendor'), { recursive: true });
import { copyFileSync } from 'fs';
copyFileSync(officeparserSrc, officeparserDest);
console.log('✓ officeparser browser bundle copied to dist/vendor/officeparser.mjs');

// ── Bundle docMentis into a single self-contained ESM (WASM via CDN) ──────────
// docMentis ships its dist as many ESM files that use EXTENSIONLESS imports
// (e.g. `from "./components/Toolbar"`). Browsers require explicit extensions, so
// the raw dist cannot be served directly — it 404s on every submodule. We bundle
// it with esbuild into one file with all imports resolved.
//
// The 19 MB `udoc_bg.wasm` is marked external (`*.wasm`), so the bundle keeps the
// literal `new URL("./wasm/udoc_bg.wasm", import.meta.url)` reference. We don't
// ship that file, so it 404s and docMentis's UDocClient.create() falls back to
// its built-in CDN URL (https://cdn.jsdelivr.net/npm/@docmentis/udoc-viewer@<ver>
// /dist/src/wasm/udoc_bg.wasm). This keeps the vendor JS ~1 MB and works in
// size-constrained hosts (the Chrome extension). Office preview then needs
// network on first use; if the CDN is unreachable, DocMentisViewer surfaces the
// error. The inline Web Worker is bundled as a string, so no remote JS loads —
// MV3 CSP compliant.
await esbuild({
  entryPoints: [join(root, 'node_modules/@docmentis/udoc-viewer/dist/src/index.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['*.wasm'],
  outfile: join(root, 'dist/vendor/docmentis/index.js'),
  legalComments: 'none',
});
console.log('✓ docMentis bundled to dist/vendor/docmentis/index.js (WASM via CDN)');

// ── Patch index.html ──────────────────────────────────────────────────────────
// No import map needed: the lazy-loaded vendor ESM is imported via relative
// URLs (./vendor/...) resolved against document.baseURI at runtime. This keeps
// the markup compatible with the Chrome extension's MV3 CSP, which forbids
// inline scripts (including import maps).
const trailingSlashRedirect = `<script>
    if (!window.location.pathname.endsWith('/')) {
      window.location.replace(window.location.href + '/');
    }
  </script>`;

const html = readFileSync(join(root, 'index.html'), 'utf8')
  .replace('<head>', `<head>\n  ${trailingSlashRedirect}`)
  .replace(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
    '<script src="./zumilabs-file-browser.iife.js"></script>'
  )
  .replace(/src="\/send-to-cloud\.js"/g, 'src="./send-to-cloud.js"')
  .replace(/href="\/pwa-icon\.svg"/g, 'href="./pwa-icon.svg"')
  .replace(/href="\/favicon\.png"/g, 'href="./favicon.png"')
  .replace(/href="\/apple-touch-icon\.png"/g, 'href="./apple-touch-icon.png"')
  .replace(/href="\/manifest\.webmanifest"/g, 'href="./manifest.webmanifest"')
  .replace(/src="\/registerSW\.js"/g, 'src="./registerSW.js"');

writeFileSync(join(root, 'dist/index.html'), html);
console.log('✓ dist/index.html written');
