// Construit les trois pages (src/renderer) dans out/renderer, chargées par le
// principal en file:// : chemins relatifs (base './'), sans serveur. Le
// principal et les ponts : vite.main.config.mts. Les tests : vitest.config.mts.
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { aliases } from './vitest.config.mts';

const root = resolve(import.meta.dirname, 'src/renderer');

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  // Imports absolus, comme dans les plugins Gear : 'core/conversation', 'shared/bridge'…
  resolve: { alias: aliases('renderer') },
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
});
