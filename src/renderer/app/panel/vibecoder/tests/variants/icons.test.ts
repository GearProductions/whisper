// @vitest-environment happy-dom
// icons (icons.tsx) : Icon et iconElement, le même dessin (16×16, aria-hidden, currentColor) ;
// IconButton : vc-tool, libellé en title et aria-label, pressed → aria-pressed, grisé sans clic.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { Icon, IconButton, iconElement, type IconName } from '../../icons';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const NAMES: IconName[] = ['close', 'open', 'external', 'diff', 'comment', 'ok', 'ko', 'warn', 'stop', 'play', 'refresh',
  'edit', 'pull', 'push', 'rebase'];
const paths = (svg: Element) => [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'));

it('Icon et iconElement : le même dessin, 16×16, aria-hidden, currentColor', async () => {
  for (const name of NAMES) {
    await act(() => root.render(createElement(Icon, { name })));
    const svg = page.querySelector('svg')!;
    const el = iconElement(name);
    expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(paths(svg).length).toBeGreaterThan(0);
    expect(paths(el)).toEqual(paths(svg));
    for (const s of [svg, el]) {
      expect(s.getAttribute('viewBox')).toBe('0 0 16 16');
      expect(s.getAttribute('aria-hidden')).toBe('true');
      expect(s.getAttribute('stroke')).toBe('currentColor');
      expect(s.getAttribute('stroke-width')).toBe('1.5');
    }
  }
});

it('IconButton : vc-tool, libellé en title et aria-label, pressed, grisé', async () => {
  let clicks = 0;
  const draw = (more: object = {}) => act(() => root.render(createElement(IconButton,
    { icon: 'comment', label: 'Commenter', onClick: () => { clicks++; }, ...more })));
  await draw();
  const button = () => page.querySelector('button')!;
  expect(button().className).toBe('vc-tool');
  expect(button().title).toBe('Commenter');
  expect(button().getAttribute('aria-label')).toBe('Commenter');
  expect(button().hasAttribute('aria-pressed')).toBe(false);
  expect(button().type).toBe('button');
  button().click();
  expect(clicks).toBe(1);
  await draw({ pressed: true, className: 'vc-x' });
  expect(button().getAttribute('aria-pressed')).toBe('true');
  expect(button().className).toBe('vc-tool vc-x');
  await draw({ disabled: true });
  button().click();
  expect(clicks).toBe(1);
});
