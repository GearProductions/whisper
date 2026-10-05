// Construit les trois pages (src/renderer) dans out/renderer, chargées par le
// principal en file:// : chemins relatifs (base './'), sans serveur.
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = resolve(__dirname, 'src/renderer');

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        icon: resolve(root, 'icon/index.html'),
        bubble: resolve(root, 'bubble/bubble.html'),
        panel: resolve(root, 'panel/conversation.html'),
      },
    },
  },
  test: {
    root: __dirname,
    include: ['src/renderer/**/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
