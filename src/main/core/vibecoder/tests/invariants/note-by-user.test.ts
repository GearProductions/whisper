// Invariant de la note, validée par l'utilisateur seul (note 0.16.0, docs/tickets/feat/0.16.0-controle-en-trois-points.md,
// « Ce que ça ne doit pas faire ») :
//   - I-67 « Valider la note à la place de l'utilisateur, ou changer sa conception, quel que soit le rythme ».
// Ni le relevé (vibeView), ni les validations du système (vibeMarks), Vibe en cours et en express compris, ne tiennent
// la note pour validée ou ne la valident ; une note validée puis changée ne garde son ✓ (keepNote) que si le changement
// n'ajoute que le texte exact d'une réponse « Accepter » choisie par l'utilisateur (acceptedTexts) ; tout autre
// changement fait tomber le ✓, une note jamais validée ou refusée ne le reçoit pas par ce chemin.
// Vérifier, puis valider la note, deux gestes (« Ce que ça fait » 2) : la fin d'une vérification (designEnd), quel que
// soit son résultat, ne valide pas la note ; le clic Valider la note du créateur (noteClick) pose une marque, il ne lance
// pas de vérification, la note vérifiée ou pas.
// Sur le vrai principal (le rythme express, la CLI, le disque) : app/controllers/tests/invariants/note-by-user.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur les fonctions pures : vibeView, vibeMarks, keepNote, acceptedTexts, designEnd, noteClick.
import { describe, expect, it } from 'vitest';
import type { VibeQuestion } from 'shared/bridge';
import {
  acceptedTexts, blobSha, designChecked, designEnd, keepNote, markState, noteClick, noteDesign, vibeMarks, vibeView,
  type ActionDef, type JourneyInput, type Marks,
} from 'core/vibecoder';

// Les actions du brief, en français.
const A = (id: string, flow: ActionDef['flow'], step: ActionDef['step'], text: string, needs: ActionDef['needs'] = 'none'): ActionDef =>
  ({ id, flow, step, kind: 'send', needs, label: id, hint: '', text });
const ACTIONS: ActionDef[] = [
  A('note', 'create', 'note', '/vibecoder:note {{lang}} {{out}} {{text}}', 'text'),
  A('forme', 'create', 'forme', '/vibecoder:forme {{lang}} {{out}} {{text}}'),
  A('invariants', 'create', 'invariants', '/vibecoder:invariants {{lang}} {{out}} {{text}}'),
  A('commit', 'create', 'modules', '/vibecoder:commit {{lang}} {{out}}'),
  A('modules', 'create', 'modules', '/vibecoder:modules {{lang}} {{out}}'),
  A('vibe', 'create', null, '/vibecoder:vibe {{lang}} {{out}}'),
];

// La note du ticket, commitée avec sa Forme et son test d'invariant.
const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton qui dit bonjour.', '',
  '## Ce que ça ne doit pas faire', '- Lire un autre fichier. → invariant', '',
  '## Forme', '```', 'src/core/hello.ts    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
const TEST = 'it("ne lit rien d\'autre", () => {});\n';
const commit = (hash: string, subject: string, files: string[]) => ({ hash: hash.repeat(40).slice(0, 40), subject, files });
const NOW = 1_700_000_000_000;
// La validation de la note par l'utilisateur, pour sa conception d'aujourd'hui.
const NOTE_OK: Marks = { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ok' } };

const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  agentId: 'a1', lang: 'fr', flow: 'create', pr: null, agent: { model: 'opus', effort: 'high', mode: 'default' },
  busy: false, running: [], runs: [],
  repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH], commits: [commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH])] },
  error: null, note: { path: NOTE_PATH, text: NOTE, before: null }, tests: [{ path: TEST_PATH, blob: blobSha(TEST), text: TEST }],
  readings: {}, outputs: {}, marks: {}, draft: [], actions: ACTIONS,
  who: {}, model: {}, skills: [], exists: () => false, now: NOW, ...over,
});
const noteStep = (v: ReturnType<typeof vibeView>) => v.steps.find((s) => s.id === 'note')!;
// Le relevé où chaque étape est donnée pour faite : ce que vibeMarks reçoit de plus favorable.
function allDone(over: Partial<JourneyInput> = {}) {
  const v = vibeView(input({ vibe: true, express: true, ...over }));
  return { ...v, steps: v.steps.map((s) => ({ ...s, status: 'done' as const })) };
}

// La conception validée ; un texte « Accepter » ; la conception qui l'ajoute tel quel, à sa place, en paragraphe.
const VALIDATED = ['## Ce que ça fait', '', 'Un bouton qui dit bonjour.', '', '## Ce que ça ne doit pas faire', '',
  '- Lire un autre fichier. → invariant'].join('\n');
const ACCEPTED = 'Il se tait la nuit.';
const WITH_ACCEPTED = VALIDATED.replace('Un bouton qui dit bonjour.\n', `Un bouton qui dit bonjour.\n\n${ACCEPTED}\n`);
// La note validée pour la conception VALIDATED.
const MARKS: Marks = { note: { hash: blobSha(VALIDATED), verdict: 'ok' } };

describe('I-67 : la note n’est validée que par l’utilisateur, quel que soit le rythme', () => {
  it('Vibe en cours, en express, la note sans ✓ : l’étape Note n’est pas faite', () => {
    const checked = vibeView(input({ vibe: true, express: true, marks: NOTE_OK }));

    const unchecked = vibeView(input({ vibe: true, express: true, marks: {} }));

    // témoin : la même note, avec le ✓ de l'utilisateur, est faite
    expect(noteStep(checked).status).toBe('done');
    // sans son ✓, ni Vibe ni l'express ne la tiennent pour faite
    expect(noteStep(unchecked).status).not.toBe('done');
  });

  it('Vibe en cours, au rythme par défaut, la note sans ✓ : l’étape Note n’est pas faite', () => {
    const checked = vibeView(input({ vibe: true, express: false, marks: NOTE_OK }));

    const unchecked = vibeView(input({ vibe: true, express: false, marks: {} }));

    // témoin : la même note, avec le ✓ de l'utilisateur, est faite
    expect(noteStep(checked).status).toBe('done');
    // sans son ✓, Vibe ne la tient pas pour faite
    expect(noteStep(unchecked).status).not.toBe('done');
  });

  // Chaque étape donnée pour faite, la note comprise.
  it('les validations du système, Vibe en cours et en express : la note ne reçoit aucune validation', () => {
    const marks = vibeMarks({}, allDone());

    // aucune marque sur la note
    expect(marks).not.toHaveProperty(['note']);
  });

  // Chaque étape donnée pour faite, la note comprise.
  it('les validations du système, Vibe en cours au rythme par défaut : la note ne reçoit aucune validation', () => {
    const marks = vibeMarks({}, allDone({ express: false }));

    // aucune marque sur la note
    expect(marks).not.toHaveProperty(['note']);
  });

  it('les validations du système sur une note refusée (✗) : son ✗ reste', () => {
    const refused: Marks = { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' } };

    const marks = vibeMarks(refused, allDone({ marks: refused }));

    // la marque de la note est celle de l'utilisateur, telle quelle
    expect(marks.note).toEqual(refused.note);
  });
});

describe('I-67 : la note changée ne garde son ✓ que pour le texte exact d’une réponse « Accepter » choisie', () => {
  it('un texte accepté ajouté, plus une autre ligne : le ✓ ne suit pas', () => {
    const kept = keepNote(MARKS, { validated: VALIDATED, design: WITH_ACCEPTED, accepted: [ACCEPTED] });
    const more = `${WITH_ACCEPTED}\n- Une ligne que personne n’a acceptée.`;

    const result = keepNote(MARKS, { validated: VALIDATED, design: more, accepted: [ACCEPTED] });

    // témoin : le texte accepté seul, le ✓ suit la nouvelle conception
    expect(markState(kept, 'note', blobSha(WITH_ACCEPTED))).toBe('ok');
    // une ligne de plus : les validations restent telles quelles, le ✓ tombe au relevé
    expect(result).toEqual(MARKS);
  });

  it('un texte accepté ajouté avec un mot changé : le ✓ ne suit pas', () => {
    const kept = keepNote(MARKS, { validated: VALIDATED, design: WITH_ACCEPTED, accepted: [ACCEPTED] });
    const edited = WITH_ACCEPTED.replace(ACCEPTED, 'Il se tait le jour.');

    const result = keepNote(MARKS, { validated: VALIDATED, design: edited, accepted: [ACCEPTED] });

    // témoin : le texte accepté tel quel, le ✓ suit la nouvelle conception
    expect(markState(kept, 'note', blobSha(WITH_ACCEPTED))).toBe('ok');
    // le texte retouché n'est plus celui accepté : les validations restent telles quelles
    expect(result).toEqual(MARKS);
  });

  it('une ligne de la conception validée retirée, un texte accepté ajouté : le ✓ ne suit pas', () => {
    const kept = keepNote(MARKS, { validated: VALIDATED, design: WITH_ACCEPTED, accepted: [ACCEPTED] });
    const removed = WITH_ACCEPTED.replace('- Lire un autre fichier. → invariant', '');

    const result = keepNote(MARKS, { validated: VALIDATED, design: removed, accepted: [ACCEPTED] });

    // témoin : rien de retiré, le ✓ suit la nouvelle conception
    expect(markState(kept, 'note', blobSha(WITH_ACCEPTED))).toBe('ok');
    // une ligne validée en moins : les validations restent telles quelles
    expect(result).toEqual(MARKS);
  });

  it('une ligne de la conception validée réécrite, aucun texte accepté : le ✓ ne suit pas', () => {
    const rewritten = VALIDATED.replace('Un bouton qui dit bonjour.', 'Un bouton qui dit au revoir.');

    const result = keepNote(MARKS, { validated: VALIDATED, design: rewritten, accepted: [] });

    // les validations restent telles quelles
    expect(result).toEqual(MARKS);
  });

  it('la conception validée pas retenue : le ✓ ne suit pas', () => {
    const result = keepNote(MARKS, { validated: null, design: WITH_ACCEPTED, accepted: [ACCEPTED] });

    // sans la conception validée, rien ne prouve que seul le texte accepté a été ajouté
    expect(result).toEqual(MARKS);
  });

  it('la note jamais validée, un texte accepté ajouté : elle ne reçoit pas de ✓', () => {
    const result = keepNote({}, { validated: VALIDATED, design: WITH_ACCEPTED, accepted: [ACCEPTED] });

    // aucune marque sur la note
    expect(result).not.toHaveProperty(['note']);
  });

  it('la note refusée (✗), un texte accepté ajouté : elle ne reçoit pas de ✓', () => {
    const refused: Marks = { note: { hash: blobSha(VALIDATED), verdict: 'ko' } };

    const result = keepNote(refused, { validated: VALIDATED, design: WITH_ACCEPTED, accepted: [ACCEPTED] });

    // la marque de l'utilisateur reste telle quelle
    expect(result).toEqual(refused);
  });
});

describe('I-67 : seul un « Accepter » proposé, choisi mot pour mot, compte comme texte accepté', () => {
  // Une question de la vérification de conception et ses réponses proposées (skill conception).
  const OPTION_OK = `**Accepter** — *Ce que ça fait, puce 2* : « ${ACCEPTED} »`;
  const OPTION_KO = `**Refuser** — *Ce que ça fait, puce 2* : « ${ACCEPTED} »`;
  const QUESTIONS: VibeQuestion[] = [{ n: 1, text: 'Le bouton parle-t-il la nuit ?', options: [OPTION_OK, OPTION_KO, '**Conseille-moi**'] }];

  it('une réponse libre qui cite un texte entre « » : rien n’est accepté', () => {
    const chosen = acceptedTexts(QUESTIONS, [OPTION_OK]);

    const free = acceptedTexts(QUESTIONS, [`Mets plutôt : « ${ACCEPTED} »`]);

    // témoin : l'« Accepter » proposé, choisi tel quel, donne son texte
    expect(chosen).toContain(ACCEPTED);
    // une réponse écrite par ailleurs ne donne rien
    expect(free).not.toContain(ACCEPTED);
  });

  it('un « Accepter » suivi d’une précision libre : rien n’est accepté', () => {
    const chosen = acceptedTexts(QUESTIONS, [OPTION_OK]);

    const precised = acceptedTexts(QUESTIONS, [`${OPTION_OK} Mais seulement en semaine.`]);

    // témoin : l'« Accepter » proposé, choisi tel quel, donne son texte
    expect(chosen).toContain(ACCEPTED);
    // la précision en fait une réponse libre
    expect(precised).not.toContain(ACCEPTED);
  });

  it('« Refuser » choisi : son texte n’est pas accepté', () => {
    const chosen = acceptedTexts(QUESTIONS, [OPTION_OK]);

    const rejected = acceptedTexts(QUESTIONS, [OPTION_KO]);

    // témoin : l'« Accepter » proposé, choisi tel quel, donne son texte
    expect(chosen).toContain(ACCEPTED);
    // le texte d'un refus n'entre pas
    expect(rejected).not.toContain(ACCEPTED);
  });
});

describe('I-67 : Vérifier ne valide jamais la note, quel que soit son résultat', () => {
  // L'empreinte de la conception d'où la vérification est partie.
  const CLICKED = blobSha(noteDesign(NOTE));

  it('la vérification finie sans question : la note n’est pas validée', () => {
    const marks = designEnd({}, { path: NOTE_PATH, state: 'done', questions: 0, clicked: CLICKED });

    // témoin : la vérification est bien retenue pour cette note
    expect(designChecked(marks, NOTE_PATH)).toBe(true);
    // aucune marque sur la note
    expect(marks).not.toHaveProperty(['note']);
  });

  it('la vérification finie avec une question : la note n’est pas validée', () => {
    const marks = designEnd({}, { path: NOTE_PATH, state: 'done', questions: 1, clicked: CLICKED });

    // témoin : la vérification est bien retenue pour cette note
    expect(designChecked(marks, NOTE_PATH)).toBe(true);
    // aucune marque sur la note
    expect(marks).not.toHaveProperty(['note']);
  });

  it('la vérification en échec : la note n’est pas validée', () => {
    const marks = designEnd({}, { path: NOTE_PATH, state: 'failed', questions: 0, clicked: CLICKED });

    // aucune marque sur la note
    expect(marks).not.toHaveProperty(['note']);
  });

  it('la vérification arrêtée : la note n’est pas validée', () => {
    const marks = designEnd({}, { path: NOTE_PATH, state: 'stopped', questions: 0, clicked: CLICKED });

    // aucune marque sur la note
    expect(marks).not.toHaveProperty(['note']);
  });

  // Une note que l'utilisateur a refusée (✗), puis une vérification qui ne trouve rien.
  it('la note refusée, la vérification finie sans question : son ✗ reste', () => {
    const refused: Marks = { note: { hash: CLICKED, verdict: 'ko' } };

    const marks = designEnd(refused, { path: NOTE_PATH, state: 'done', questions: 0, clicked: CLICKED });

    // la marque de la note est celle de l'utilisateur, telle quelle
    expect(marks.note).toEqual(refused.note);
  });
});

describe('I-67 : Valider la note ne lance aucune vérification', () => {
  it('le créateur valide une note jamais vérifiée : une marque, pas de vérification', () => {
    const gesture = noteClick({}, NOTE_PATH, 'ok', 'create');

    // le clic pose la marque de l'utilisateur, il ne lance pas la vérification
    expect(gesture).toBe('mark');
  });

  it('le créateur valide une note après une vérification sans question : une marque, pas de vérification', () => {
    const checked = designEnd({}, { path: NOTE_PATH, state: 'done', questions: 0, clicked: blobSha(noteDesign(NOTE)) });

    const gesture = noteClick(checked, NOTE_PATH, 'ok', 'create');

    // témoin : la note est bien vérifiée
    expect(designChecked(checked, NOTE_PATH)).toBe(true);
    // le clic pose la marque de l'utilisateur, il ne lance pas de nouvelle vérification
    expect(gesture).toBe('mark');
  });
});
