// @vitest-environment happy-dom
// MarkdownView (markdown-view.tsx) : avec onAsk, le bouton « Poser une question à l'agent » à côté du 💬
// d'un bloc appelle onAsk(son texte) ; sans onAsk, aucun ; blockEnd rend après le bloc cité.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import { MarkdownView } from '../../markdown-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const draw = (props: Record<string, unknown>) => act(() => root.render(createElement(MarkdownView, { md: 'Un paragraphe.\n\n- un item', t: t('fr'), onOpenLink: () => {}, onQuote: () => {}, ...props })));
const ask = () => [...page.querySelectorAll<HTMLButtonElement>('button[aria-label="Poser une question à l\'agent"]')];

it('avec onAsk : le bouton d\'un paragraphe et d\'un élément appelle onAsk(son texte)', async () => {
  const asked: string[] = [];
  await draw({ onAsk: (x: string) => asked.push(x) });
  expect(ask()).toHaveLength(2);
  ask().forEach((b) => b.click());
  expect(asked).toEqual(['Un paragraphe.', 'un item']);
});

it('sans onAsk : aucun bouton', async () => {
  await draw({});
  expect(ask()).toHaveLength(0);
});

it('blockEnd : après le bloc cité, avec son texte', async () => {
  await draw({ blockEnd: (x: string) => createElement('i', { className: 'after' }, x) });
  expect([...page.querySelectorAll('.vc-block > .after')].map((e) => e.textContent)).toEqual(['Un paragraphe.']);
});
