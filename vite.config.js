var _a, _b;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server: {
        port: ((_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.PORT) ? parseInt(globalThis.process.env.PORT) : 5174,
        host: '0.0.0.0',
        allowedHosts: true,
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'pwa-icon.svg', 'pwa-192.png', 'pwa-512.png'],
            manifest: {
                name: 'ZumiLabs File Browser',
                short_name: 'File Browser',
                description: 'ZumiLabs File Browser — local-first, browser-native file management.',
                theme_color: '#09090b',
                background_color: '#09090b',
                display: 'standalone',
                icons: [
                    {
                        src: 'pwa-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    },
                    {
                        src: 'pwa-icon.svg',
                        sizes: '192x192 512x512',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    }
                ]
            }
        })
    ],
    base: './',
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    build: {
        lib: {
            entry: './src/main.tsx',
            name: 'ZumiLabsFileBrowser',
            fileName: 'zumilabs-file-browser',
            formats: ['iife'],
        },
        rollupOptions: {
            // docMentis ships an 18 MB WASM binary. If bundled into the IIFE it gets
            // base64-encoded, bloating the output to ~27 MB. Mark it (and officeparser)
            // external so they stay as lazy dynamic imports. `output.paths` rewrites
            // the bare specifiers to the vendored ESM files (served alongside the HTML
            // in both the web app and the Chrome extension). This avoids an inline
            // import map, which MV3's CSP forbids. In dev, Vite resolves the bare
            // specifiers from node_modules instead.
            external: ['@docmentis/udoc-viewer', 'officeparser'],
            output: {
                inlineDynamicImports: true,
                paths: {
                    'officeparser': './vendor/officeparser.mjs',
                    '@docmentis/udoc-viewer': './vendor/docmentis/index.js',
                },
                globals: {
                    '@docmentis/udoc-viewer': 'DocMentis', // fallback for static-import shim
                },
            },
        }
    }
});
