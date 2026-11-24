// @vitest-environment happy-dom
// validation (validation.tsx) : CaseVerdict, deux badges écrits (Validé, À revoir), celui donné pressé,
// un second clic l'annule ; MarkControl, l'icône devant le texte, sans glyphe Unicode ; 0.16.0 : la note en créateur, Vérifier puis Valider la note,
// 0.16.0 écran essentiel : la forme, les invariants, les modules et « Rien à écrire » n'ont plus de bouton ni d'état en créateur.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { CaseVerdict, MarkControl } from '../../validation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const buttons = () => [...page.querySelectorAll('button')];

it('CaseVerdict : libellés, pressé = le verdict donné, un second clic annule', async () => {
  const marks: unknown[] = [];
  const draw = (state: 'ok' | 'ko' | null) => act(() => root.render(createElement(CaseVerdict,
    { state, lang: 'fr', onMark: (v) => { marks.push(v); } })));
  await draw(null);
  expect(buttons().map((b) => [b.textContent, b.title, b.getAttribute('aria-pressed'), b.className]))
    .toEqual([['Validé', 'Valider', 'false', 'vc-verdict-ok'], ['À revoir', 'À revoir', 'false', 'vc-verdict-ko']]);
  buttons()[0].click();
  buttons()[1].click();
  await draw('ok');
  expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  expect(buttons().map((b) => b.title)).toEqual(['Validé — Cliquer de nouveau pour annuler', 'À revoir']);
  buttons()[0].click();
  buttons()[1].click();
  await draw('ko');
  buttons()[1].click();
  expect(marks).toEqual(['ok', 'ko', null, 'ko', null]);
});

it('MarkControl : l\'icône devant le texte, même texte, mêmes actions', async () => {
  const marks: unknown[] = [];
  const draw = (state: 'ok' | 'ko' | 'changed' | null, review = false) => act(() => root.render(createElement(MarkControl,
    { what: 'note', state, review, lang: 'fr', onMark: (v) => { marks.push(v); } })));
  await draw(null, true);
  expect(buttons().map((b) => [b.textContent, b.querySelector('svg') !== null])).toEqual([['Valider la note', true], ['À revoir', true]]);
  buttons()[0].click();
  buttons()[1].click();
  await draw('changed');
  expect(page.textContent).toBe('Modifiée depuis la validationRevalider');
  expect(page.querySelectorAll('svg')).toHaveLength(2);
  await draw('ko');
  expect(page.querySelector('.vc-vstate')!.textContent).toBe('Note refusée');
  buttons()[0].click();
  expect(marks).toEqual(['ok', 'ko', null]);
  expect(page.textContent).not.toMatch(/[✓✗⚠]/);
});

it('onRemark : sur un « À revoir », le bouton, cliqué → onRemark, rien d\'autre (CaseVerdict et MarkControl)', async () => {
  const log: unknown[] = [];
  const onRemark = () => { log.push('remark'); };
  const onMark = (v: unknown) => { log.push(v); };
  const remark = () => buttons().filter((b) => b.textContent === 'Ajouter une remarque au brouillon');
  await act(() => root.render(createElement(CaseVerdict, { state: 'ko', lang: 'fr', onMark, onRemark })));
  expect(remark()).toHaveLength(1);
  remark()[0].click();
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: 'ko', review: true, lang: 'fr', onMark, onRemark })));
  expect(remark()).toHaveLength(1);
  remark()[0].click();
  expect(log).toEqual(['remark', 'remark']);
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: 'ko', review: true, lang: 'en', onMark, onRemark })));
  expect(buttons().map((b) => b.textContent)).toContain('Add a remark to the draft');
});

it('Validé, ou sans onRemark : pas de bouton', async () => {
  const onRemark = () => {};
  const none = () => buttons().filter((b) => b.textContent === 'Ajouter une remarque au brouillon');
  for (const state of ['ok', null, 'changed'] as const) {
    await act(() => root.render(createElement(MarkControl, { what: 'note', state, review: true, lang: 'fr', onMark: () => {}, onRemark })));
    expect(none()).toHaveLength(0);
  }
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: 'ko', review: true, lang: 'fr', onMark: () => {} })));
  expect(none()).toHaveLength(0);
  for (const state of ['ok', null] as const) {
    await act(() => root.render(createElement(CaseVerdict, { state, lang: 'fr', onMark: () => {}, onRemark })));
    expect(none()).toHaveLength(0);
  }
  await act(() => root.render(createElement(CaseVerdict, { state: 'ko', lang: 'fr', onMark: () => {} })));
  expect(none()).toHaveLength(0);
  expect(buttons()).toHaveLength(2);
});

// 0.16.0, vérifier puis valider : la note en créateur reçoit onCheck (Vérifier) et verified (ce qu'a rendu la dernière vérification).
const drawNote = (over: object, state: 'ok' | 'ko' | 'changed' | null = null, lang: 'fr' | 'en' = 'fr') => act(() => root.render(createElement(MarkControl,
  { what: 'note', state, review: false, lang, onMark: () => {}, onCheck: () => {}, ...over } as never)));

it('note, créateur, jamais vérifiée, ou la dernière vérification a trouvé quelque chose : Vérifier seul, pas de Valider la note', async () => {
  for (const verified of [undefined, null]) {
    for (const state of [null, 'changed'] as const) {
      await drawNote({ verified }, state);
      expect(buttons().map((b) => b.textContent)).toEqual(['Vérifier']);
    }
  }
  await drawNote({ verified: null }, null, 'en');
  expect(buttons().map((b) => b.textContent)).toEqual(['Check']);
});

it('note, créateur, vérifiée sans rien trouver : Valider la note (vert), Vérifier à côté (ordinaire, ni vert ni coche)', async () => {
  await drawNote({ verified: 'clean' });
  const [check, validate] = buttons();
  expect([check.textContent, check.className, check.getAttribute('data-v'), check.querySelector('svg')]).toEqual(['Vérifier', 'vc-vbtn vc-vbtn-plain', null, null]);
  expect([validate.textContent, validate.getAttribute('data-v'), validate.querySelector('svg') !== null, validate.disabled]).toEqual(['Valider la note', 'ok', true, false]);
  expect(page.querySelector('.vc-vstate')).toBeNull();
  await drawNote({ verified: 'clean' }, 'changed');
  expect(buttons().map((b) => b.textContent)).toEqual(['Vérifier', 'Revalider']);
  await drawNote({ verified: 'clean' }, null, 'en');
  expect(buttons().map((b) => b.textContent)).toEqual(['Check', 'Approve the note']);
});

it('note, créateur, rien trouvé mais modifiée depuis : Valider la note reste, Vérifier à côté, et la ligne le dit', async () => {
  await drawNote({ verified: 'edited' });
  expect(buttons().map((b) => b.textContent)).toEqual(['Vérifier', 'Valider la note']);
  expect(page.querySelector('.vc-vstate')!.textContent).toBe('Modifiée depuis la vérification');
  await drawNote({ verified: 'edited' }, null, 'en');
  expect(page.querySelector('.vc-vstate')!.textContent).toBe('Changed since the check');
});

it('note, créateur : Vérifier n\'appelle que onCheck, Valider la note que onMark(\'ok\')', async () => {
  const log: unknown[] = [];
  await drawNote({ verified: 'clean', onCheck: () => { log.push('check'); }, onMark: (v: unknown) => { log.push(v); } });
  buttons()[0].click();
  expect(log).toEqual(['check']);
  buttons()[1].click();
  expect(log).toEqual(['check', 'ok']);
});

it('note, créateur, validée : son état et Annuler, sans Vérifier', async () => {
  await drawNote({ verified: 'clean' }, 'ok');
  expect(page.textContent).toBe('Note validéeAnnuler');
});

it('note, créateur : la course de la vérification est dite à côté de Vérifier', async () => {
  const draw = (run: { state: 'running' | 'queued'; onStop(): void } | undefined, verified?: 'clean') => drawNote({ run, verified });
  await draw({ state: 'running', onStop: () => {} });
  const on = page.querySelector('.vc-run-on')!;
  expect(on.textContent).toBe('en cours');
  expect(on.previousElementSibling).toBe(buttons()[0]);
  expect(buttons()[0].textContent).toBe('Vérifier');
  await draw({ state: 'queued', onStop: () => {} }, 'clean');
  expect(page.querySelector('.vc-run-on')!.textContent).toBe('en attente');
  expect(page.querySelector('.vc-run-on')!.previousElementSibling).toBe(buttons()[0]);
});

it('note, créateur sans onCheck, validée ou pas : un seul bouton, Valider la note (Revalider si modifiée) ; un clic → onMark(\'ok\')', async () => {
  const log: unknown[] = [];
  // checked et onRecheck, d'avant la 0.16.0, ne sont plus lus : le bouton ne change pas.
  const old = { checked: true, onRecheck: () => { log.push('recheck'); } };
  const draw = (state: 'ok' | 'ko' | 'changed' | null, lang: 'fr' | 'en' = 'fr') => act(() => root.render(createElement(MarkControl,
    { what: 'note', state, review: false, lang, onMark: (v: unknown) => { log.push(v); }, ...old } as never)));
  await draw(null);
  expect(buttons().map((b) => b.textContent)).toEqual(['Valider la note']);
  buttons()[0].click();
  expect(log).toEqual(['ok']);
  await draw('changed');
  expect(buttons().map((b) => b.textContent)).toEqual(['Revalider']);
  await draw(null, 'en');
  expect(buttons().map((b) => b.textContent)).toEqual(['Approve the note']);
  await draw('changed', 'en');
  expect(buttons().map((b) => b.textContent)).toEqual(['Approve again']);
  await draw('ok');
  expect(page.textContent).toBe('Note validéeAnnuler');
  expect(log).toEqual(['ok']);
});

it('note : le bouton garde son vert et sa coche (data-v ok, icône), à côté du bouton rien d\'autre', async () => {
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: null, review: false, lang: 'fr', onMark: () => {} })));
  expect(buttons()).toHaveLength(1);
  expect(buttons()[0].getAttribute('data-v')).toBe('ok');
  expect(buttons()[0].querySelector('svg')).not.toBeNull();
});

it('relecteur : Valider la note et À revoir, comme avant (forme comprise, sans bouton discret)', async () => {
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: null, review: true, lang: 'fr', onMark: () => {} })));
  expect(buttons().map((b) => b.textContent)).toEqual(['Valider la note', 'À revoir']);
  expect(buttons().map((b) => b.getAttribute('data-v'))).toEqual(['ok', 'ko']);
});

it('créateur, la forme, les invariants, les modules, « Rien à écrire » : aucun bouton ni état, quel que soit l\'état, by ou run', async () => {
  for (const what of ['forme', 'invariants', 'modules', 'nothing'] as const) {
    for (const state of [null, 'changed', 'ok', 'ko'] as const) {
      for (const extra of [{}, { by: 'system' }, { run: { state: 'running', onStop: () => {} } }, { onCheck: () => {}, verified: 'clean' }, { onRemark: () => {} }]) {
        await act(() => root.render(createElement(MarkControl, { what, state, review: false, lang: 'fr', onMark: () => {}, ...extra } as never)));
        expect(page.textContent).toBe('');
        expect(buttons()).toHaveLength(0);
      }
    }
  }
  await act(() => root.render(createElement(MarkControl, { what: 'forme', state: 'ok', review: false, lang: 'en', by: 'system', onMark: () => {} })));
  expect(page.textContent).toBe('');
});

it('relecteur, la forme, les invariants, les modules : Valider et À revoir, l\'état et Annuler, comme avant', async () => {
  const log: unknown[] = [];
  const want = { forme: ['Valider la forme', 'Forme validée', 'Forme refusée'], invariants: ['Valider les invariants', 'Invariants validés', 'Invariants refusés'], modules: ['Valider les modules', 'Modules validés', 'Modules refusés'] };
  for (const what of ['forme', 'invariants', 'modules'] as const) {
    const draw = (state: 'ok' | 'ko' | 'changed' | null) => act(() => root.render(createElement(MarkControl, { what, state, review: true, lang: 'fr', onMark: (v) => { log.push(v); } })));
    await draw(null);
    expect(buttons().map((b) => [b.textContent, b.getAttribute('data-v')])).toEqual([[want[what][0], 'ok'], ['À revoir', 'ko']]);
    buttons()[0].click();
    buttons()[1].click();
    await draw('changed');
    expect(buttons().map((b) => b.textContent)).toEqual(['Revalider', 'À revoir']);
    await draw('ok');
    expect(page.textContent).toBe(`${want[what][1]}Annuler`);
    await draw('ko');
    expect(page.textContent).toBe(`${want[what][2]}Annuler`);
    buttons()[0].click();
  }
  expect(log).toEqual(['ok', 'ko', null, 'ok', 'ko', null, 'ok', 'ko', null]);
});

it('run : running → « en cours » et ⏹ (onStop) ; queued → « en attente », pas de ⏹ ; sans run : rien ; à côté du bouton', async () => {
  const log: unknown[] = [];
  const draw = (run: { state: 'running' | 'asking' | 'stopped' | 'queued'; onStop(): void } | undefined, lang: 'fr' | 'en' = 'fr') =>
    act(() => root.render(createElement(MarkControl, { what: 'note', state: null, review: false, lang, run, onMark: () => {} })));
  const on = () => page.querySelector('.vc-run-on');
  await draw(undefined);
  expect(on()).toBeNull();
  await draw({ state: 'running', onStop: () => { log.push('stop'); } });
  expect(on()!.textContent).toBe('en cours');
  expect(on()!.previousElementSibling).toBe(buttons()[0]);
  on()!.querySelector('button')!.click();
  await draw({ state: 'queued', onStop: () => { log.push('bad'); } });
  expect(on()!.textContent).toBe('en attente');
  expect(on()!.querySelector('button')).toBeNull();
  await draw({ state: 'stopped', onStop: () => {} });
  expect(on()!.querySelector('button')).toBeNull();
  expect(log).toEqual(['stop']);
  await draw({ state: 'queued', onStop: () => {} }, 'en');
  expect(on()!.textContent).toBe('queued');
});
