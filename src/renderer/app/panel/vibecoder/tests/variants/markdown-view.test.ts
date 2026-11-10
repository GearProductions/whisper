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

// focus et tagged (les fichiers de retour du créateur).
const html = () => page.innerHTML;

it('focus : l\'élément de liste de cette ligne, data-focus, défilé', async () => {
  const scrolled: Element[] = [];
  const proto = Element.prototype as { scrollIntoView?: () => void };
  const before = proto.scrollIntoView;
  proto.scrollIntoView = function (this: Element) { scrolled.push(this); };
  try {
    await draw({ md: 'Un paragraphe.\n\n- un\n- deux', focus: 3 });
  } finally { proto.scrollIntoView = before; }
  const hit = page.querySelectorAll('[data-focus]');
  expect(hit).toHaveLength(1);
  expect(hit[0].tagName).toBe('LI');
  expect(hit[0].textContent).toContain('deux');
  expect(scrolled).toEqual([hit[0]]);
});

it('focus : un paragraphe, et sans scrollIntoView rien ne casse', async () => {
  const proto = Element.prototype as { scrollIntoView?: () => void };
  const before = proto.scrollIntoView;
  delete proto.scrollIntoView;
  try { await draw({ md: 'Un paragraphe.\n\n- un', focus: 0 }); } finally { proto.scrollIntoView = before; }
  expect(page.querySelector('[data-focus]')?.textContent).toContain('Un paragraphe.');
  await draw({ md: 'Un paragraphe.\n\n- un' });
  expect(page.querySelector('[data-focus]')).toBeNull();
});

it('tagged, `- [agent] a` : le badge, plus de « [agent] » dans le texte, data-tag agent ; un sous-point [toi] : le sien', async () => {
  await draw({ md: '- [agent] a\n  - [toi] b\n  - c', tagged: true });
  expect(page.textContent).not.toContain('[');
  const [outer, inner, plain] = [...page.querySelectorAll('li')];
  expect(outer.getAttribute('data-tag')).toBe('agent');
  expect(outer.querySelector(':scope > .vc-tag-badge')?.textContent).toBe('pour l\'agent');
  expect(inner.getAttribute('data-tag')).toBe('toi');
  expect(inner.querySelector(':scope > .vc-tag-badge')?.textContent).toBe('pour toi');
  expect(plain.hasAttribute('data-tag')).toBe(false);
  expect(plain.querySelector('.vc-tag-badge')).toBeNull();
});

it('tagged, une remarque `a.ts:L3` [agent] — b : l\'adresse, le badge, puis « — b »', async () => {
  await draw({ md: '- `a.ts:L3` [agent] — b', tagged: true });
  const li = page.querySelector('li')!;
  expect([...li.childNodes].map((n) => n.textContent).filter((x) => x?.trim())).toEqual(['a.ts:L3', 'pour l\'agent', '— b']);
  expect(li.firstElementChild?.tagName).toBe('CODE');
});

it('tagged, `## [agent] A` : la rubrique entière data-tag agent, le titre sans crochets', async () => {
  await draw({ md: '## [agent] A\n\ntexte\n\n## B\n\nautre', tagged: true });
  const blocks = [...page.querySelectorAll('.vc-block')];
  expect(blocks.map((b) => b.getAttribute('data-tag'))).toEqual(['agent', 'agent', null, null]);
  expect(page.querySelector('h2')?.textContent).toBe('pour l\'agent A');
});

it('sans tagged : [agent] reste du texte, sans badge ni data-tag ; jamais de HTML', async () => {
  await draw({ md: '## [agent] A\n\n- [agent] a <b>x</b>' });
  expect(page.textContent).toContain('[agent] a <b>x</b>');
  expect(page.querySelector('.vc-tag-badge, [data-tag], b')).toBeNull();
  expect(html()).not.toContain('<b>');
});

it('focus : la note change (l\'agent écrit ailleurs), la ligne visée est la même : la vue n\'y est pas ramenée', async () => {
  const proto = Element.prototype as { scrollIntoView?: () => void };
  const before = proto.scrollIntoView;
  let scrolls = 0;
  proto.scrollIntoView = () => { scrolls++; };
  try {
    await draw({ md: 'Un paragraphe.\n\n- un\n- deux', focus: 3 });
    expect(scrolls).toBe(1);
    await draw({ md: 'Un paragraphe changé.\n\n- un\n- deux', focus: 3 });
    expect(scrolls).toBe(1);
    await draw({ md: 'Un paragraphe changé.\n\n- un\n- deux', focus: 2 });
    expect(scrolls).toBe(2);
  } finally { proto.scrollIntoView = before; }
});
