// @vitest-environment happy-dom
// FeedbackView (feedback-view.tsx) : un fichier de retour selon ses étiquettes — le [toi] en avant, le [agent]
// replié sous son nombre, rien quand tout va bien, un fichier sans étiquette tel quel, aucun bouton, jamais de HTML.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import { FeedbackView } from '../../feedback-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const draw = (md: string, props: Record<string, unknown> = {}) =>
  act(() => root.render(createElement(FeedbackView, { md, t: t('fr'), onOpenLink: () => {}, ...props })));
const fold = () => page.querySelector('details');
const outside = () => { // le texte hors du repli
  const clone = page.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('details').forEach((d) => d.remove());
  return clone.textContent;
};

const MIXED = '- [toi] Une question ?\n- [agent] a1\n- [agent] a2\n- [agent] a3';

it('une remarque [toi] et trois [agent] : la [toi] visible, « 3 pour l\'agent » replié', async () => {
  await draw(MIXED);
  expect(outside()).toContain('Une question ?');
  expect(outside()).not.toContain('a1');
  expect(fold()?.querySelector('summary')?.textContent).toBe('3 pour l\'agent');
  expect(fold()?.hasAttribute('open')).toBe(false);
  expect(fold()?.textContent).not.toContain('Une question ?');
});

it('le repli ouvert : les trois remarques [agent]', async () => {
  await draw(MIXED);
  await act(async () => { fold()!.querySelector('summary')!.click(); });
  expect(fold()?.hasAttribute('open')).toBe(true);
  expect([...fold()!.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['pour l\'agent a1', 'pour l\'agent a2', 'pour l\'agent a3']);
});

it('que des [agent] : le repli seul, rien en avant', async () => {
  await draw('## [agent] Remarques\n\n- a1\n- a2');
  expect(fold()).not.toBeNull();
  expect(fold()?.querySelector('summary')?.textContent).toBe('1 pour l\'agent');
  expect(outside()).toBe('');
});

it('que des [toi] : rien de replié', async () => {
  await draw('- [toi] a\n- [toi] b');
  expect(fold()).toBeNull();
  expect(page.querySelectorAll('li')).toHaveLength(2);
});

it('un fichier « Aligné. » : rien du tout', async () => {
  await draw('Aligné.');
  expect(page.innerHTML).toBe('');
  await draw('Aligné.\n');
  expect(page.innerHTML).toBe('');
  await draw('');
  expect(page.innerHTML).toBe('');
});

it('un fichier sans étiquette de plusieurs lignes : montré tel quel', async () => {
  await draw('# Alignement\n\nUne ligne.\n\n- un point\n- un autre');
  expect(fold()).toBeNull();
  expect(page.querySelector('h1')?.textContent).toBe('Alignement');
  expect(page.querySelectorAll('li')).toHaveLength(2);
  expect(page.textContent).toContain('Une ligne.');
});

it('du texte sans étiquette à côté des étiquettes : montré aussi, rien n\'est caché', async () => {
  await draw('Intro.\n\n- [toi] q\n- [agent] a');
  expect(outside()).toContain('Intro.');
  expect(outside()).toContain('q');
});

it('aucun bouton : ni Relancer, ni Appliquer, ni 💬 sans onQuote', async () => {
  await draw(MIXED);
  expect(page.querySelector('button, [role="button"]')).toBeNull();
});

it('onQuote : un 💬 par bloc cité, qui cite son texte', async () => {
  const quoted: string[] = [];
  await draw('- [toi] Une question ?', { onQuote: (x: string) => quoted.push(x) });
  page.querySelector<HTMLButtonElement>('button.vc-quote')!.click();
  expect(quoted).toHaveLength(1);
  expect(quoted[0]).toContain('Une question ?');
});

it('un lien du texte : ouvert par le rappel, jamais de HTML inséré', async () => {
  const opened: string[] = [];
  await draw('- [toi] Voir [la doc](https://x.test/a) <b>gras</b>\n- [agent] <img src=x onerror=alert(1)>', { onOpenLink: (u: string) => opened.push(u) });
  await act(async () => { fold()!.setAttribute('open', ''); });
  page.querySelector<HTMLAnchorElement>('a')!.click();
  expect(opened).toEqual(['https://x.test/a']);
  expect(page.querySelector('b, img')).toBeNull();
  expect(page.textContent).toContain('<b>gras</b>');
});

it('en anglais : « 3 for the agent »', async () => {
  await draw(MIXED, { t: t('en') });
  expect(fold()?.querySelector('summary')?.textContent).toBe('3 for the agent');
});
