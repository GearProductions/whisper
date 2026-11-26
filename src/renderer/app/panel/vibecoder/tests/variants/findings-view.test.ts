// @vitest-environment happy-dom
// FindingsView (findings-view.tsx) : les constats de l'agent sur le code, à l'arrêt Publier : un par titre, sa 💬 ouvre une
// zone remplie avec lui, Ajouter la met au brouillon sur sa cible, Annuler n'ajoute rien ; ses remarques déjà au brouillon
// dessous ; aucun bouton de lecture ; un lien passe par le rappel, jamais de HTML inséré.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { findingDraft, findings, findingTarget, remark, t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { FindingsView } from '../../findings-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const drafts: unknown[] = [];
const links: string[] = [];
const runs: unknown[] = [];
const MD = 'Intro de la relecture.\n\n## Fuite du jeton\nle jeton part dans le journal\n\n## Borne oubliée\nla liste n\'est pas bornée\n\n## Nom trompeur\nrenomme la fonction';
const draw = (patch: Record<string, unknown> = {}, md: string | null = MD) => act(() => {
  const view = { lang: 'fr', flow: 'review', actions: [{ id: 'review-commits', kind: 'run' }], outputs: md === null ? {} : { 'pr-5-commits.md': { text: md, time: 1 } },
    pr: { number: 5 }, commits: [], draft: [], ...patch } as unknown as VibeView;
  const props = { view, step: { id: 'pr', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {}, code: null,
    drafts: [{}, () => {}], act: { run: async (...a: unknown[]) => { runs.push(a); return true; }, follow: () => {}, mark: () => {}, prefill: () => {},
      draft: (op: unknown) => { drafts.push(op); }, open: () => {}, openLink: (u: string) => { links.push(u); }, save: async () => true } } as unknown as StepProps;
  root.render(createElement(FindingsView, props));
});
const fresh = () => act(() => { root.render(null); });   // l'état d'un test précédent oublié
const label = t('fr').essentialReview.addRemark;
const bubbles = () => [...page.querySelectorAll(`button[aria-label="${label}"]`)] as HTMLButtonElement[];
const click = (text: string) => act(() => {
  ([...page.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement).click();
});
const type = (box: HTMLTextAreaElement, v: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, v);
  box.dispatchEvent(new Event('input', { bubbles: true }));
});
const list = findings(MD).list;

it('trois constats : leur titre et leur détail, chacun sa bulle', async () => {
  await fresh();
  await draw();
  const text = page.textContent!;
  for (const s of list) { expect(text).toContain(s.title); expect(text).toContain(s.body); }
  expect(text).toContain('Intro de la relecture.');
  expect(text).toContain(t('fr').essentialReview.findingsTitle);
  expect(bubbles()).toHaveLength(3);
  expect(page.querySelector('textarea')).toBeNull();
});

it('la bulle d\'un constat : la zone s\'ouvre, remplie avec le constat, rien au brouillon', async () => {
  await fresh();
  await draw();
  const before = drafts.length;
  await act(() => { bubbles()[1].click(); });
  const boxes = page.querySelectorAll('textarea');
  expect(boxes).toHaveLength(1);
  expect(boxes[0].value).toBe(findingDraft(list[1]));
  expect(drafts.length).toBe(before);
});

it('Ajouter : la remarque est au brouillon, sur ce constat ; la zone se ferme', async () => {
  await fresh();
  await draw();
  await act(() => { bubbles()[0].click(); });
  await type(page.querySelector('textarea')!, 'à corriger avant de fusionner');
  await click(t('fr').commentAdd);
  expect(drafts.at(-1)).toEqual({ add: remark(findingTarget('Fuite du jeton'), 'à corriger avant de fusionner') });
  expect(page.querySelector('textarea')).toBeNull();
});

it('Ajouter sans rien changer : le constat tel quel, sur sa cible', async () => {
  await fresh();
  await draw();
  await act(() => { bubbles()[2].click(); });
  await click(t('fr').commentAdd);
  expect(drafts.at(-1)).toEqual({ add: remark(findingTarget('Nom trompeur'), findingDraft(list[2])) });
});

it('Annuler, ou aucun clic sur la bulle : rien n\'est ajouté au brouillon', async () => {
  await fresh();
  await draw();
  const before = drafts.length;
  await act(() => { bubbles()[0].click(); });
  await click(t('fr').commentCancel);
  expect(page.querySelector('textarea')).toBeNull();
  expect(drafts.length).toBe(before);
});

it('la bulle recliquée : la zone se referme, rien n\'est ajouté', async () => {
  await fresh();
  await draw();
  const before = drafts.length;
  await act(() => { bubbles()[0].click(); });
  await act(() => { bubbles()[0].click(); });
  expect(page.querySelector('textarea')).toBeNull();
  expect(drafts.length).toBe(before);
});

it('un constat déjà au brouillon : sa remarque dessous, grisée ; la croix la retire', async () => {
  await fresh();
  await draw({ draft: [{ id: 7, target: findingTarget('Borne oubliée'), text: 'borner à 100' }, { id: 8, target: 'ailleurs', text: 'autre cible' }] });
  const muted = page.querySelectorAll('.vc-remarks-muted');
  expect(muted).toHaveLength(1);
  expect(muted[0].textContent).toContain('borner à 100');
  expect(muted[0].closest('.vc-finding')!.textContent).toContain('Borne oubliée');
  expect(page.textContent).not.toContain('autre cible');
  await act(() => { (page.querySelector('button[aria-label="Retirer du brouillon"]') as HTMLButtonElement).click(); });
  expect(drafts.at(-1)).toEqual({ remove: 7 });
});

it('une relecture sans constat : son texte, aucune bulle', async () => {
  await fresh();
  await draw({}, 'Rien à signaler sur ce code.');
  expect(page.textContent).toContain('Rien à signaler sur ce code.');
  expect(bubbles()).toHaveLength(0);
});

it('pas encore de relecture : une phrase, aucun bouton', async () => {
  await fresh();
  await draw({}, null);
  expect(page.textContent).toContain(t('fr').essentialReview.findingsEmpty);
  expect(page.querySelectorAll('button')).toHaveLength(0);
  await draw({ pr: null });
  expect(page.textContent).toContain(t('fr').essentialReview.findingsEmpty);
});

it('ni Relire les commits, ni Relancer', async () => {
  await fresh();
  await draw();
  expect(page.textContent).not.toMatch(/Relire les commits|Relancer/);
  expect([...page.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([label, label, label]);
  expect(runs).toEqual([]);
});

it('un lien du texte : ouvert par le rappel, jamais de HTML inséré', async () => {
  await fresh();
  await draw({}, '## Doc\nvoir [la règle](https://example.com/r) et <img src=x onerror=alert(1)>');
  const a = page.querySelector('a') as HTMLAnchorElement;
  await act(() => { a.click(); });
  expect(links).toEqual(['https://example.com/r']);
  expect(page.querySelector('img')).toBeNull();
});
