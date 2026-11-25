import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  blobSha, caseHashes, caseTarget, CHECKED, setCaseMark, setMark, stepChecks, stepContent, validateStep, type CheckedStep, type FileBlobs,
  type Marks, type StepContent,
} from 'core/vibecoder';
import { caseKeys } from 'shared/test-cases';

type V = Pick<VibeView, 'note' | 'invariants' | 'modules'>;
type Contents = Record<CheckedStep, StepContent | null>;

const T = 'src/a/tests/invariants/a.test.ts';

type Spec = {
  does?: string; forme?: string | null; noNote?: boolean; mustNot?: string;
  tests?: Record<string, { source: string; cases: string[]; blocks?: string[]; common?: string; noHashes?: boolean }>; code?: Record<string, string>; deleted?: string[];
};

// Un relevé à la main : la note, les tests (le disque a leur texte), les fichiers des modules.
function build(s: Spec = {}): { view: V; blobs: FileBlobs[] } {
  const forme = s.forme === null ? '' : `\n\n## Forme\n\n${s.forme ?? 'src/a/index.ts  contrat'}`;
  const text = `# T\n\n## Ce que ça fait\n\n${s.does ?? 'il fait A'}${forme}\n\n## Ce que ça ne doit pas faire\n\n${s.mustNot ?? '- rien'}\n`;
  const tests = s.tests ?? { [T]: { source: 'test A', cases: ['c1', 'c2'] } };
  const code = s.code ?? { 'src/a/index.ts': 'code A', 'src/a/b.ts': 'code B' };
  const blobs: FileBlobs[] = [...Object.entries(tests).map(([path, t]) => [path, t.source]), ...Object.entries(code)]
    .map(([path, t]) => ({ path, disk: blobSha(t), head: null }));
  return {
    blobs,
    view: {
      note: s.noNote ? null : ({ id: 'n', path: 'docs/n.md', text } as V['note']),
      invariants: Object.entries(tests).map(([path, t]) => ({
        path, id: path, cases: t.cases, blob: blobSha(t.source),
        ...(!t.noHashes && { hashes: { blocks: t.blocks ?? t.cases.map((c) => blobSha(`bloc ${c}`)), common: blobSha(t.common ?? 'commun') } }),
      })) as V['invariants'],
      modules: [{ files: [...Object.keys(code).map((path) => ({ id: path, path })), ...(s.deleted ?? []).map((path) => ({ id: path, path, deleted: true }))] }] as V['modules'],
    },
  };
}

const contentsOf = (view: V, marks: Marks, blobs: FileBlobs[]): Contents =>
  Object.fromEntries(CHECKED.map((s) => [s, stepContent(view, marks, s, blobs)])) as Contents;
// Un cas ✓ pour ses empreintes d'aujourd'hui (la clé de caseKeys), un autre verdict au besoin.
const markCase = (m: Marks, v: V, path: string, i: number, verdict: 'ok' | 'ko' = 'ok'): Marks => {
  const f = v.invariants.find((x) => x.path === path)!;
  const target = caseTarget(path, caseKeys(f.cases)[i]);
  return setCaseMark(m, target, caseHashes(v.invariants, target)!, verdict);
};
const casesOk = (m: Marks, v: V) => v.invariants.reduce((acc, f) => f.cases.reduce((a, _c, i) => markCase(a, v, f.path, i), acc), m);
const states = (m: Marks, c: Contents) => CHECKED.map((s) => stepChecks(m, c)[s].state);

// Valide les étapes dans l'ordre, comme le contrôleur : chaque geste recalcule les contenus d'après les marques d'alors.
function validate(m: Marks, s: Spec, steps: readonly CheckedStep[] = CHECKED): Marks {
  const { view, blobs } = build(s);
  return steps.reduce((acc, step) => {
    const withCases = step === 'invariants' ? casesOk(acc, view) : acc;
    const next = validateStep(withCases, contentsOf(view, withCases, blobs), step, 'ok');
    if (!next) throw new Error(`refusé : ${step}`);
    return next;
  }, m);
}
const now = (m: Marks, s: Spec = {}) => { const { view, blobs } = build(s); return contentsOf(view, casesOk(m, view), blobs); };
const checksAfter = (m: Marks, s: Spec = {}) => { const { view, blobs } = build(s); const c = contentsOf(view, casesOk(m, view), blobs); return stepChecks(m, c); };

describe('stepContent', () => {
  it('modules : tout ce que git voit changer (changed), hors la note et les tests d\'invariants ; un fichier hors de la Forme modifié change l\'empreinte', () => {
    const { view, blobs } = build();
    const css = { path: 'src/a/style.css', disk: blobSha('css A'), head: null };
    const changed = ['docs/n.md', T, 'src/a/index.ts', 'src/a/style.css', 'other/tests/invariants/x.test.ts'];
    const a = stepContent({ ...view, changed }, {}, 'modules', [...blobs, css])!;
    expect(Object.keys(a.files).sort()).toEqual(['src/a/b.ts', 'src/a/index.ts', 'src/a/style.css']);
    const b = stepContent({ ...view, changed }, {}, 'modules', [...blobs, { ...css, disk: blobSha('css B') }])!;
    expect(b.hash).not.toBe(a.hash);
  });

  it('la Forme seule changée ne change pas l’empreinte de la note ; elle change celle de la Forme', () => {
    const a = build({ forme: 'src/a/index.ts  un contrat' });
    const b = build({ forme: 'src/a/index.ts  un autre contrat, plus long' });
    expect(stepContent(b.view, {}, 'note', b.blobs)!.hash).toBe(stepContent(a.view, {}, 'note', a.blobs)!.hash);
    expect(stepContent(b.view, {}, 'forme', b.blobs)!.hash).not.toBe(stepContent(a.view, {}, 'forme', a.blobs)!.hash);
  });

  it('la conception changée change l’empreinte de la note', () => {
    const a = build();
    const b = build({ does: 'il fait B' });
    expect(stepContent(b.view, {}, 'note', b.blobs)!.hash).not.toBe(stepContent(a.view, {}, 'note', a.blobs)!.hash);
  });

  it('la Forme retient la note (son texte) et les fichiers des modules (leur empreinte sur le disque), pas ceux supprimés ni sans empreinte', () => {
    const { view, blobs } = build({ deleted: ['src/a/gone.ts'] });
    const withGhost = [...blobs.filter((b) => b.path !== 'src/a/b.ts'), { path: 'src/a/gone.ts', disk: null, head: 'x' }];
    const note = { 'docs/n.md': blobSha(view.note!.text) };
    expect(stepContent(view, {}, 'forme', blobs)!.files).toEqual({ ...note, 'src/a/index.ts': blobSha('code A'), 'src/a/b.ts': blobSha('code B') });
    expect(stepContent(view, {}, 'forme', withGhost)!.files).toEqual({ ...note, 'src/a/index.ts': blobSha('code A') });
  });

  it('la Forme seule changée change la liste retenue (la note y est), pas l’empreinte de la note', () => {
    const a = build({ forme: 'src/a/index.ts  un contrat' });
    const b = build({ forme: 'src/a/index.ts  un autre contrat, plus long' });
    expect(stepContent(b.view, {}, 'forme', b.blobs)!.files['docs/n.md']).not.toBe(stepContent(a.view, {}, 'forme', a.blobs)!.files['docs/n.md']);
  });

  // Les verdicts des tests sont les notes de l'utilisateur (note 0.16.0-ecran-essentiel) : « Validé » n'est pas exigé, seul un
  // test noté « À revoir » pour son contenu d'aujourd'hui laisse l'étape sans rien à valider.
  it('aucun verdict exigé : les fichiers de test, avec ou sans ✓ ; un cas noté ✗ : null', () => {
    const { view, blobs } = build();
    const c = stepContent(view, {}, 'invariants', blobs)!;
    expect(c.files).toEqual({ [T]: blobSha('test A') });
    expect(c.hash).toBe(blobSha(`${blobSha('test A')} ${T}`));
    expect(stepContent(view, markCase({}, view, T, 0), 'invariants', blobs)).toEqual(c);
    expect(stepContent(view, casesOk({}, view), 'invariants', blobs)).toEqual(c);
    expect(stepContent(view, markCase(casesOk({}, view), view, T, 1, 'ko'), 'invariants', blobs)).toBeNull();
    expect(stepContent(view, markCase({}, view, T, 1, 'ko'), 'invariants', blobs)).toBeNull();
  });

  it('un ✗ donné pour un bloc ou un code commun changés depuis ne compte plus : les fichiers de test', () => {
    const ko = markCase({}, build().view, T, 1, 'ko');
    const block = build({ tests: { [T]: { source: 'test A', cases: ['c1', 'c2'], blocks: [blobSha('bloc c1'), blobSha('bloc c2 modifié')] } } });
    expect(stepContent(block.view, ko, 'invariants', block.blobs)).not.toBeNull();
    const common = build({ tests: { [T]: { source: 'test A', cases: ['c1', 'c2'], common: 'autre commun' } } });
    expect(stepContent(common.view, ko, 'invariants', common.blobs)).not.toBeNull();
    // le bloc d'un autre cas changé : le ✗ du sien tient
    const first = build({ tests: { [T]: { source: 'test A', cases: ['c1', 'c2'], blocks: [blobSha('bloc c1 modifié'), blobSha('bloc c2')] } } });
    expect(stepContent(first.view, ko, 'invariants', first.blobs)).toBeNull();
  });

  it('un fichier sans hashes : null, même avec des marques de cas', () => {
    const { view } = build();
    const marks = casesOk({}, view);
    const bare = build({ tests: { [T]: { source: 'test A', cases: ['c1', 'c2'], noHashes: true } } });
    expect(stepContent(bare.view, marks, 'invariants', bare.blobs)).toBeNull();
  });

  it('titres en double : chaque cas a sa clé, le ✗ du second seul suffit à tout refuser', () => {
    const tests = { [T]: { source: 'test A', cases: ['dup', 'dup'] } };
    const { view, blobs } = build({ tests });
    expect(stepContent(view, markCase({}, view, T, 0), 'invariants', blobs)).not.toBeNull();
    expect(stepContent(view, markCase({}, view, T, 1, 'ko'), 'invariants', blobs)).toBeNull();
    expect(stepContent(view, markCase(markCase({}, view, T, 0), view, T, 1, 'ko'), 'invariants', blobs)).toBeNull();
  });

  it('plusieurs fichiers : la liste de tous ; un cas noté ✗ dans l’un suffit à tout refuser', () => {
    const T2 = 'src/b/tests/invariants/b.test.ts';
    const { view, blobs } = build({ tests: { [T]: { source: 'test A', cases: ['c1'] }, [T2]: { source: 'test B', cases: ['d1', 'd2'] } } });
    expect(Object.keys(stepContent(view, {}, 'invariants', blobs)!.files).sort()).toEqual([T, T2]);
    expect(stepContent(view, markCase({}, view, T2, 1, 'ko'), 'invariants', blobs)).toBeNull();
  });

  it('aucun test ni ligne « → invariant » : contenu vide même sans ✓ Rien à écrire, et la cascade jusqu’aux modules est acceptée', () => {
    const { view, blobs } = build({ tests: {} });
    expect(stepContent(view, {}, 'invariants', blobs)).toEqual({ hash: blobSha(''), files: {} });
    const m = validate({}, { tests: {} });
    expect(states(m, now(m, { tests: {} }))).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('une ligne « → invariant » ajoutée après la validation (sans test) : l’étape devient changed', () => {
    const m = validate({}, { tests: {} });
    const c = checksAfter(m, { tests: {}, mustNot: '- x → invariant' });
    expect(c.invariants.state).toBe('changed');
    expect(c.invariants.now).toBeNull();
  });

  it('une ligne « → variant suffit » (pas invariant) ne compte pas comme ligne « → invariant » : contenu vide', () => {
    const { view, blobs } = build({ tests: {}, mustNot: '- x → variant suffit' });
    expect(stepContent(view, {}, 'invariants', blobs)).toEqual({ hash: blobSha(''), files: {} });
  });

  it('plusieurs lignes « ne doit pas », une seule marquée invariant : comptée', () => {
    const { view, blobs } = build({ tests: {}, mustNot: '- a → variant suffit\n- b → invariant\n- c → structure' });
    expect(stepContent(view, {}, 'invariants', blobs)).toBeNull();
  });

  it('des lignes « → invariant », aucun test, sans ✓ Rien à écrire : null ; avec : une liste vide', () => {
    const { view, blobs } = build({ tests: {}, mustNot: '- x → invariant' });
    expect(stepContent(view, {}, 'invariants', blobs)).toBeNull();
    const nothing = setMark({}, 'nothing', blobSha(view.note!.text), 'ok');
    expect(stepContent(view, nothing, 'invariants', blobs)).toEqual({ hash: blobSha(''), files: {} });
    // la note changée depuis le ✓ Rien à écrire : plus rien
    const other = build({ tests: {}, mustNot: '- x → invariant', does: 'il fait B' });
    expect(stepContent(other.view, nothing, 'invariants', other.blobs)).toBeNull();
    // avec un test, le ✓ Rien à écrire ne change rien : les fichiers de test
    const withTest = build();
    expect(stepContent(withTest.view, setMark({}, 'nothing', blobSha(withTest.view.note!.text), 'ok'), 'invariants', withTest.blobs)!.files).toEqual({ [T]: blobSha('test A') });
  });

  it('sans note : tout est null ; sans module : les modules null', () => {
    const none = build({ noNote: true, tests: {} });
    for (const step of CHECKED) expect(stepContent(none.view, {}, step, none.blobs)).toBeNull();
    const bare = build({ code: {} });
    expect(stepContent(bare.view, {}, 'modules', bare.blobs)).toBeNull();
    // des fichiers sans empreinte sur le disque : aucun module non plus
    const gone = build();
    expect(stepContent(gone.view, {}, 'modules', gone.blobs.map((b) => ({ ...b, disk: null })))).toBeNull();
  });

  it('une note sans section Forme ne plante pas', () => {
    const { view, blobs } = build({ forme: null });
    expect(typeof stepContent(view, {}, 'forme', blobs)?.hash).toBe('string');
  });

  it('les modules : blobSha de la liste de leurs fichiers', () => {
    const { view, blobs } = build();
    const c = stepContent(view, {}, 'modules', blobs)!;
    expect(c.hash).toBe(blobSha(`${blobSha('code B')} src/a/b.ts\n${blobSha('code A')} src/a/index.ts`));
    expect(c.files).toEqual({ 'src/a/index.ts': blobSha('code A'), 'src/a/b.ts': blobSha('code B') });
  });
});

describe('stepChecks', () => {
  it('jamais validée : null partout, now seulement pour la note (rien avant elle) ', () => {
    const c = checksAfter({});
    expect(CHECKED.map((s) => c[s].state)).toEqual([null, null, null, null]);
    expect(c.note.now).toBe(now({})['note']!.hash);
    expect(c.forme.now).toBeNull();
  });

  it('tout validé et tenu : ok partout, now = l’empreinte d’aujourd’hui', () => {
    const m = validate({}, {});
    const c = checksAfter(m);
    expect(CHECKED.map((s) => c[s].state)).toEqual(['ok', 'ok', 'ok', 'ok']);
    for (const s of CHECKED) expect(c[s].now).toBe(m[s].hash);
  });

  it.each([
    ['forme', { forme: 'src/a/index.ts  un autre contrat' }, ['ok', 'changed', 'cascade', 'cascade']],
    ['un test', { tests: { [T]: { source: 'test A modifié', cases: ['c1', 'c2'] } } }, ['ok', 'ok', 'changed', 'cascade']],
    // les fichiers des modules ne sont retenus par la Forme que pour le diff : ce qu'elle valide, c'est sa section
    ['un module', { code: { 'src/a/index.ts': 'code A modifié', 'src/a/b.ts': 'code B' } }, ['ok', 'ok', 'ok', 'changed']],
  ] as [string, Spec, string[]][])('%s changé : sa propre étape changed, les suivantes en cascade', (_n, change, expected) => {
    const m = validate({}, {});
    // un test modifié peut perdre ses ✓ de cas : on les redonne, ils ne sont pas ce qui est mesuré
    const { view, blobs } = build(change);
    const c = stepChecks(m, contentsOf(view, casesOk(m, view), blobs));
    expect(CHECKED.map((s) => c[s].state)).toEqual(expected);
  });

  it('la note changée : Forme, invariants et modules en cascade, cause « note »', () => {
    const m = validate({}, {});
    const c = checksAfter(m, { does: 'il fait B' });
    expect(CHECKED.map((s) => c[s].state)).toEqual(['changed', 'cascade', 'cascade', 'cascade']);
    expect(c.forme.cause).toBe('note');
    expect(c.invariants.cause).toBe('note');
    expect(c.modules.cause).toBe('note');
    expect(c.note.cause).toBeUndefined();
    // Valider n'est pas offert tant que l'étape d'avant n'est pas cochée
    expect([c.forme.now, c.invariants.now, c.modules.now]).toEqual([null, null, null]);
    expect(c.note.now).not.toBeNull();
  });

  it('la Forme seule changée : la note reste cochée', () => {
    const c = checksAfter(validate({}, {}), { forme: 'src/a/index.ts  un autre contrat' });
    expect(c.note.state).toBe('ok');
    expect(c.forme.state).toBe('changed');
  });

  it('revalider la note : la Forme reste en cascade, sa marque inchangée', () => {
    const m = validate({}, {});
    const redesigned: Spec = { does: 'il fait B' };
    const m2 = validate(m, redesigned, ['note']);
    const c = checksAfter(m2, redesigned);
    expect(CHECKED.map((s) => c[s].state)).toEqual(['ok', 'cascade', 'cascade', 'cascade']);
    expect(c.forme.cause).toBe('note');
    expect(m2.forme).toEqual(m.forme);
    // la Forme est offerte à la validation
    expect(c.forme.now).toBe(m.forme.hash);
  });

  it('revalider la Forme puis les invariants : ok tous deux, les modules encore en cascade', () => {
    const redesigned: Spec = { does: 'il fait B' };
    const m = validate(validate({}, {}), redesigned, ['note']);
    const afterForme = validate(m, redesigned, ['forme']);
    const c1 = checksAfter(afterForme, redesigned);
    expect(CHECKED.map((s) => c1[s].state)).toEqual(['ok', 'ok', 'cascade', 'cascade']);
    expect(c1.invariants.cause).toBe('forme');
    const afterInv = validate(afterForme, redesigned, ['invariants']);
    const c2 = checksAfter(afterInv, redesigned);
    expect(CHECKED.map((s) => c2[s].state)).toEqual(['ok', 'ok', 'ok', 'cascade']);
    expect(c2.modules.cause).toBe('invariants');
    const all = validate(afterInv, redesigned, ['modules']);
    expect(states(all, now(all, redesigned))).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('revalider une étape sans changer son contenu ni celle d’avant : rien ne change', () => {
    const m = validate({}, {});
    expect(validate(m, {}, ['forme'])).toEqual(m);
    expect(states(m, now(m))).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('une étape décochée (retirée) en milieu de course : les suivantes en cascade, leurs marques gardées', () => {
    const m = validate({}, {});
    const { view, blobs } = build();
    const cleared = validateStep(m, contentsOf(view, casesOk(m, view), blobs), 'forme', null)!;
    const c = stepChecks(cleared, contentsOf(view, casesOk(cleared, view), blobs));
    expect(CHECKED.map((s) => c[s].state)).toEqual(['ok', null, 'cascade', 'cascade']);
    expect(c.invariants.cause).toBe('forme');
    expect(c.modules.cause).toBe('forme');
    expect(cleared.invariants).toEqual(m.invariants);
    expect(cleared.modules).toEqual(m.modules);
  });

  it('une marque ko n’est pas une validation', () => {
    const m = { ...validate({}, {}), forme: { hash: 'x', verdict: 'ko' as const } };
    const c = checksAfter(m);
    expect(c.forme.state).toBeNull();
    expect(c.invariants.state).toBe('cascade');
  });

  it('une étape validée dont le contenu est devenu null : changed', () => {
    const m = validate({}, {});
    const { view, blobs } = build();
    // un cas noté « À revoir » : les invariants n'ont plus rien à valider
    const c = stepChecks(m, contentsOf(view, markCase({}, view, T, 0, 'ko'), blobs));
    expect(c.invariants.state).toBe('changed');
    expect(c.invariants.now).toBeNull();
    expect(c.modules.state).toBe('cascade');
    // sans note : plus rien à valider nulle part, chaque étape validée est « changed » (la sienne passe avant la cascade)
    const none = build({ noNote: true });
    const d = stepChecks(m, contentsOf(none.view, {}, none.blobs));
    expect(CHECKED.map((s) => d[s].state)).toEqual(['changed', 'changed', 'changed', 'changed']);
  });

  it('des contenus qui manquent : traités comme null, sans planter', () => {
    const c = stepChecks({}, {});
    expect(CHECKED.map((s) => c[s])).toEqual(CHECKED.map(() => ({ state: null, now: null })));
    const m = validate({}, {});
    expect(stepChecks(m, {}).note.state).toBe('changed');
  });

  it('un commit (head change, disque identique) : rien ne change', () => {
    const m = validate({}, {});
    const { view, blobs } = build();
    const committed = blobs.map((b) => ({ ...b, head: b.disk }));
    const before = contentsOf(view, casesOk(m, view), blobs);
    const after = contentsOf(view, casesOk(m, view), committed);
    expect(after).toEqual(before);
    expect(stepChecks(m, after)).toEqual(stepChecks(m, before));
    expect(states(m, after)).toEqual(['ok', 'ok', 'ok', 'ok']);
  });
});

describe('validateStep', () => {
  it('la marque : empreinte, verdict, after (la marque d’avant), files (la liste des fichiers)', () => {
    const m = validate({}, {});
    expect(m.note).toEqual({ hash: now({}).note!.hash, verdict: 'ok', files: blobSha('') });
    expect(m.note.after).toBeUndefined();
    expect(m.forme.files).toBe(blobSha(`${blobSha(build().view.note!.text)} docs/n.md\n${blobSha('code B')} src/a/b.ts\n${blobSha('code A')} src/a/index.ts`));
    expect(m.forme.after).toBeTypeOf('string');
    expect(m.forme.after).not.toBe(m.invariants.after);
    expect(m.invariants.files).toBe(m.invariants.hash);
  });

  it('l’étape d’avant pas ok : refusé', () => {
    const { view, blobs } = build();
    const c = contentsOf(view, casesOk({}, view), blobs);
    expect(validateStep({}, c, 'forme', 'ok')).toBeNull();
    expect(validateStep({}, c, 'modules', 'ok')).toBeNull();
    const m = validate({}, {}, ['note']);
    expect(validateStep(m, c, 'invariants', 'ok')).toBeNull();
    // la note changée depuis sa validation : la Forme n'est pas offerte
    const changed = build({ does: 'il fait B' });
    expect(validateStep(m, contentsOf(changed.view, m, changed.blobs), 'forme', 'ok')).toBeNull();
    // une marque ko devant : refusé
    expect(validateStep({ ...m, note: { ...m.note, verdict: 'ko' } }, c, 'forme', 'ok')).toBeNull();
  });

  it('rien à valider (contenu null) : refusé', () => {
    const { view, blobs } = build();
    const m = markCase(validate({}, {}, ['note', 'forme']), view, T, 0, 'ko');   // un test noté « À revoir »
    expect(validateStep(m, contentsOf(view, m, blobs), 'invariants', 'ok')).toBeNull();
    expect(validateStep({}, {}, 'note', 'ok')).toBeNull();
    const none = build({ noNote: true });
    expect(validateStep({}, contentsOf(none.view, {}, none.blobs), 'note', 'ok')).toBeNull();
  });

  it('retirer : la marque oubliée, les autres et les cas inchangés', () => {
    const m = validate({}, {});
    const { view, blobs } = build();
    const full = casesOk(m, view);
    const out = validateStep(full, contentsOf(view, full, blobs), 'invariants', null)!;
    expect(out.invariants).toBeUndefined();
    const { invariants: _, ...rest } = full;
    expect(out).toEqual(rest);
    expect(out[`case:${T}:c1`]).toEqual(full[`case:${T}:c1`]);
  });

  it('retirer une étape jamais validée, sans contenu ni étape d’avant : accepté, rien ne change', () => {
    expect(validateStep({}, {}, 'modules', null)).toEqual({});
  });

  it('ne touche pas à l’ancien état', () => {
    const { view, blobs } = build();
    const m = validate({}, {}, ['note']);
    const copy = structuredClone(m);
    validateStep(m, contentsOf(view, m, blobs), 'forme', 'ok');
    expect(m).toEqual(copy);
  });

  // Les fichiers retenus par la Forme ne sont que la référence de son diff : les rafraîchir ne décoche rien.
  it('revalider la Forme avec d’autres fichiers de modules : la liste est rafraîchie, les suivantes restent cochées', () => {
    const m = validate({}, {});
    const edited: Spec = { code: { 'src/a/index.ts': 'code A modifié', 'src/a/b.ts': 'code B' } };
    const m2 = validate(m, edited, ['forme']);
    expect(m2.forme.files).not.toBe(m.forme.files);
    const c = checksAfter(m2, edited);
    expect(CHECKED.map((s) => c[s].state)).toEqual(['ok', 'ok', 'ok', 'changed']);
  });
});
