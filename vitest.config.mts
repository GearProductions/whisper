// Les tests, en deux projets : les pages (src/renderer) et le principal
// (src/main, les ponts, tests/ à la racine). Chacun ses imports absolus :
// 'core/…' désigne le core de son processus.
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export const aliases = (side: 'renderer' | 'main') => [
  { find: /^(app|core|helpers|technicals)(?=\/|$)/, replacement: `${resolve(import.meta.dirname, 'src', side)}/$1` },
  { find: /^shared(?=\/)/, replacement: resolve(import.meta.dirname, 'src/shared') },
];

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias: aliases('renderer') }, test: { name: 'pages', include: ['src/renderer/**/tests/**/*.test.ts'], environment: 'node' } },
      { resolve: { alias: aliases('main') }, test: { name: 'principal', include: ['src/main/**/tests/**/*.test.ts', 'tests/**/*.test.ts'], environment: 'node' } },
    ],
  },
});
