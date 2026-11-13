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

// removed : les retraits, rendus à part, barrés, en lecture seule, devant ce qui les suit.
const gone = (before: [number, string][] = [], end: string | null = null) => ({ removed: { before: new Map(before), end } });
const removed = () => [...page.querySelectorAll('.vc-removed')];
const marks = {
  onComment: () => {}, onAsk: () => {},
  tag: () => createElement('i', { className: 'm-tag' }),
  itemStart: () => createElement('i', { className: 'm-start' }),
  itemEnd: () => createElement('i', { className: 'm-end' }),
  blockEnd: () => createElement('i', { className: 'm-block' }),
};

it('removed : devant un paragraphe, à sa place, vc-removed', async () => {
  await draw({ md: 'Un.\n\nDeux.', ...gone([[2, 'Ancien.']]) });
  const kids = [...page.querySelector('.vc-md')!.children];
  expect(kids.map((k) => k.className)).toEqual(['vc-block', 'vc-removed', 'vc-block']);
  expect(kids[1].textContent).toBe('Ancien.');
  expect(kids[1].querySelector('p')).not.toBeNull();
});

it('removed : à la ligne 0, avant tout', async () => {
  await draw({ md: 'Un.', ...gone([[0, 'Avant.']]) });
  expect([...page.querySelector('.vc-md')!.children].map((k) => k.textContent)).toEqual(['Avant.', 'Un.']);
});

it('removed : devant un élément de liste, un li vc-removed dans la liste', async () => {
  await draw({ md: '- a\n- b', ...gone([[1, 'x']]) });
  const ul = page.querySelector('ul')!;
  expect([...ul.children].map((k) => `${k.tagName}.${k.className}`)).toEqual(['LI.', 'LI.vc-removed', 'LI.']);
  expect(ul.children[1].textContent).toBe('x');
});

it('removed : devant le premier élément d\'une liste, un li vc-removed dans la liste (rien en double)', async () => {
  await draw({ md: '- a\n- b', ...gone([[0, 'x']]) });
  expect(removed()).toHaveLength(1);
  const ul = page.querySelector('.vc-md')!.firstElementChild!;
  expect(ul.tagName).toBe('UL');
  expect([...ul.children].map((k) => `${k.tagName}.${k.className}`)).toEqual(['LI.vc-removed', 'LI.', 'LI.']);
});

it('removed : devant un élément imbriqué, dans sa sous-liste', async () => {
  await draw({ md: '- a\n  - b\n  - c', ...gone([[2, 'x']]) });
  const inner = page.querySelector('ul ul')!;
  expect([...inner.children].map((k) => `${k.className}:${k.textContent}`)).toEqual([':b', 'vc-removed:x', ':c']);
});

it('removed : un élément qui s\'ouvre sur un autre (`- - a`, `> - a`) : un seul retrait', async () => {
  await draw({ md: '- - a', ...gone([[0, 'x']]) });
  expect(removed()).toHaveLength(1);
  await draw({ md: '> - a', ...gone([[0, 'x']]) });
  expect(removed()).toHaveLength(1);
});

it('removed : end, après le dernier bloc ; end seul, sans before', async () => {
  await draw({ md: 'Un.\n\n- a', ...gone([], 'Fin.') });
  const kids = [...page.querySelector('.vc-md')!.children];
  expect(kids.map((k) => k.className)).toEqual(['vc-block', '', 'vc-removed']);
  expect(kids[2].textContent).toBe('Fin.');
});

it('removed : before vide et end null : rien de barré', async () => {
  await draw({ md: 'Un.\n\n- a', ...gone() });
  expect(removed()).toHaveLength(0);
  await draw({ md: 'Un.' });
  expect(removed()).toHaveLength(0);
});

it('removed : une puce reste une puce, un titre un titre, le gras du gras, du code du code', async () => {
  await draw({ md: 'Un.', ...gone([], '# Titre\n\n- puce\n\n**gras**\n\n```\ncode\n```') });
  const r = removed()[0];
  expect(r.querySelector('h1')?.textContent).toBe('Titre');
  expect(r.querySelector('ul > li')?.textContent).toBe('puce');
  expect(r.querySelector('strong')?.textContent).toBe('gras');
  expect(r.querySelector('pre.vc-code code')?.textContent).toBe('code');
});

it('removed : un retrait qui est un bloc de code, devant un bloc', async () => {
  await draw({ md: 'Un.', ...gone([[0, '```\nx <b>\n```']]) });
  expect(removed()[0].querySelector('pre code')?.textContent).toBe('x <b>');
});

it('removed : du HTML dans un retrait est rendu en texte (I-40)', async () => {
  await draw({ md: 'Un.', ...gone([[0, '<b>gras</b> <img src=x onerror=alert(1)>']], '- <script>x</script>') });
  expect(page.querySelector('b, img, script')).toBeNull();
  expect(removed()[0].textContent).toContain('<b>gras</b>');
  expect(removed()[1].textContent).toContain('<script>x</script>');
});

it('removed : onQuote, onComment, onAsk, tag, itemStart, itemEnd, blockEnd : rien sur un retrait', async () => {
  await draw({ md: 'Un.\n\n- a', ...marks, ...gone([[0, 'P'], [2, '- I']], 'Fin.') });
  expect(removed()).toHaveLength(3);
  for (const r of removed()) expect(r.querySelector('button, .vc-quote, .m-tag, .m-start, .m-end, .m-block, textarea')).toBeNull();
  expect(page.querySelectorAll('.vc-quote').length).toBeGreaterThan(0);   // le texte actuel les garde
  expect(page.querySelectorAll('.m-start').length).toBe(1);
});

it('removed : focus et changed visent les lignes du texte actuel', async () => {
  const proto = Element.prototype as { scrollIntoView?: () => void };
  const before = proto.scrollIntoView;
  proto.scrollIntoView = () => {};
  try {
    await draw({ md: 'Un.\n\n- a\n- b', focus: 3, changed: new Set([2]), ...gone([[0, 'P'], [3, 'x']], 'Fin.') });
  } finally { proto.scrollIntoView = before; }
  expect([...page.querySelectorAll('[data-focus]')].map((e) => e.textContent)).toEqual(['b']);
  expect([...page.querySelectorAll('[data-changed]')].map((e) => e.textContent)).toEqual(['a']);
  expect(page.querySelector('.vc-removed [data-focus], .vc-removed [data-changed]')).toBeNull();
});
