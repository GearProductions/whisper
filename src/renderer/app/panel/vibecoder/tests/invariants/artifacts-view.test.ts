// @vitest-environment happy-dom
// Invariant du panneau Artefacts (note 0.13.0,
// docs/tickets/feat/0.13.0-panneau-artifacts.md, « Ce que ça ne doit pas
// faire ») : exécuter un script d'un artefact, ou le laisser joindre le
// réseau — ici la page : une page HTML ou SVG s'affiche dans un cadre en bac à
// sable qui ne permet rien, et le cadre du panneau ne charge que le schéma
// vibe-artifact: (rien d'autre, il ne navigue pas ailleurs). L'en-tête que le
// principal envoie avec la page :
// main/app/controllers/tests/invariants/artifacts.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai composant, monté par React (createRoot) dans une page happy-dom ; la
// vraie page du panneau (conversation.html), lue sur le disque.
import fs from 'node:fs';
import path from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { VibeArtifact } from 'technicals/bridge';
import { ArtifactsView } from 'app/panel/vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// Le panneau Artefacts affiché, ces artefacts listés (le premier choisi par défaut).
async function shown(artifacts: VibeArtifact[]) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const props = { artifacts, lang: 'fr' as const, code: null, onChoose: () => {}, onOpen: () => {}, onCopy: () => {} };
  await act(async () => { root.render(createElement(ArtifactsView, props)); });
  return container;
}

// Les permissions que le bac à sable d'un cadre accorde (allow-scripts…).
const granted = (frame: Element) => (frame.getAttribute('sandbox') ?? '').split(/\s+/).filter(Boolean);

// Les directives d'une CSP : nom → ses valeurs.
const directives = (csp: string) => new Map(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([n, ...v]) => [n.toLowerCase(), v]));

describe('une page d’un artefact s’affiche dans un cadre en bac à sable qui ne permet rien', () => {
  it('une page HTML', async () => {
    const page = await shown([{ id: 'a0', name: 'accueil.html', kind: 'page', size: 10, time: 1, url: 'vibe-artifact://a1/a0?t=1', truncated: false }]);

    const frame = page.querySelector('iframe');

    // témoin : la page est bien affichée dans un cadre
    expect(frame).not.toBeNull();
    // le cadre est en bac à sable
    expect(frame!.hasAttribute('sandbox')).toBe(true);
    // le bac à sable n'accorde rien : ni script, ni formulaire, ni fenêtre, ni navigation
    expect(granted(frame!)).toEqual([]);
  });
});

describe('le cadre du panneau ne charge que vibe-artifact:', () => {
  it('la CSP de conversation.html', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../../conversation.html'), 'utf8');
    const csp = directives(html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)?.[1] ?? '');

    // témoin : la page a bien sa CSP
    expect(csp.get('default-src')).toEqual(["'none'"]);
    // un cadre ne charge que le schéma des artefacts (frame-src, sinon default-src)
    expect(csp.get('frame-src') ?? csp.get('default-src')).toEqual(['vibe-artifact:']);
  });
});
