import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'node:path';

// Remove crossorigin and type="module" from built HTML — breaks file:// loading
function fixHtmlForElectron() {
  return {
    name: 'fix-html-for-electron',
    enforce: 'post' as const,
    transformIndexHtml(html: string) {
      return html
        .replace(/ crossorigin/g, '')
        .replace(/ type="module"/g, '');
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    fixHtmlForElectron(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/index.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              output: {
                entryFileNames: '[name].js',
              },
              external: [
                'electron',
                'electron-store',
                'electron-updater',
                '@nut-tree-fork/nut-js',
                'socket.io-client',
              ],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist/preload',
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              output: {
                entryFileNames: '[name].js',
              },
              external: ['electron'],
            },
          },
        },
      },
    ]),
    electronRenderer({
      nodeIntegration: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  base: './',
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      output: {
        // Output as IIFE, not ESM — so require() works with nodeIntegration
        format: 'iife',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        inlineDynamicImports: true,
      },
    },
  },
});
