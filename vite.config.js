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
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon.svg'],
            manifest: {
                name: 'Sidekick File Manager',
                short_name: 'Sidekick',
                description: 'Local-first file management',
                theme_color: '#09090b',
                background_color: '#09090b',
                display: 'standalone',
                icons: [
                    {
                        src: 'pwa-icon.svg',
                        sizes: '192x192 512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
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
            name: 'SidekickManager',
            fileName: 'sidekick-manager',
            formats: ['iife'],
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            }
        }
    }
});
