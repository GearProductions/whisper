// @vitest-environment happy-dom
// TagBadge (tag-badge.tsx) : « pour toi » (data-tag toi) et « pour l'agent » (data-tag agent), du texte
// sans crochets, dans la langue de l'écran (t.tags).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { Tag } from 'core/vibecoder';
import { TagBadge } from '../../tag-badge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function badge(tag: Tag, lang: 'fr' | 'en') {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(TagBadge, { tag, t: t(lang) })));
  const el = page.querySelector('.vc-tag-badge');
  const out = { text: el?.textContent, tag: el?.getAttribute('data-tag') };
  await act(() => root.unmount());
  page.remove();
  return out;
}

it('toi : « pour toi », data-tag toi ; agent : « pour l\'agent », data-tag agent', async () => {
  expect(await badge('toi', 'fr')).toEqual({ text: 'pour toi', tag: 'toi' });
  expect(await badge('agent', 'fr')).toEqual({ text: 'pour l\'agent', tag: 'agent' });
});

it('en anglais : « for you », « for the agent »', async () => {
  expect(await badge('toi', 'en')).toEqual({ text: 'for you', tag: 'toi' });
  expect(await badge('agent', 'en')).toEqual({ text: 'for the agent', tag: 'agent' });
});
