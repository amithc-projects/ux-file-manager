import { readFileSync, writeFileSync } from 'fs';

const trailingSlashRedirect = `<script>
    if (!window.location.pathname.endsWith('/')) {
      window.location.replace(window.location.href + '/');
    }
  </script>`;

const html = readFileSync('index.html', 'utf8')
  // Inject trailing-slash redirect as the very first thing in <head>
  .replace('<head>', '<head>\n  ' + trailingSlashRedirect)
  // Replace the dev module entry with the built IIFE
  .replace(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
    '<script src="./zumilabs-file-browser.iife.js"></script>'
  )
  // Make all root-absolute asset paths relative
  .replace(/src="\/send-to-cloud\.js"/g, 'src="./send-to-cloud.js"')
  .replace(/href="\/pwa-icon\.svg"/g, 'href="./pwa-icon.svg"')
  .replace(/href="\/manifest\.webmanifest"/g, 'href="./manifest.webmanifest"')
  .replace(/src="\/registerSW\.js"/g, 'src="./registerSW.js"');

writeFileSync('dist/index.html', html);
console.log('✓ dist/index.html written');
