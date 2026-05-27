import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server: ({
    port: (globalThis as any).process?.env?.PORT ? parseInt((globalThis as any).process.env.PORT) : 5174,
    host: '0.0.0.0',
    allowedHosts: true,
  } as any),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-icon.svg'],
      manifest: {
        name: 'ZumiLabs File Browser',
        short_name: 'File Browser',
        description: 'ZumiLabs File Browser — local-first, browser-native file management.',
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
      name: 'ZumiLabsFileBrowser',
      fileName: 'zumilabs-file-browser',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      }
    }
  }
})
