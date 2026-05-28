import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Copy officeparser browser bundle ─────────────────────────────────────────
const officeparserSrc  = join(root, 'node_modules/officeparser/dist/officeparser.browser.mjs');
const officeparserDest = join(root, 'dist/vendor/officeparser.mjs');
mkdirSync(join(root, 'dist/vendor'), { recursive: true });
import { copyFileSync } from 'fs';
copyFileSync(officeparserSrc, officeparserDest);
console.log('✓ officeparser browser bundle copied to dist/vendor/officeparser.mjs');

// ── Copy docMentis vendor files ──────────────────────────────────────────────
// docMentis ships an 18 MB WASM. We vendor its ESM dist so it can be loaded
// lazily via an import map, keeping the main IIFE ~1 MB instead of ~27 MB.
const docMentisSrc  = join(root, 'node_modules/@docmentis/udoc-viewer/dist/src');
const docMentisDest = join(root, 'dist/vendor/docmentis');
cpSync(docMentisSrc, docMentisDest, {
  recursive: true,
  filter: (src) => !src.endsWith('.map') && !src.endsWith('.d.ts') && !src.endsWith('.d.ts.map'),
});
console.log('✓ docMentis vendor files copied to dist/vendor/docmentis/');

// ── Import map snippet ────────────────────────────────────────────────────────
const importMap = `  <script type="importmap">
    {"imports":{"@docmentis/udoc-viewer":"./vendor/docmentis/index.js","officeparser":"./vendor/officeparser.mjs"}}
  </script>`;

// ── Patch index.html ──────────────────────────────────────────────────────────
const trailingSlashRedirect = `<script>
    if (!window.location.pathname.endsWith('/')) {
      window.location.replace(window.location.href + '/');
    }
  </script>`;

const html = readFileSync(join(root, 'index.html'), 'utf8')
  .replace('<head>', `<head>\n  ${trailingSlashRedirect}`)
  // Inject import map before the first script so it's available to the IIFE
  .replace('<head>', `<head>\n${importMap}`)
  .replace(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
    '<script src="./zumilabs-file-browser.iife.js"></script>'
  )
  .replace(/src="\/send-to-cloud\.js"/g, 'src="./send-to-cloud.js"')
  .replace(/href="\/pwa-icon\.svg"/g, 'href="./pwa-icon.svg"')
  .replace(/href="\/manifest\.webmanifest"/g, 'href="./manifest.webmanifest"')
  .replace(/src="\/registerSW\.js"/g, 'src="./registerSW.js"');

writeFileSync(join(root, 'dist/index.html'), html);
console.log('✓ dist/index.html written');
