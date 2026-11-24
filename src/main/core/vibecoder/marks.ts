/** marks — les validations de l'utilisateur (la note, la forme, « rien à écrire »
 *  de l'étape Invariants, un cas de test, une case du plan de test, une case du
 *  § A.3 cochée à la main, un commit du relevé), chacune pour l'empreinte du contenu
 *  validé (targetHash) : « modifié depuis » si le contenu a changé. Les validations
 *  d'étape (note 0.15.0-ecran-statuts) : 'note' pour l'empreinte de sa conception
 *  (noteDesign), 'forme', 'invariants', 'modules' pour celle de step.check.now ; leur
 *  marque porte aussi after (la validation de l'étape d'avant) et files (la liste des
 *  fichiers retenus) — step-checks. Plus de « file: » ni de « step: » (retirés). Un cas : son bloc et le code
 *  commun de son fichier (case-marks, note 0.15.0-invariants-par-cas) ; targetHash n'en donne plus l'empreinte
 *  (null : caseHashes). Le ✓ des
 *  étapes faites pendant Vibe (vibeMarks : note, forme, invariants, par validateStep ; chaque cas par setCaseMark,
 *  ou « Rien à écrire » sans test). Et le brouillon de
 *  revue de chaque PR (relecteur) : ajouter, modifier, retirer une remarque, savoir
 *  si une remarque y est (hasComment). Et la
 *  vérification de conception de la note, gardée avec les validations (la cible
 *  'design'). Rend un nouvel état, ne touche pas à l'ancien.
 *  Le contrôle en trois points (note 0.16.0-controle-en-trois-points) :
 *  - Vérifier, puis valider la note, deux gestes : la vérification ne valide jamais (designEnd ne pose plus la marque
 *    'note'), Valider la note ne lance jamais de vérification (noteClick rend 'mark' pour tout clic, créateur compris,
 *    plus jamais 'check') : la note n'est validée que par la marque que pose le clic de l'utilisateur.
 *    designEnd retient ce que la vérification a rendu : finie sans question (« rien de bloquant »), la cible 'verified'
 *    porte l'empreinte de la conception d'où elle est partie ; finie avec une question, 'verified' est retirée ; en
 *    échec ou arrêtée : rien ne bouge.
 *    designState(marks: Marks, notePath: string, design: string): VibeNoteCheck | null — la dernière vérification de
 *    cette note, pour l'empreinte de sa conception d'aujourd'hui (design) : 'clean' (rien trouvé, la conception
 *    inchangée), 'edited' (rien trouvé, la conception changée depuis : Valider la note reste, l'écran le dit), null
 *    (jamais vérifiée, une autre note, ou la dernière vérification a trouvé quelque chose).
 *  - Les validations d'étape du système : vibeMarks ne dépend plus du mode Vibe et ne valide jamais la note ; la Forme
 *    et les invariants faits (view.steps) reçoivent leur marque avec by: 'system', chaque cas son ✓ comme avant (un ✓
 *    ou ✗ déjà donné reste) ; une marque d'étape posée à la main (sans by) pour ce contenu reste telle quelle.
 *    Les modules : par step.validate (le contrôleur, by: 'system'), jamais ici.
 *  - keepNote(marks: Marks, o: { validated: string | null; design: string; accepted: string[] }): Marks — la note
 *    validée puis changée : sa marque passe à la conception d'aujourd'hui (design) si celle-ci n'ajoute à la conception
 *    validée (validated : son texte retenu, null : pas retenu) que des textes de accepted (onlyAccepted) ; sinon,
 *    sans marque 'ok' sur la note, ou la marque déjà à jour : marks tel quel (le ✓ tombe : « modifiée depuis »).
 *  - Un ✓ d'étape retiré à la main, enregistré : la cible 'withdrawn:<étape>' des marques porte l'empreinte du contenu
 *    dont la validation a été retirée (la Forme, les invariants, les modules).
 *    withdraw(marks: Marks, step: CheckedStep, hash: string | null): Marks — le retrait retenu pour ce contenu ; null :
 *    oublié (l'étape revalidée à la main). withdrawn(marks: Marks, step: CheckedStep): string | null — l'empreinte
 *    retenue, null sans retrait. vibeMarks ne repose pas la validation d'une étape dont le contenu d'aujourd'hui est
 *    celui du retrait, ni (l'étape d'avant pas cochée : validateStep refuse) celle des étapes qui suivent ; le contenu
 *    changé : validée de nouveau. Rangé avec les marques (vibecoder-state.json, par app/settings) : le retrait survit à
 *    un redémarrage de l'appli et suit l'agent, sans fichier ni mémoire de plus.
 *  Ne connaît pas : Electron, le disque (l'état est rangé par app/settings), la
 *  course design-check (le contrôleur lui dit comment elle a fini), le rythme (par défaut, express), les réponses
 *  envoyées (les textes acceptés sont passés).
 *  Utilisé par : core/vibecoder (journey : checked, verified ; step-checks), app/controllers/vibecoder, app/settings. */
import type { VibeComment, VibeFlow, VibeMarkState, VibeNoteCheck, VibeView } from 'shared/bridge';
import { caseKeys } from 'shared/test-cases';
import { onlyAccepted } from './accepted';
import { caseHashes, caseMarkState, caseTarget, setCaseMark } from './case-marks';
import { noteDesign } from './note';
import { stepChecks, stepContents, validateStep, type CheckedStep } from './step-checks';
import { blobSha } from './test-files';
import type { FileBlobs } from './validated';

// Par cible ('note', 'forme', 'nothing' (pour le texte de la note), 'case:<chemin du fichier>:<clé du cas>' (case-marks), 'check:<rang>' (une case du plan à l'écran, ecran.md), 'a3:<rang>', 'commit:<hash>',
// 'invariants', 'modules' (step-checks) ; 'file:<chemin>' et 'step:<étape>' : retirés).
// after, files : une validation d'étape (step-checks) — l'empreinte de la marque de l'étape d'avant, celle de sa liste de fichiers.
// common : un cas (case-marks) — l'empreinte du code commun de son fichier ; hash, celle de son bloc (absent : une marque d'avant
// la 0.15.0, sur le fichier entier, convertCaseMarks).
// by : une validation d'étape posée par le système ('system') ; absent : par l'utilisateur.
// 'withdrawn:<étape>' : le retrait à la main de la validation d'une étape, pour l'empreinte de son contenu d'alors (withdraw).
// 'verified' : la dernière vérification de conception n'a rien trouvé, pour l'empreinte de la conception d'où elle est partie (designEnd).
export type Marks = Record<string, { hash: string; verdict: 'ok' | 'ko'; after?: string; files?: string; common?: string; by?: 'system' }>;
// Par numéro de PR.
export type Drafts = Record<string, VibeComment[]>;

// Le verdict s'il porte sur `hash`, 'changed' s'il porte sur un autre contenu, null sans validation.
export function markState(marks: Marks, target: string, hash: string): VibeMarkState {
  const mark = Object.hasOwn(marks, target) ? marks[target] : undefined;
  return !mark ? null : mark.hash === hash ? mark.verdict : 'changed';
}

// null : oublie la validation.
export function setMark(marks: Marks, target: string, hash: string, verdict: 'ok' | 'ko' | null): Marks {
  const { [target]: _, ...rest } = marks;
  return verdict ? { ...rest, [target]: { hash, verdict } } : rest;
}

// La vérification de conception de la note : la cible 'design' porte le chemin de la note (pas une empreinte :
// la page ne l'envoie jamais, targetHash ne la connaît pas).
export function designChecked(marks: Marks, notePath: string): boolean {
  return Object.hasOwn(marks, 'design') && marks.design.hash === notePath;
}

// La dernière vérification de conception de cette note, pour l'empreinte de sa conception d'aujourd'hui (design) : 'clean',
// elle n'a rien trouvé et la conception est celle d'où elle est partie ; 'edited', elle n'a rien trouvé, la conception a
// changé depuis ; null : jamais vérifiée, une autre note (designChecked), ou la dernière vérification a trouvé quelque chose.
export function designState(marks: Marks, notePath: string, design: string): VibeNoteCheck | null {
  return !designChecked(marks, notePath) || !Object.hasOwn(marks, 'verified') ? null : marks.verified.hash === design ? 'clean' : 'edited';
}

// Valider la note ne lance plus de vérification : 'mark' pour tout clic, créateur compris (plus jamais 'check' ; Vérifier
// est un geste à part, l'action design-check). marks et notePath ne servent plus : la signature reste celle de l'appelant.
export function noteClick(_marks: Marks, _notePath: string, _verdict: 'ok' | 'ko' | null, _flow: VibeFlow): 'mark' {
  return 'mark';
}

// La fin de la course design-check : finie, la note est vérifiée ('design') ; sans question, la cible 'verified' porte
// l'empreinte de la conception d'où la vérification est partie (clicked : retenue par l'appelant à son départ, quel que
// soit le geste qui l'a lancée ; null, pas retenue : une empreinte vide, la note sera dite changée depuis) ; avec une
// question, 'verified' est retirée. Elle ne valide jamais la note (la marque 'note' ne bouge pas). Échouée ou arrêtée : rien.
export function designEnd(
  marks: Marks,
  end: { path: string; state: 'done' | 'failed' | 'stopped'; questions: number; clicked: string | null },
): Marks {
  if (end.state !== 'done') return marks;
  const checked = setMark(marks, 'design', end.path, 'ok');
  return setMark(checked, 'verified', end.clicked ?? '', end.questions ? null : 'ok');
}

// La note validée puis changée : son ✓ suit la conception d'aujourd'hui si le changement n'y ajoute que des textes
// « Accepter » choisis par l'utilisateur (onlyAccepted de accepted) ; sinon marks tel quel.
export function keepNote(marks: Marks, { validated, design, accepted }: { validated: string | null; design: string; accepted: string[] }): Marks {
  const hash = blobSha(design);
  const mark = Object.hasOwn(marks, 'note') ? marks.note : undefined;
  return mark?.verdict === 'ok' && mark.hash !== hash && validated !== null && onlyAccepted(validated, design, accepted)
    ? setMark(marks, 'note', hash, 'ok')
    : marks;
}

// Le retrait à la main de la validation d'une étape, retenu dans les marques (la cible 'withdrawn:<étape>') pour
// l'empreinte du contenu de l'étape à ce moment ; hash null : le retrait oublié. Les autres marques : inchangées.
export function withdraw(marks: Marks, step: CheckedStep, hash: string | null): Marks {
  return setMark(marks, `withdrawn:${step}`, hash ?? '', hash === null ? null : 'ok');
}

// L'empreinte du contenu dont la validation de l'étape a été retirée à la main ; null : aucun retrait retenu.
export function withdrawn(marks: Marks, step: CheckedStep): string | null {
  const target = `withdrawn:${step}`;
  return Object.hasOwn(marks, target) ? marks[target].hash : null;
}

// L'empreinte du contenu d'une cible dans le relevé : la note (sa conception, noteDesign), « rien à écrire » de l'étape
// Invariants (créateur : le texte de la note), une case du plan à l'écran (ecran.md), une case du § A.3 à cocher à la
// main (le commit de tête de la branche), un commit (« commit:<hash> » : son hash) ; null si la cible n'y est pas
// (« file: » et « step: » compris, retirés ; 'forme', 'invariants' et 'modules' : markStep, step-checks ; un « case: » :
// toujours null, ses empreintes sont celles de caseHashes).
export function targetHash(view: VibeView, target: string): string | null {
  const { note } = view;
  if (target.startsWith('commit:')) return view.commits.find((c) => `commit:${c.hash}` === target)?.hash ?? null;
  const a3 = /^a3:(\d+)$/.exec(target);
  if (a3) return view.flow === 'create' && view.checklist[Number(a3[1])]?.manual ? view.commits.at(-1)?.hash ?? null : null;
  if (target === 'nothing' && view.flow !== 'create') return null;
  if (target === 'note' || target === 'nothing') return note && blobSha(target === 'note' ? noteDesign(note.text) : note.text);
  if (target.startsWith('case:')) return null;
  const check = /^check:(\d+)$/.exec(target);
  const plan = check && Number(check[1]) < (view.screen?.length ?? 0) ? view.outputs['ecran.md'] : undefined;
  return plan ? blobSha(plan.text) : null;
}

// Créateur : la Forme et les invariants faits de view reçoivent leur validation d'étape, by: 'system', pour leur contenu
// d'aujourd'hui (validateStep de step-checks, dans l'ordre : after suit) ; la note jamais (l'utilisateur seul la valide,
// Vibe en cours ou pas) ; et chaque cas des invariants son ✓ (setCaseMark,
// les mêmes cible et empreintes qu'un clic : caseTarget, caseHashes ; aucun test : « Rien à écrire » son ✓, pour le texte
// de la note) ; un ✓ ou ✗ déjà donné pour ce bloc et ce code commun (ou ce texte) reste (un fichier sans hashes : aucun
// cas) ; une étape refusée (l'étape d'avant pas cochée) ne reçoit rien, ni celle dont le contenu d'aujourd'hui est celui
// d'un retrait à la main (withdrawn ; le contenu changé depuis : validée de nouveau). blobs : les empreintes du disque
// (les fichiers retenus par la Forme et les invariants).
export function vibeMarks(marks: Marks, view: VibeView, blobs: FileBlobs[] = []): Marks {
  if (view.flow !== 'create' || !view.note) return marks;
  const done = new Set(view.steps.filter((s) => s.status === 'done').map((s) => s.id));
  const cases = done.has('invariants') ? view.invariants.flatMap((f) => caseKeys(f.cases).map((k) => caseTarget(f.path, k))) : [];
  const nothing = blobSha(view.note.text);
  const withNothing = done.has('invariants') && !view.invariants.length && markState(marks, 'nothing', nothing) !== 'ok' && markState(marks, 'nothing', nothing) !== 'ko'
    ? setMark(marks, 'nothing', nothing, 'ok')
    : marks;
  const withCases = cases.reduce((m, target) => {
    const hashes = caseHashes(view.invariants, target);
    const state = hashes && caseMarkState(m, target, hashes);
    return !hashes || state === 'ok' || state === 'ko' ? m : setCaseMark(m, target, hashes, 'ok');
  }, withNothing);
  // Les contenus ne dépendent que des cas et de « rien à écrire » (withCases) : les marques d'étape que le reste ajoute n'y changent rien.
  const contents = stepContents(view, withCases, blobs);
  return (['forme', 'invariants'] as const).filter((step) => done.has(step)).reduce((m, step) => {
    const hash = contents[step]?.hash;
    // Déjà cochée pour ce contenu (et l'étape d'avant) : rien à écrire, ni marque neuve ni relevé du disque du contrôleur.
    // Le retrait à la main pour ce contenu : pas de validation du système (les étapes qui suivent : validateStep refuse).
    if (!hash || withdrawn(m, step) === hash || markState(m, step, hash) === 'ko' || stepChecks(m, contents)[step].state === 'ok') return m;
    const next = validateStep(m, contents, step, 'ok');
    return next ? { ...next, [step]: { ...next[step], by: 'system' } } : m;
  }, withCases);
}

export function addComment(drafts: Drafts, pr: number, target: string, text: string): Drafts {
  const list = drafts[pr] ?? [];
  return { ...drafts, [pr]: [...list, { id: Math.max(0, ...list.map((c) => c.id)) + 1, target, text }] };
}

export function removeComment(drafts: Drafts, pr: number, id: number): Drafts {
  return { ...drafts, [pr]: (drafts[pr] ?? []).filter((c) => c.id !== id) };
}

// Le texte d'une remarque, changé sur place (même id, même cible).
export function editComment(drafts: Drafts, pr: number, id: number, text: string): Drafts {
  return { ...drafts, [pr]: (drafts[pr] ?? []).map((c) => (c.id === id ? { ...c, text } : c)) };
}

// La remarque `id` est-elle au brouillon de la PR `pr` ? (draft.edit, draft.remove : une inconnue est refusée.)
export function hasComment(drafts: Drafts, pr: number, id: number): boolean {
  return (drafts[pr] ?? []).some((c) => c.id === id);
}

// Les squelettes de la Forme (note 0.15.0-ecran-statuts) : à la fin d'une course forme réussie, la marque 'skel:<chemin>'
// retient l'empreinte de chaque fichier de module tel que la Forme l'a laissé (disk de blobs). before : les empreintes au
// départ de la course (null : inconnu, l'appli relancée entre-temps) ; un fichier déjà généré au départ (son empreinte
// d'alors n'était plus celle de son squelette) garde sa marque : une retouche de la Forme ne le rend pas « à générer ».
// Sans before, seul un fichier sans marque en reçoit une. Un fichier absent du disque : rien. Rend marks tel quel sans changement.
export function skeletonMarks(marks: Marks, paths: string[], blobs: FileBlobs[], before: Map<string, string | null> | null): Marks {
  const disk = new Map(blobs.map((b) => [b.path, b.disk]));
  let next = marks;
  for (const p of paths) {
    const now = disk.get(p);
    const old = marks[`skel:${p}`]?.hash;
    if (!now || now === old) continue;
    const generated = old !== undefined && (before ? (before.get(p) ?? null) !== null && before.get(p) !== old : true);
    if (generated) continue;
    next = { ...next, [`skel:${p}`]: { hash: now, verdict: 'ok' } };
  }
  return next;
}
