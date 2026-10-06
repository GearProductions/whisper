// Construit le processus principal (src/main) et les trois ponts (src/preload)
// dans out/main, en CommonJS pour Node. Electron, les modules de Node et le SDK
// Claude restent dehors : le SDK, module ES, se charge par import() dynamique,
// conservé tel quel. Chaque pont est autonome (un pont « sandbox » ne charge
// que electron).
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { aliases } from './vitest.config.mts';

const src = (p: string) => resolve(import.meta.dirname, 'src', p);

export default defineConfig({
  resolve: { alias: aliases('main') },
  build: {
    outDir: resolve(import.meta.dirname, 'out/main'),
    emptyOutDir: true,
    ssr: true,
    target: 'node20',
    minify: false,
    rollupOptions: {
      input: {
        index: src('main/index.ts'),
        'preload-icon': src('preload/icon.ts'),
        'preload-bubble': src('preload/bubble.ts'),
        'preload-panel': src('preload/panel.ts'),
      },
      external: ['electron', '@anthropic-ai/claude-agent-sdk', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: { format: 'cjs', entryFileNames: '[name].js' },
    },
  },
});
