// Les tests, en deux projets : les pages (src/renderer) et le principal
// (src/main, les ponts, tests/ à la racine). Chacun ses imports absolus :
// 'core/…' désigne le core de son processus.
// En CI, les runners (Windows surtout) sont lents et inégaux : beaucoup de
// tests attendent un processus, un dépôt git ou un délai fixe (settle). Plus
// de temps, et un test qui échoue y est relancé deux fois avant de casser la
// CI (et le paquet d'une release). En local, rien ne change.
// Le git du principal, le même partout : une identité (le code essayé
// rejoue des commits, git rebase, avec la config de l'utilisateur, absente
// sur un runner) et pas de conversion des fins de ligne (core.autocrlf du
// runner Windows : un --autostash repris en \r\n).
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export const aliases = (side: 'renderer' | 'main') => [
  { find: /^(app|core|helpers|technicals)(?=\/|$)/, replacement: `${resolve(import.meta.dirname, 'src', side)}/$1` },
  { find: /^shared(?=\/)/, replacement: resolve(import.meta.dirname, 'src/shared') },
];

const ci = process.env.CI ? { testTimeout: 30_000, hookTimeout: 60_000, retry: 2 } : {};
const gitEnv = {
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
};

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias: aliases('renderer') }, test: { name: 'pages', include: ['src/renderer/**/tests/**/*.test.ts'], environment: 'node', ...ci } },
      { resolve: { alias: aliases('main') }, test: { name: 'principal', include: ['src/main/**/tests/**/*.test.ts', 'tests/**/*.test.ts'], environment: 'node', env: gitEnv, ...ci } },
    ],
  },
});
