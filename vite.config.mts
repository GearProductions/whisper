// Construit les trois pages (src/renderer) dans out/renderer, chargées par le
// principal en file:// : chemins relatifs (base './'), sans serveur.
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = resolve(import.meta.dirname, 'src/renderer');

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  // Imports absolus, comme dans les plugins Gear : 'core/conversation', 'technicals/bridge'…
  resolve: { alias: [{ find: /^(app|core|helpers|technicals)(?=\/|$)/, replacement: `${root}/$1` }] },
  build: {
    outDir: resolve(import.meta.dirname, 'out/renderer'),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        icon: resolve(root, 'app/icon/index.html'),
        bubble: resolve(root, 'app/bubble/bubble.html'),
        panel: resolve(root, 'app/panel/conversation.html'),
      },
    },
  },
  test: {
    root: import.meta.dirname,
    include: ['src/renderer/**/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
