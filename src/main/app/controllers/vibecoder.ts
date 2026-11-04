/** vibecoder — l'écran VibeCoder de l'agent affiché, que son fil montre sa session en cours
 *  ou une ancienne (l'historique de la Conversation ne ferme pas l'écran) : le relevé et
 *  tout ce que l'écran demande suivent l'agent affiché, et ce qu'il lui envoie va
 *  toujours à sa session en cours (sendToAgent : agent.sessionId), jamais à l'ancienne
 *  lue. Son relevé (le dépôt par
 *  git en lecture, la note, les tests de la branche, les sorties des skills,
 *  les validations → le parcours, core/vibecoder, un seul pour les deux rôles) part au panneau (`conv:vibe`)
 *  à chaque conversation envoyée (refreshConversation), toutes les 4 s tant
 *  que le panneau est visible, aussitôt après une action, une validation, un
 *  réglage — au plus un par seconde ; null, une fois, quand l'agent affiché
 *  n'est plus en VibeCoder ; chaque relevé passe les demandes de l'orchestrateur
 *  (runRequests de controllers/runs). Le mode Vibe en cours (vibeOn de
 *  controllers/runs) part au parcours ; pendant Vibe, chaque relevé donne
 *  leur ✓ aux étapes faites (vibeMarks), qu'elles gardent après (F-102) ;
 *  l'action vibe partie le lance (vibeStart). Et ce que l'écran demande : une action (celle d'une
 *  étape court à part, ownRun → startRun de controllers/runs, sous sa propre
 *  entrée du runtime, si aucune course en cours ne la retient ; une action sans
 *  étape est un message à l'agent affiché, comme s'il était tapé, par
 *  sendToAgent : refusé s'il travaille, I-25 ; ou, pour les actions de
 *  DIRECT_ACTIONS (commit, publish, load-pr, base, pr-here, pr-worktree,
 *  remove-worktree, stash, unload-pr, switch-branch, new-here, new-worktree, pull, rebase, push,
 *  fetch, request-review, assign-pr, unassign-pr, copy-artifact, add-artifact, rename-artifact, new-artifact-file,
 *  new-artifact-folder, trash-artifacts, move-artifacts, copy-artifacts, duplicate-artifacts), au clic de « direct » : leurs
 *  commandes, lancées par l'appli, F-114 ; copy-artifact : des artefacts du
 *  dernier relevé (args.artifacts), copiés par controllers/artifacts, I-39 ; les six autres actions sur
 *  les artefacts (args.artifacts, args.folder, args.name, args.names, rien d'autre lu ; rename-artifact : un seul
 *  id) vont à controllers/artifact-ops, qui revérifie tout ; add-artifact : refusé ici, seul un dépôt sur le
 *  panneau le fait (dropOnArtifacts(paths, folder), les chemins lus du File par le pont ; le dossier : un id
 *  du relevé) : mêmes « en cours » et dernier résultat ; conv:vibeRun ne porte jamais de chemin, I-37, et le
 *  nom tapé y passe, sans canal de plus), une course (vibeRunOp : l'arrêter, la garder ou l'annuler, répondre
 *  à sa demande d'autorisation), un réglage (dont arrêter l'agent, comme Interrompre de son
 *  menu ; arrêter Vibe, la bannière : vibeStop de controllers/runs ;
 *  l'onglet Actions ouvert ou fermé : ses courses vues, runsTab de controllers/runs ;
 *  la vue des Modules, IDE ou liste : `modulesView`, 'ide' ou 'list' seulement, rangée
 *  dans les réglages, rendue au relevé : vibeModulesView ; la langue de l'écran est écrite par la page des réglages, plus ici),
 *  une validation (dont ✓ Rien à écrire, Créer : pour le texte de la note), le brouillon de revue, ouvrir un fichier ou un commit
 *  du relevé (dans l'éditeur, à une ligne ; la page d'un commit dans le
 *  navigateur, d'après l'origine GitHub du dépôt, I-32).
 *  Ne lit que la note et les tests que git donne dans le dossier de l'agent
 *  (safePath), et les sorties de cet agent sous leurs noms connus (isOutputName),
 *  dont toutes ses lectures d'invariants (invariants/<blob>.md : celle d'un
 *  test modifié depuis reste montrée, périmée, core/vibecoder) : une page
 *  désigne un fichier par son id dans le dernier relevé (lastView), jamais par
 *  un chemin (I-37). Le texte d'un test d'invariants à la base : par git seul (show au
 *  commit où la branche, ou la PR, part de repo.base : forkPoint, un par relevé ;
 *  null : absent là, pas de base ; au-delà de 200 Ko, core/vibecoder). Les fichiers d'un module
 *  touché : ceux que la branche change (core/vibecoder, d'après repo.changed),
 *  pas leur texte (controllers/module-code lit le fichier ouvert). Les
 *  artefacts du projet de l'agent (le dossier de son projet, controllers/artifacts ;
 *  leurs dossiers, même vides : VibeView.artifactDirs ;
 *  VibeView.artifactsDir le donne à la page pour le seul texte du `@`, aucun canal
 *  ne le reçoit en retour) : leur liste au relevé, sans leur texte ; ouverts ou copiés par leur id (a<i>)
 *  dans le dernier relevé, jamais par un chemin. Une action qui génère un module : sa course le retient
 *  (runModule → startRun). Ce qu'il écrit pour l'ouvrir (le diff d'un
 *  commit) va sous <sorties>/files/, en lecture seule. Le message d'une
 *  action : son gabarit, rempli par buildMessage (I-38 ; un argument inutile est
 *  ignoré, texte du champ compris si le gabarit n'a pas {{text}} — ignoredText —, rendu dans
 *  ignored pour l'orchestrateur, F-115), avec le préfixe des
 *  commandes vu de l'agent qui le reçoit ({{prefix}} : processes.promptPrefix) et la langue des agents
 *  ({{lang}} : agentLang, l'écran gardant vibeLang). Le modèle et l'effort d'une action : ceux de la configuration
 *  (actionPicks, jamais Fable, I-36), ceux qu'une page ou une demande en dit sont écartés (rendus dans ignored) ; le
 *  `who` des actions suit ce choix (whoOf). Les pièces du champ de l'action (args.pieces : sélection, fichiers, images) :
 *  préparées par prepareMessage (controllers/conversation) sur le texte du message et les seules clés connues, les images à part,
 *  si le gabarit lit {{text}} ou {{answers}} (sinon rendues dans ignored, rien préparé) ; un refus : l'erreur, rien
 *  n'est envoyé (I-2, élargi). git en lecture seule
 *  (technicals/git, I-39), sauf les actions directes (technicals/direct, la recette) ; gh aussi, sans agent (technicals/github, derrière
 *  le préfixe de l'agent : processes.agentPrefix) : Créer, la PR de la
 *  branche ; l'état de la PR suivie (60 s en cache, demandés en
 *  fond : le relevé ne les attend pas ; ↻ les redemande) et les PR ouvertes du
 *  dépôt, les miennes, à relire, toutes (setVibe({ prs })). Les sorties suivent la
 *  branche (followBranch), dans les deux rôles.
 *  Le rôle (créateur 'create', relecteur 'review' : VibeView.flow) ne se choisit pas : chaque relevé
 *  le recalcule (core/vibecoder vibeRole) d'après la PR du dossier (la PR suivie si le dossier est
 *  sur sa tête ou son robot, sinon la PR ouverte de la branche), ses personnes et mon identifiant (gh,
 *  en fond, 60 s en cache ; tant qu'ils manquent, le rôle rangé reste) et le range (vibe.flow) quand il
 *  change ; un `flow` envoyé par une page est ignoré (setVibe). Devenu relecteur sur la PR de la
 *  branche : sa fiche pr-<n>.json écrite et vibe.pr = n, rien de chargé. Relecteur : la copie de
 *  travail est comparée à origin/<base de la fiche pr-<n>.json> (note
 *  0.12.0-creer-relire-meme-dossier : la PR se charge dans ce dossier) ; une action `create` est
 *  refusée (startAction, d'après le dernier relevé, jamais la page), même demandée par
 *  l'orchestrateur. S'assigner la PR, Me retirer de la PR (assign-pr, unassign-pr : directes
 *  seulement, au clic) : la PR du dernier relevé, mon identifiant lu par gh, jamais un argument.
 *  La PR suivie (vibe.pr, load-pr réussi) et sa fiche : les deux rôles (la
 *  vue des branches). Au relevé, pour le parcours : le dossier
 *  (checkout : sa branche, ses modifications), les branches locales et l'état
 *  distant (git.branches, git.sync sur la base sans « origin/ » ; aucun fetch au
 *  relevé : seulement Actualiser, au clic), l'agent enfant d'un worktree
 *  (child), la recette de sa famille (controllers/recipe), la branche d'une
 *  nouvelle demande retenue (request). Chaque choix de lieu est une action
 *  directe, au clic seulement, jamais au relevé ni à la suite d'une autre :
 *  avant tout git switch (pr-here, unload-pr, switch-branch, new-here, base), git status relu,
 *  une ligne ou pas de réponse → refusé ; un changement de branche réussi oublie
 *  les derniers Rebase et Pousser ; switch-branch : une branche du relevé ;
 *  pull : git pull --ff-only --autostash ; rebase : origin/<base> rapatriée, ou
 *  une branche du relevé (onto) ; push : --force-with-lease ; pr-here : la tête de pr-<n>.json
 *  rapatriée puis git switch ; pr-worktree : la tête rapatriée, la recette
 *  (VIBECODER_BRANCH pr-<n>, VIBECODER_BASE la tête, départ origin/<tête>),
 *  puis le robot (controllers/worktrees prWorktreeReady : la question de
 *  confiance toujours, I-41) ; stash : git stash push -u, puis git status
 *  relu (propre : ok ; sinon l'échec), rien d'autre ne suit ; unload-pr : la
 *  base du dépôt, puis la PR plus suivie. Retirer le worktree
 *  (remove-worktree, directe seulement, jamais par l'agent) :
 *  controllers/worktrees ; celui d'une PR retiré, sa branche pr-<n> supprimée
 *  au dossier du parent (technicals/direct). Nouvelle demande (new-request, ou
 *  Rédiger la note sur la base en créateur) : la demande retenue en mémoire ; au
 *  relevé, <sorties>/new-request.json (la branche nommée par l'agent) supprimé
 *  et, avec une demande retenue, sa branche retenue avec elle (rien de créé au
 *  relevé). new-here, new-worktree (aussi Créer une branche) : le nom saisi
 *  (args.branch, pas une branche locale), sinon celui de la demande ; le départ
 *  args.start (une branche du relevé), sinon origin/<base> ; new-here : git switch
 *  -c <branche> <départ> ; new-worktree : le worktree, l'enfant (la question de
 *  confiance), affiché ; avec une demande retenue seulement, la note à rédiger (new-here) puis, au premier relevé hors de la base du dossier ou de
 *  l'enfant, Rédiger la note avec la demande.
 *  git manquant, dossier sans dépôt,
 *  fichier illisible : rien ne bloque le fil ni l'agent (I-29). L'onglet
 *  Processus (les commandes du projet, au relevé ; vibeProcess) :
 *  controllers/processes. Depuis les sources (app/dev) : ce qui a été
 *  reconstruit, au relevé (dev : devState) ; Recharger l'interface (reloadUi,
 *  pages seules reconstruites, pas pendant une dictée : reloadPages) ;
 *  Redémarrer (restartApp, principal reconstruit ; la question d'abord si un
 *  agent travaille).
 *  Ne connaît pas : la page (seulement ses canaux), la fenêtre.
 *  Utilisé par : app/ipc (dropOnArtifacts), app/menus, controllers/conversation,
 *  controllers/runs, controllers/agents et controllers/module-code
 *  (lastView), controllers/artifacts et controllers/artifact-ops (lastView). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dialog, shell } from 'electron';
import type { SendResult, VibeAction, VibeArgs, VibeLang, VibeRunOp, VibeView } from 'shared/bridge';
import { EFFORTS, MODELS, MODES, type AgentConfig } from 'core/agents';
import { actionPicks, agentLang, agentList, agentVibe, vibeLang, vibeModulesView, type Config } from 'core/config';
import { agentParent } from 'core/family';
import { githubPage } from 'core/repo';
import {
  addComment, artifactOf, blobSha, buildMessage, vibeMarks, DIRECT_ACTIONS, DIRECT_ONLY, draftText, editComment, findNote, headField, ignoredText, isInvariantTest, isOutputName, isTest, itemCommit, itemPath,
  blockedBy, BRANCH_CHANGES, ELSEWHERE, json, newRequestCard, noteKey, onBase, ownRun, prNumber, removeComment, runModule, runViews, safePath, setMark, skillModel, targetHash, vibeRole, vibeView, whoOf, type ActionDef, type MessageError,
} from 'core/vibecoder';
import { findEditor } from 'technicals/editor';
import { directRunner, prCardText, VERDICTS, type DirectResult } from 'technicals/direct';
import { gitReader, gitRun, okRef } from 'technicals/git';
import { ghRun, githubReader } from 'technicals/github';
import { which } from 'technicals/paths';
import { devState, reloadPages, restartApp } from 'app/dev';
import { loadConfig, saveConfig, saveVibeStore, updateAgent, vibeActions, vibeOutDir, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { conversationShown, openConversation } from 'app/windows';
import { interruptAgent, isBusy, sendToAgent, setAgentSetting, viewAgent } from './agents';
import { agentPrefix, processAction, processView, promptPrefix, readFile, readTimed } from './processes';
import { addArtifacts, artifactFile, copyArtifact, listArtifacts, projectArtifactsDir } from './artifacts';
import { copyArtifacts, duplicateArtifacts, moveArtifacts, newArtifact, renameArtifact, trashArtifacts } from './artifact-ops';
import { prepareMessage } from './conversation';
import { createWorktree } from './recipe';
import { lockingRuns, runOp, viewLocks, runPending, runRequests, runsOf, runsTab, skillMd, startRun, vibeOn, vibeStart, vibeStop } from './runs';
import { openChild, prWorktreeReady, removeWorktreeChild, showWorktree, syncWorktrees, wantWorktree, worktreeParent, worktreeState } from './worktrees';

const VIBE_MS = 4000;          // le relevé régulier, panneau visible
const THROTTLE_MS = 1000;      // au plus un relevé par seconde
const TARGET_MAX = 300;        // une remarque du brouillon de revue : sa cible…
const REMARK_MAX = 5000;       // … et son texte
const GH_MS = 60_000;          // une réponse de gh vaut 60 s

const ERRORS: Record<VibeLang, Record<MessageError | 'agent' | 'action' | 'args' | 'noGit' | 'notRepo' | 'worktree', string>> = {
  fr: {
    agent: 'Aucun agent en VibeCoder dans le panneau.',
    action: 'Action inconnue ou indisponible.',
    args: 'Action refusée : arguments mal formés.',
    text: 'Dictez ou écrivez d\'abord dans le champ (20 000 caractères au plus).',
    module: 'Aucun module à générer : la Forme n\'en a plus, ou ce module n\'existe pas.',
    commit: 'Ce commit n\'est pas dans la branche.',
    pr: 'Indiquez une PR (son numéro).',
    answers: 'Aucune réponse à envoyer (50 réponses de 2 000 caractères au plus).',
    verdict: 'Choisissez : approuver, commenter ou demander des changements.',
    draft: 'Le brouillon de revue est vide.',
    files: 'Aucun test d\'invariant à lire (ou ce test n\'est plus dans la branche).',
    note: 'Pas encore de note pour cette branche.',
    repo: 'Pas de dépôt git dans ce dossier.',
    worktree: 'Un worktree reste sur sa branche : ni changer de branche, ni charger une autre PR.',
    variable: 'Action mal écrite (variable inconnue), ou valeur refusée (caractère de contrôle) : voir le dossier de VibeCoder.',
    check: 'Cette vérification n\'est pas dans la dernière liste (checks.json).',
    noGit: 'git est introuvable : le parcours ne peut pas être lu. La conversation reste utilisable.',
    notRepo: 'Ce dossier n\'est pas un dépôt git : le parcours ne peut pas être lu. La conversation reste utilisable.',
  },
  en: {
    agent: 'No agent in VibeCoder in the panel.',
    action: 'Unknown or unavailable action.',
    args: 'Action refused: malformed arguments.',
    text: 'Dictate or type in the field first (20,000 characters at most).',
    module: 'No module to generate: the Shape has none left, or this module does not exist.',
    commit: 'This commit is not on the branch.',
    pr: 'Give a PR (its number).',
    answers: 'No answer to send (at most 50 answers of 2,000 characters).',
    verdict: 'Choose: approve, comment or request changes.',
    draft: 'The review draft is empty.',
    files: 'No invariant test to read (or this test is no longer on the branch).',
    note: 'No note for this branch yet.',
    repo: 'No git repository in this folder.',
    worktree: 'A worktree stays on its branch: no branch switch, no other PR loaded.',
    variable: 'Badly written action (unknown variable), or refused value (control character): see the VibeCoder folder.',
    check: 'This check is not in the last list (checks.json).',
    noGit: 'git not found: the journey cannot be read. The conversation still works.',
    notRepo: 'This folder is not a git repository: the journey cannot be read. The conversation still works.',
  },
};

const last = new Map<string, VibeView>();  // le dernier relevé envoyé, par agent : ce que la page désigne
const turnNote = new Map<string, { text: string; busy: boolean }>();  // la note au début du tour (surlignage)
const ghCache = new Map<string, { at: number; value: unknown; pending: boolean }>();  // par question à gh
type GitState = { branches: string[] | null; sync: { behind: number | null; baseAhead: number | null } | null };
const gitCache = new Map<string, { key: string; at: number; value: GitState | null; pending: boolean }>();  // par agent : branches et sync
const directs = new Map<string, Record<string, NonNullable<VibeAction['direct']>>>();  // par agent : ses actions directes (F-114)
const prsFound = new Map<string, { mine: unknown[]; review: unknown[]; all: unknown[] } | false>();   // les PR ouvertes, par agent (la dernière réponse de gh ; false : en échec)
const requests = new Map<string, { text: string; branch?: string }>();  // new-request : la demande partie, par agent (en mémoire), puis sa branche
const firstNotes = new Map<string, string>();   // … puis par agent qui la prend (lui, ou l'enfant né d'elle) : sa note à rédiger, à son premier relevé
let shown: string | null = null;           // l'agent dont le panneau a le relevé (null : aucun, ou null envoyé)
let lastAt = 0;
let running: Promise<void> | null = null;   // le relevé en cours
let again = false;
let againNow = false;
let trailing: ReturnType<typeof setTimeout> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

// Le dernier relevé envoyé au panneau pour cet agent : ce que la page désigne par ses ids.
export const lastView = (agentId: string): VibeView | null => last.get(agentId) ?? null;

// gh : la dernière réponse à cette question (null : pas encore, ou échec) ;
// plus vieille que 60 s, ou jamais posée : redemandée en fond, et un relevé
// de plus si la réponse change. Le relevé n'attend jamais gh (I-29).
function fromGh<T>(key: string, ask: () => Promise<T | null>): T | null {
  const hit = ghCache.get(key);
  if (!hit || (!hit.pending && Date.now() - hit.at > GH_MS)) {
    if (ghCache.size > 200) ghCache.clear();
    const entry = { at: Date.now(), value: hit?.value ?? null, pending: true };
    ghCache.set(key, entry);
    ask().then((value) => {
      const changed = JSON.stringify(value) !== JSON.stringify(entry.value);
      Object.assign(entry, { value, pending: false, at: Date.now() });
      if (changed) refreshVibe({ now: true });
    });
  }
  return (hit?.value ?? null) as T | null;
}

// Les branches locales et l'état distant (git en lecture) : la dernière réponse pour ce HEAD et cette base ;
// HEAD ou la base changés (ou sa clé effacée : une action directe finie), plus vieille que 60 s, ou ↻ : redemandée en fond,
// et un relevé de plus si elle change. Le relevé ne les attend jamais (sous Windows, chaque git compte).
function fromGit(agentId: string, key: string, ask: () => Promise<GitState>): GitState | null {
  const hit = gitCache.get(agentId);
  if (!hit || (!hit.pending && (hit.key !== key || Date.now() - hit.at > GH_MS))) {
    const entry = { key, at: Date.now(), value: hit?.value ?? null, pending: true };
    gitCache.set(agentId, entry);
    ask().then((value) => {
      const changed = JSON.stringify(value) !== JSON.stringify(entry.value);
      Object.assign(entry, { value, pending: false, at: Date.now() });
      if (changed) refreshVibe({ now: true });
    });
  }
  return hit?.value ?? null;
}

// Relecteur (le rôle de ce relevé) : une demande de l'orchestrateur pour une action create
// (<sorties>/actions/<id>.start) est effacée sans avis — rien n'est envoyé à Claude Code.
function dropCreateRequests(agentId: string, defs: { id: string; flow: string }[]) {
  for (const d of defs) if (d.flow === 'create') fs.rmSync(path.join(vibeOutDir(agentId), 'actions', `${d.id}.start`), { force: true });
}

// Relève l'agent affiché en VibeCoder et envoie son parcours au panneau ;
// sinon null, une fois. Un relevé à la fois, au plus un par seconde (sauf
// `now`, ou un autre agent) : le suivant attend ; un appel pendant un relevé
// se résout à sa fin (panelReady attend ainsi le premier). `fresh` (↻) : les
// réponses de gh sont redemandées.
export async function refreshVibe({ now = false, fresh = false }: { now?: boolean; fresh?: boolean } = {}) {
  if (fresh) for (const entry of [...ghCache.values(), ...gitCache.values()]) entry.at = 0;
  syncWorktrees(); // Relire dans un worktree : le robot temporaire arrive ou part (F-110)
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  const panel = state.panel && !state.panel.isDestroyed() ? state.panel : null;
  if (!agent || !panel) {
    if (timer) { clearInterval(timer); timer = null; }
    if (shown !== null) panel?.webContents.send('conv:vibe', null);
    shown = null;
    return;
  }
  // Toutes les 4 s, seulement panneau visible.
  timer ??= setInterval(() => { if (conversationShown()) refreshVibe(); }, VIBE_MS);
  // Panneau caché : aucun relevé ; il reprend à sa réapparition.
  // (sauf le premier relevé d'un agent qu'on vient d'afficher : le panneau peut ne pas être encore montré)
  if (!now && !conversationShown() && agent.id === shown) return;
  if (running) { again = true; againNow ||= now; return running; }
  const wait = now || agent.id !== shown ? 0 : lastAt + THROTTLE_MS - Date.now();
  if (wait > 0) { trailing ??= setTimeout(() => { trailing = null; refreshVibe(); }, wait); return; }
  shown = agent.id;
  lastAt = Date.now();
  running = (async () => {
    try {
      const view = await survey(agent, cfg);
      // Pendant le relevé, l'agent a pu changer de vue, ou le panneau d'agent.
      if (state.panel && !state.panel.isDestroyed() && viewAgent()?.id === agent.id) {
        last.set(agent.id, view);
        state.panel.webContents.send('conv:vibe', view);
        if (view.flow === 'review') dropCreateRequests(agent.id, vibeActions(view.lang));
        runRequests(agent, view);   // les demandes de l'orchestrateur, d'après ce relevé
        firstNote(agent, view, cfg);
      }
    } catch (err) {
      console.error(`VibeCoder : relevé impossible (${err instanceof Error ? err.message : err})`);
    }
  })();
  await running;
  running = null;
  if (again) { const n = againNow; again = againNow = false; refreshVibe({ now: n }); }
}

/* ---- Le relevé ------------------------------------------------------------ */

// Un fichier du dossier de l'agent, s'il y reste (`..` et liens résolus).
function onDisk(dir: string, rel: string) {
  const file = safePath(dir, rel, fs.realpathSync.native);
  return (file && readFile(file)) ?? null;
}

// Les sorties des skills : chaque nom connu présent dans le dossier de sorties.
function readOutputs(out: string) {
  let names: string[] = [];
  try { names = fs.readdirSync(out); } catch { /* pas encore de sortie */ }
  return Object.fromEntries(names.filter(isOutputName).flatMap((name) => {
    const file = readTimed(path.join(out, name));
    return file ? [[name, file]] : [];
  }));
}

// Les skills du projet et de l'utilisateur : les dossiers de .claude/skills/ qui ont un SKILL.md.
function skillNames(dir: string) {
  const names = [path.join(dir, '.claude', 'skills'), path.join(os.homedir(), '.claude', 'skills')].flatMap((d) => {
    try { return fs.readdirSync(d).filter((name) => fs.existsSync(path.join(d, name, 'SKILL.md'))); }
    catch { return []; }
  });
  return [...new Set(names)].sort();
}

// Un nom de branche qu'un message peut porter, et git recevoir (okRef : [A-Za-z0-9._/-], ni « - » en tête, ni « .. »).
const branchName = (v: unknown) => (typeof v === 'string' && okRef(v) ? v : null);

// Les sorties que les skills écrivent pour une branche, dans les deux rôles (pas les lectures
// invariants/, nommées par l'empreinte du test, ni celles de la PR, par numéro).
const BRANCH_OUTPUTS = ['questions.md', 'align.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'ponytail-applied.json', 'pr.json', 'ci.md', 'ecran.md'];

// Les sorties suivent la branche : la dernière vue est dans
// <out>/.branche ; quand elle passe de P à N, celles de la racine vont dans
// branches/<P>/ (remplacé) — sauf si P est la base : une feature lancée depuis
// la base (Rédiger la note) crée sa branche et garde ce que ses
// skills ont écrit — puis celles de branches/<N>/, s'il existe, reviennent à
// la racine. Une erreur n'empêche pas le relevé (I-29).
export function followBranch(out: string, branch: string, base: string) {
  const slug = (b: string) => path.join(out, 'branches', b.replace(/[^A-Za-z0-9._-]+/g, '-'));
  try {
    const mark = path.join(out, '.branche');
    const prev = fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8') : null;
    if (prev === branch) return;
    fs.writeFileSync(mark, branch);   // d'abord : un déplacement interrompu n'est pas refait par-dessus
    if (prev && prev !== base && !base.endsWith(`/${prev}`)) {
      const keep = slug(prev);
      fs.rmSync(keep, { recursive: true, force: true });
      fs.mkdirSync(keep, { recursive: true });
      for (const name of BRANCH_OUTPUTS) {
        if (fs.existsSync(path.join(out, name))) fs.renameSync(path.join(out, name), path.join(keep, name));
      }
    }
    const saved = slug(branch);
    if (!fs.existsSync(saved)) return;
    for (const name of BRANCH_OUTPUTS) {
      if (fs.existsSync(path.join(saved, name))) fs.renameSync(path.join(saved, name), path.join(out, name));
    }
    fs.rmSync(saved, { recursive: true, force: true });
  } catch { /* le relevé part quand même */ }
}

// Le dossier lui-même : sa branche, s'il a des modifications ; null si git ne répond pas.
async function checkoutOf(dir: string) {
  const run = gitRun(dir);
  const [branch, status] = await Promise.all([run(['rev-parse', '--abbrev-ref', 'HEAD']), run(['status', '--porcelain'])]);
  return branch === null || status === null ? null : { branch: branch.trim(), dirty: !!status.trim() };
}

// new-request.json au relevé : supprimé (une fois) ; avec une demande retenue, sa branche retenue avec elle
// (request au relevé, qui attend son choix : new-here, new-worktree ; rien de créé ici).
function takeRequest(agent: AgentConfig, text: string) {
  fs.rmSync(path.join(vibeOutDir(agent.id), 'new-request.json'), { force: true });
  const asked = requests.get(agent.id);
  const card = newRequestCard(text);
  if (asked && card) asked.branch = card.branch;
}

// Le premier relevé de l'agent qui prend une nouvelle demande (lui, ou l'enfant né d'elle) : Rédiger la note avec elle (retentée au relevé suivant si refusée, sauf invalide).
// Un relevé encore sur la base (parti avant le git switch) attend le suivant : sur la base, note serait une nouvelle demande.
function firstNote(agent: AgentConfig, view: VibeView, cfg: Config) {
  const text = firstNotes.get(agent.id);
  const def = text === undefined ? null : vibeActions(vibeLang(cfg)).find((a) => a.id === 'note');
  if (!def || onBase(view.repo?.branch ?? null, view.repo?.base ?? null)) return;
  const sent = startAction(agent, def, { text }, view, cfg);
  if (sent.ok || sent.invalid) firstNotes.delete(agent.id);
}

async function survey(agent: AgentConfig, cfg: Config): Promise<VibeView> {
  const lang = vibeLang(cfg);
  const { flow, pr } = agentVibe(agent);
  const realpath = fs.realpathSync.native;
  const git = gitReader(gitRun(agent.dir));
  // La copie de travail, comparée à la base du dépôt : sa branche désigne la PR, donc le rôle.
  const here = await git.facts();
  const out = vibeOutDir(agent.id);
  if (here) followBranch(out, here.branch, here.base);
  const outputs = readOutputs(out);
  if (outputs['new-request.json']) takeRequest(agent, outputs['new-request.json'].text);
  const card = pr ? json(outputs[`pr-${pr}.json`]?.text) : null;
  // gh, sans agent, en fond (fromGh) : la PR de la branche (pas sur la base) ; l'état de la PR suivie ; les PR ouvertes
  // (setVibe({ prs })) ; ses personnes et mon identifiant.
  const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
  const feature = here && here.branch !== 'HEAD' && here.base !== here.branch && !here.base.endsWith(`/${here.branch}`)
    ? here.branch : null;
  const foundKey = `pr ${agent.dir} ${feature}`;
  const found = feature ? fromGh(foundKey, () => gh.prForBranch(feature)) : null;
  const state = card && pr ? fromGh(`state ${agent.dir} ${pr}`, () => gh.prState(pr)) : null;
  const worktree = worktreeState(agent, pr, !!directs.get(agent.id)?.['pr-worktree']?.running);
  // Le rôle (core/vibecoder role), recalculé à chaque relevé. Sa PR : la PR suivie si le dossier est sur sa tête (ou
  // son robot), sinon la PR ouverte de la branche. Tant que gh n'a pas répondu, le rôle rangé reste.
  const followed = !!pr && !!card && (here?.branch === card.head || !!worktree?.temp);
  const target = followed ? pr : found?.number ?? null;
  const people = target ? fromGh(`people ${agent.dir} ${target}`, () => gh.prPeople(target)) : null;
  const login = target ? fromGh(`login ${agent.dir}`, () => gh.login()) : null;
  const waiting = !followed && !!feature && !found && !!ghCache.get(foundKey)?.pending;
  const role = waiting ? flow : vibeRole({ open: (followed ? state ?? card?.state : found?.state) === 'OPEN', people, login, was: flow });
  if (role !== flow) patchVibe(agent.id, { flow: role });
  if (role !== flow && role === 'review' && !followed && found?.state === 'OPEN') {
    // Devenu relecteur sur la PR de sa branche : sa fiche écrite et suivie (rien de chargé) ; le relevé suivant la lit.
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `pr-${found.number}.json`), prCardText({ author: '', body: '', ...found }));
    patchVibe(agent.id, { pr: found.number });
    refreshVibe({ now: true });
  }
  // Relecteur : comparée à origin/<base de la fiche>.
  const base = branchName(card?.base);
  const facts = role === 'review' && followed && base && `origin/${base}` !== here?.base ? await git.facts(undefined, `origin/${base}`) : here;
  // Les branches locales et l'état distant (git en lecture, aucun fetch), en fond (fromGit) : sync prend la base sans « origin/ ».
  const syncBase = facts?.base.replace(/^origin\//, '') ?? null;
  const gitState = fromGit(agent.id, `${facts?.head ?? ''} ${syncBase ?? ''}`, async () => {
    const [branches, sync] = await Promise.all([git.branches(), syncBase !== null ? git.sync(syncBase) : null]);
    return { branches, sync };
  });
  const branches = gitState?.branches ?? null;
  const sync = facts ? gitState?.sync ?? null : null;
  const github = { pr: found, state, prs: prsFound.get(agent.id) ?? null };
  const repo = facts && { branch: (role === 'review' && followed && branchName(card?.head)) || facts.branch, base: facts.base, changed: facts.changed, dirty: facts.dirty, added: facts.added, commits: facts.commits };
  // La note du ticket : sa clé d'après la branche (ticket, sinon version), parmi
  // les .md de docs/tickets/ que change la branche (ou la PR).
  const key = repo && noteKey(repo.branch, null);
  const notePath = repo && key ? findNote(repo.changed, key, repo.branch) : null;
  const noteText = notePath ? onDisk(agent.dir, notePath) : null;
  // Les tests de la branche, et leur empreinte, qui nomme leur lecture.
  const tests = (repo?.changed ?? []).filter(isTest).flatMap((p) => {
    const text = onDisk(agent.dir, p);
    return text === null ? [] : [{ path: p, blob: blobSha(text), text }];
  });
  // Le texte d'un test d'invariants à la base (par git seul, I-37) : au commit où la branche part de repo.base (forkPoint,
  // un par relevé, comme at.base de controllers/module-code) ; null : absent là, pas de base, un variant (au-delà de 200 Ko : core/vibecoder).
  const fork = repo && tests.some((t) => isInvariantTest(t.path)) ? await git.forkPoint(repo.base) : null;
  const based = await Promise.all(tests.map(async (t) => ({ ...t, base: fork && isInvariantTest(t.path) ? await git.show(fork, t.path) : null })));
  // Toutes les lectures d'invariants : un test modifié depuis la sienne reprend la plus récente de son fichier,
  // périmée (readingOf, core/vibecoder).
  let names: string[] = [];
  try { names = fs.readdirSync(path.join(out, 'invariants')); } catch { /* pas encore de lecture */ }
  const readings = names.filter((n) => isOutputName(`invariants/${n}`)).flatMap((n) => {
    const reading = readTimed(path.join(out, 'invariants', n));
    return reading ? [{ blob: n.slice(0, -3), ...reading }] : [];
  });
  // La note au début du tour (surlignage) : retenue quand l'agent ou une course
  // qui modifie la branche (la note, ses réponses, la forme…) se met au travail
  // (pas de note : tout ce qui viendra est nouveau) ; « Vu » la remplace.
  const busy = isBusy(agent.id);
  const writing = busy || lockingRuns(agent.id).some((r) => !r.reads);
  const turn = turnNote.get(agent.id);
  if (writing && !turn?.busy) turnNote.set(agent.id, { text: noteText ?? '', busy: writing });
  else if (turn) turn.busy = writing;
  const before = turnNote.get(agent.id)?.text ?? null;
  const store = vibeStore();
  const actions = vibeActions(lang);
  const skills = Object.fromEntries(actions.map((a) => [a.id, skillMd(a.text)]));
  // Le modèle d'une action qui court, ou d'un skill en sous-contexte ; envoyé à la conversation, celui de l'agent (null).
  // Seule une action à modèle fixé se choisit (config : actionPicks) : son who suit le choix.
  const modelOf = Object.fromEntries(actions.map((a) => [a.id,
    ownRun(a) || headField(skills[a.id], 'context') === 'fork' ? skillModel(skills[a.id]) : null]));
  const who = Object.fromEntries(actions.map((a) => [a.id, whoOf(skills[a.id], lang, modelOf[a.id] ? actionPicks(cfg, a.id) : undefined)]));
  const running = lockingRuns(agent.id);
  // Le dossier : d'après facts (même copie de travail) ; sans git, relu à part.
  const checkout = facts ? { branch: facts.branch, dirty: facts.dirty.length > 0 } : await checkoutOf(agent.dir);
  // Processus : les commandes du projet, leur état, la recette de la famille (controllers/processes).
  const proc = processView(agent, cfg);
  const journey = vibeView({
    agentId: agent.id, lang, modulesView: vibeModulesView(cfg), flow: role, pr, people, login, vibe: vibeOn(agent.id),
    agent: { model: agent.model || '', effort: agent.effort || '', mode: agent.mode || 'default' },
    busy,
    running,
    runs: runViews(runsOf(agent), actions.map((a) => ({ id: a.id, label: a.label, who: who[a.id] })), runPending(agent.id)),
    repo,
    error: repo ? null : !which('git') ? ERRORS[lang].noGit : role === 'create' ? ERRORS[lang].notRepo : null,
    note: notePath && noteText !== null ? { path: notePath, text: noteText, before: before !== null && before !== noteText ? before : null } : null,
    tests: based,
    readings,
    outputs,
    marks: store.marks[agent.id] || {},
    draft: role === 'review' && pr ? store.drafts[agent.id]?.[pr] || [] : [],
    worktree,   // Dans un worktree (pr-worktree, direct) en cours
    child: !!agentParent(agent),
    recipe: proc.recipe,
    checkout,
    request: requests.get(agent.id)?.branch ?? null,
    github,
    branches,
    sync,
    actions,
    direct: directs.get(agent.id),
    who,
    model: modelOf,
    skills: skillNames(agent.dir),
    exists: (rel) => { const file = safePath(agent.dir, rel, realpath); return !!file && fs.existsSync(file); },
    now: Date.now(),
  });
  // Vibe en cours : les étapes faites reçoivent leur ✓, qu'elles gardent une fois Vibe fini (F-102).
  if (journey.vibe) {
    const marks = store.marks[agent.id] || {};
    const next = vibeMarks(marks, journey);
    if (next !== marks) { store.marks[agent.id] = next; saveVibeStore(store); }
  }
  const artifactsDir = projectArtifactsDir(agent.dir);
  const { artifacts, dirs } = listArtifacts(agent.id, artifactsDir, cfg.artifactTextMax);
  return { ...journey, ...proc, artifacts, artifactDirs: dirs, artifactsDir, dev: devState() };
}

/* ---- Ce que demande l'écran ------------------------------------------------ */

const fail = (lang: VibeLang, key: keyof typeof ERRORS.fr): SendResult => ({ ok: false, error: ERRORS[lang][key] });

// Un dépôt sur la zone du panneau : les chemins lus du File par le pont.
// Mêmes vérifications que runVibeAction (l'agent affiché, son relevé, l'action affichée), sans lire aucun
// chemin ici ; puis l'action directe add-artifact (même « en cours », même résultat), en fond (track) :
// cette fonction rend la main aussitôt. folder : l'id d'un dossier du relevé, revérifié par addArtifacts.
export function dropOnArtifacts(paths: unknown, folder?: unknown): SendResult {
  const lang = vibeLang(loadConfig());
  const agent = viewAgent();
  const view = agent && last.get(agent.id);
  if (!agent || !view) return fail(lang, 'agent');
  if (!view.actions.some((a) => a.id === 'add-artifact')) return fail(lang, 'action');
  const mine = directs.get(agent.id) ?? {};
  if (Object.values(mine).some((x) => x.running)) return fail(lang, 'action');
  directs.set(agent.id, mine);
  void track(mine, 'add-artifact', () => addArtifacts(agent, paths, folder));
  return { ok: true };
}

// Une action de l'écran (son id, dans le dernier relevé de l'agent affiché, et
// active) → son gabarit rempli de valeurs vérifiées (buildMessage : le type,
// la taille et la valeur de chaque argument), envoyé comme un message tapé.
export function runVibeAction(id: unknown, args: unknown): SendResult {
  const cfg = loadConfig();
  const lang = vibeLang(cfg);
  const agent = viewAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view) return fail(lang, 'agent');
  const shownAction = view.actions.find((a) => a.id === id);
  const def = vibeActions(lang).find((a) => a.id === id);
  if (!shownAction || !def || def.kind !== 'send') return fail(lang, 'action');
  if (!args || typeof args !== 'object' || Array.isArray(args)) return fail(lang, 'args');
  if ((args as VibeArgs).direct === true && DIRECT_ACTIONS.includes(def.id)) return runDirect(agent, def, args as VibeArgs, view, cfg);
  const sent = startAction(agent, def, args as VibeArgs, view, cfg);
  if (sent.ok && def.id === 'vibe') vibeStart(agent);   // son message parti : le mode Vibe en cours (controllers/runs)
  if (sent.ok) refreshVibe({ now: true });
  return { ok: sent.ok, error: sent.error };
}

// Une action envoyée, au clic comme à la demande de l'orchestrateur (runs : runRequests) : grisée au
// relevé pour une autre raison qu'une course, refusée (une course, startRun la revoit sur l'état vivant :
// le relevé peut avoir un temps de retard) ; son gabarit rempli (I-38) ; une action d'étape court à
// part, les autres vont à la conversation. invalid : ses arguments ne vont pas, rien à retenter ;
// ignored : les arguments donnés qui ne servent pas à l'action, ignorés (buildMessage).
export function startAction(
  agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config,
): SendResult & { invalid?: true; ignored?: (keyof VibeArgs)[] } {
  const lang = vibeLang(cfg);
  if (DIRECT_ONLY.includes(def.id)) return fail(lang, 'action');   // seulement par l'appli (runDirect), jamais via l'agent
  if (def.flow === 'create' && view.flow === 'review') return fail(lang, 'action');   // le relecteur (le dernier relevé, pas la page) n'édite, ne génère ni ne commite
  if (agentParent(agent) && BRANCH_CHANGES.includes(def.id)) return { ...fail(lang, 'worktree'), invalid: true };   // un worktree reste sur sa branche
  // Rédiger la note sur la base, en créateur : la nouvelle demande (son skill nomme la branche, que l'utilisateur valide).
  if (def.id === 'note' && view.flow === 'create' && onBase(view.repo?.branch ?? null, view.repo?.base ?? null)) {
    def = vibeActions(lang).find((a) => a.id === 'new-request') ?? def;
  }
  const shown = view.actions.find((a) => a.id === def.id);
  const held = ownRun(def) ? blockedBy(def, viewLocks(view, vibeActions(lang)), lang) : null;
  if (shown?.disabled && shown.disabled !== held) return { ok: false, error: shown.disabled };
  // Le modèle et l'effort d'une action : ceux de la configuration (jamais Fable, I-36), ce que la page ou la demande
  // en dit est écarté ; buildMessage les revoit contre l'action affichée, et ne les rend pas dans ignored (ils ne viennent pas de l'appelant).
  const { model: _model, effort: _effort, ...given } = args;
  const message = buildMessage(def, { ...given, ...actionPicks(cfg, def.id) }, {
    view, out: vibeOutDir(agent.id), lang: agentLang(cfg), prefix: promptPrefix(agent, cfg),
  });
  if ('error' in message) return { ...fail(lang, message.error), invalid: true };
  // Ignorés : ce que l'appelant a donné et que le gabarit ne lit pas ; model et effort donnés, toujours (la configuration décide).
  const notGiven = [...(message.ignored ?? []).filter((k) => k !== 'model' && k !== 'effort'),
    ...(['model', 'effort'] as const).filter((k) => args[k] !== undefined)];
  // Les pièces du champ (I-2 élargi) : la sélection et les chemins ajoutés au texte, les images à part, les bornes de
  // prepareMessage ; seulement les clés connues, et seulement si le gabarit les lit (sinon dites dans ignored). Un refus : rien ne part.
  let outgoing = { text: message.text, images: [] as { mediaType: string; data: string }[] };
  if (args.pieces !== undefined && !message.ignored?.includes('pieces')) {
    const { images, files, selection } = (args.pieces && typeof args.pieces === 'object' ? args.pieces : {}) as Partial<NonNullable<VibeArgs['pieces']>>;
    const ready = prepareMessage({ text: message.text, images, files, selection });
    if ('error' in ready) return { ok: false, error: ready.error, invalid: true };
    outgoing = ready.message;
  }
  const sent = ownRun(def) ? startRun(agent, def, outgoing, cfg, runModule(def.id, args, view.modules)) : sendToAgent(agent, outgoing, cfg);
  // Dans un worktree, par l'agent : sa fiche pr-<n>-worktree.json attendue (syncWorktrees, la question de confiance).
  if (sent.ok && def.id === 'pr-worktree' && view.pr) wantWorktree(agent.id, view.pr.number);
  // Nouvelle demande : la demande retenue ; une fiche d'avant et les derniers résultats de ses choix, oubliés.
  if (sent.ok && def.id === 'new-request') {
    fs.rmSync(path.join(vibeOutDir(agent.id), 'new-request.json'), { force: true });
    requests.set(agent.id, { text: args.text as string });
    for (const id of ['new-here', 'new-worktree']) delete directs.get(agent.id)?.[id];
  }
  const ignored = ignoredText(def, args) ? [...notGiven, 'text' as const] : notGiven.length ? notGiven : undefined;   // un texte que le gabarit ne lit pas : dit aussi (F-115)
  return ignored ? { ...sent, ignored } : sent;
}

// Les actions directes en cours de l'agent, comme des courses (elles lisent ou modifient la branche) : startRun les respecte ;
// pas un nouveau worktree (ELSEWHERE), qui travaille dans un autre dossier.
export const directLocks = (agentId: string, defs: ActionDef[]) => Object.entries(directs.get(agentId) ?? {})
  .filter(([id, x]) => x.running && !ELSEWHERE.includes(id)).map(([id]) => ({ id, reads: !!defs.find((d) => d.id === id)?.reads }));

const RUN_OPS: VibeRunOp[] = ['stop', 'keep', 'undo', 'allow', 'always', 'deny'];

// Une course de l'agent affiché (l'id de son action, jamais un chemin ni un texte) :
// l'arrêter, la garder ou l'annuler, répondre à sa demande d'autorisation (controllers/runs).
export function vibeRunOp(id: unknown, op: unknown) {
  const agent = viewAgent();
  if (!agent || typeof id !== 'string' || !RUN_OPS.includes(op as VibeRunOp)) return;
  void runOp(agent, id, op as VibeRunOp);
}

// Une action directe (F-114) : l'appli lance elle-même sa liste fermée de
// commandes (technicals/direct) ou la recette (controllers/recipe), sans agent,
// avec des valeurs du dernier relevé (la branche, la base de sa PR, la PR
// suivie, le brouillon, les branches locales), de la fiche pr-<n>.json (la tête de la PR), de la
// demande retenue (sa branche), de git (la base du dépôt) ou vérifiées (un
// numéro de PR entier, un verdict des trois). En fond, une à la fois par
// agent : « en cours » puis son résultat partent au relevé. Rien ne suit une
// action (load-pr charge et suit la PR, seulement). Avant tout git switch : git status relu ;
// une ligne, ou pas de réponse → refusé.
function runDirect(agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config): SendResult {
  const { id } = def;
  const lang = vibeLang(cfg);
  const mine = directs.get(agent.id) ?? {};
  // Un worktree (enfant ou robot) reste sur sa branche, quel que soit l'écran (note 0.12.0-gestion-des-branches).
  if (agentParent(agent) && BRANCH_CHANGES.includes(id)) return fail(lang, 'worktree');
  if (Object.values(mine).some((x) => x.running)) return fail(lang, 'action');
  // Une course vivante la retient comme une autre course (la règle de runs) ; pas un nouveau worktree (ailleurs).
  const held = ELSEWHERE.includes(id) ? null : blockedBy(def, lockingRuns(agent.id), lang);
  if (held) return { ok: false, error: held };
  const out = vibeOutDir(agent.id);
  const run = directRunner({ dir: agent.dir, out, prefix: agentPrefix(agent, cfg) });
  const n = prNumber((view.loaded ?? view.pr)?.number);   // la PR suivie et chargée (les deux rôles), sinon celle du relevé
  const refused = (line: string): DirectResult => ({ ok: false, line, detail: '' });
  const clean = async () => (await gitRun(agent.dir)(['status', '--porcelain']))?.trim() === '';
  const DIRTY = 'Refused: uncommitted changes in this folder (or no answer from git status): nothing done.';
  const NO_BASE = 'No base branch found for this repository: nothing done.';
  // La base du dépôt (origin/HEAD, sinon main ou master), sans « origin/ ».
  const repoBase = async () => (await gitReader(gitRun(agent.dir)).facts())?.base.replace(/^origin\//, '') || null;
  // La tête de la PR (de pr-<n>.json), rapatriée ; sinon le refus ou l'échec, à rendre.
  const fetchHead = async (pr: number): Promise<{ head: string; detail: string } | DirectResult> => {
    const head = branchName(json(readFile(path.join(out, `pr-${pr}.json`)))?.head);
    if (!head) return refused(`Refused: no safe head branch in pr-${pr}.json.`);
    const fetched = await run.fetchBranch(head);
    return fetched.ok ? { head, detail: fetched.detail } : fetched;
  };
  // Le dossier a changé de branche : les derniers Rebase et Pousser ne la concernent plus (Pousser ne la vise jamais).
  const moved = (r: DirectResult) => { if (r.ok) { delete mine.rebase; delete mine.push; } return r; };
  // Une branche locale du relevé (switch-branch, onto, start), ou rien de donné (undefined) ; sinon null.
  const local = (v: unknown) => (v === undefined || (typeof v === 'string' && view.branches?.includes(v)) ? v as string | undefined : null);
  const asked = requests.get(agent.id);
  let job: () => Promise<DirectResult>;
  if (id === 'commit') job = () => run.commit();
  else if (id === 'fetch') job = () => run.fetchAll();   // Actualiser : au clic seulement ; le relevé suit (track)
  else if (id === 'pull') job = () => run.pull();
  else if (id === 'push') job = () => run.push();
  else if (id === 'switch-branch') {
    const branch = local(args.branch);
    if (!branch) return fail(lang, 'args');
    job = async () => moved(await clean() ? await run.switchTo(branch) : refused(DIRTY));
  } else if (id === 'rebase') {
    // Sur origin/<base du dépôt> par défaut (rapatriée), ou sur une branche locale.
    const onto = local(args.onto);
    if (onto === null) return fail(lang, 'args');
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const f = await run.fetchBranch(base);
      return f.ok ? run.rebase(onto ?? `origin/${base}`) : f;
    };
  } else if (id === 'request-review') {
    // Une PR de Toutes les PR, ni des miennes ni déjà à relire ; mon identifiant lu par gh, puis gh pr edit ; les listes relues.
    const pr = prNumber(args.pr);
    const prs = view.prs || null;
    const has = (list: { number: number }[]) => list.some((p) => p.number === pr);
    if (!pr || !prs || !has(prs.all) || has(prs.mine) || has(prs.review)) return fail(lang, 'pr');
    job = async () => {
      const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
      const login = await gh.login();
      if (!login) return refused('No GitHub login (gh api user): nothing done.');
      const r = await run.requestReview(pr, login);
      if (r.ok) prsFound.set(agent.id, (await gh.openPrs()) ?? false);
      return r;
    };
  } else if (id === 'assign-pr' || id === 'unassign-pr') {
    // La PR du dernier relevé (jamais celle de la page), mon identifiant lu par gh, au clic seulement ; la PR relue après.
    const pr = prNumber(view.pr?.number);
    if (!pr) return fail(lang, 'pr');
    job = async () => {
      const login = await githubReader(ghRun(agent.dir, agentPrefix(agent, cfg))).login();
      if (!login) return refused('No GitHub login (gh api user): nothing done.');
      const r = await (id === 'assign-pr' ? run.assign(pr, login) : run.unassign(pr, login));
      const hit = ghCache.get(`people ${agent.dir} ${pr}`);
      if (hit) hit.at = 0;   // ses personnes redemandées : le rôle relu
      return r;
    };
  } else if (id === 'copy-artifact') {
    // Des ids du dernier relevé ; le dossier choisi dans la boîte de dialogue (controllers/artifacts, qui revérifie).
    if (!Array.isArray(args.artifacts)) return fail(lang, 'args');
    const ids = args.artifacts;
    job = () => copyArtifact(agent, ids);
  } else if (id === 'add-artifact') {
    // Le dépôt seul (dropOnArtifacts) : conv:vibeRun ne porte jamais de chemin (I-37).
    return fail(lang, 'action');
  } else if (id === 'rename-artifact') {
    // Un seul id ; le nom tapé, revérifié par artifact-ops (comme tout ce qui suit : les valeurs passent telles quelles).
    if (!Array.isArray(args.artifacts) || args.artifacts.length !== 1) return fail(lang, 'args');
    const [one] = args.artifacts;
    job = () => renameArtifact(agent, one, args.name);
  } else if (id === 'new-artifact-file' || id === 'new-artifact-folder') {
    job = () => newArtifact(agent, args.folder, args.name, id === 'new-artifact-folder');
  } else if (id === 'trash-artifacts') {
    job = () => trashArtifacts(agent, args.artifacts, args.names);
  } else if (id === 'move-artifacts') {
    job = () => moveArtifacts(agent, args.artifacts, args.folder);
  } else if (id === 'copy-artifacts') {
    job = () => copyArtifacts(agent, args.artifacts, args.folder);
  } else if (id === 'duplicate-artifacts') {
    job = () => duplicateArtifacts(agent, args.artifacts);
  } else if (id === 'load-pr') {
    const pr = args.pr === undefined ? n : prNumber(args.pr);
    if (!pr) return fail(lang, 'pr');
    // Une PR d'un fork refusée ; la fiche et la tête, puis la base de la fiche (le relevé compare à origin/<base>).
    job = async () => {
      const same = await run.sameRepo(pr);
      if (!same.ok) return same;
      const r = await run.loadPr(pr);
      if (r.ok) patchVibe(agent.id, { pr });   // la PR suivie, les deux rôles
      const base = r.ok ? branchName(json(readFile(path.join(out, `pr-${pr}.json`)))?.base) : null;
      if (!base) return r;
      const f = await run.fetchBranch(base);
      return f.ok ? { ...r, detail: `${same.detail}\n\n${r.detail}\n\n${f.detail}` } : f;
    };
  } else if (id === 'publish') {
    if (!n) return fail(lang, 'pr');
    if (!(VERDICTS as readonly unknown[]).includes(args.verdict)) return fail(lang, 'verdict');
    if (!view.draft.length) return fail(lang, 'draft');
    job = () => run.publish(n, args.verdict, draftText(view.draft), view.pr?.url ?? '');
  } else if (id === 'pr-here') {
    if (!n) return fail(lang, 'pr');
    // La tête rapatriée, puis git switch (le dossier propre à cet instant) et git pull --ff-only origin <tête>.
    job = async () => {
      const f = await fetchHead(n);
      if (!('head' in f)) return f;
      const r = moved(await clean() ? await run.switchTo(f.head) : refused(DIRTY));
      if (!r.ok) return r;
      const p = await run.pullBranch(f.head);
      return p.ok ? r : p;
    };
  } else if (id === 'pr-worktree') {
    if (!n) return fail(lang, 'pr');
    // La tête rapatriée, le worktree pr-<n> depuis origin/<tête>, puis le robot (I-41).
    job = async () => {
      const f = await fetchHead(n);
      if (!('head' in f)) return f;
      const branch = `pr-${n}`;
      const r = await createWorktree(agent, { branch, base: f.head, start: `origin/${f.head}` }, cfg);
      if (r.ok && r.dir) await prWorktreeReady(agent, n, r.dir, branch);
      return { ok: r.ok, line: r.line, detail: f.detail };
    };
  } else if (id === 'stash') {
    // git stash push -u, puis le dossier relu : propre, ok ; sinon l'échec. Rien d'autre ne suit.
    job = async () => {
      const r = await run.stash();
      if (!r.ok || await clean()) return r;
      return { ...r, ok: false, line: 'Stash done, but this folder still has changes (or no answer from git status).' };
    };
  } else if (id === 'unload-pr') {
    // La base du dépôt, le dossier propre à cet instant ; puis la PR plus suivie.
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const r = moved(await clean() ? await run.switchTo(base) : refused(DIRTY));
      if (r.ok) patchVibe(agent.id, { pr: null });
      return r;
    };
  } else if (id === 'new-here' || id === 'new-worktree') {
    // Le nom saisi (pas une branche locale) l'emporte sur celui de la demande ; le départ : une branche locale, ou origin/<base>.
    const typed = args.branch === undefined ? undefined : branchName(args.branch);
    const start = local(args.start);
    if (typed === null || (typed && view.branches?.includes(typed)) || start === null) return fail(lang, 'args');
    const branch = typed ?? asked?.branch;
    if (!branch) return fail(lang, 'action');
    // La base du dépôt rapatriée, puis le choix. Sans demande retenue, rien ne suit (ni Créer, ni note).
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const f = await run.fetchBranch(base);
      if (!f.ok) return f;
      const from = start ?? `origin/${base}`;
      if (id === 'new-here') {
        // git switch -c <branche> <départ> (le dossier propre à cet instant) ; une demande : le dossier en Créer.
        const r = moved(await clean() ? await run.switchTo(branch, from) : refused(DIRTY));
        if (!r.ok || !asked) return r;
        requests.delete(agent.id);
        firstNotes.set(agent.id, asked.text);
        return r;
      }
      // Le worktree de la branche depuis son départ, l'enfant (la question de confiance), affiché ;
      // pas d'enfant (confiance refusée…) : la demande reste retenue ici.
      const r = await createWorktree(agent, { branch, base, start: from }, cfg);
      if (!r.ok || !r.dir) return { ok: r.ok, line: r.line, detail: f.detail };
      const child = await openChild(agent, r.dir, { name: branch, create: true });
      if (!child) return refused(`Worktree created (${r.dir}), but no agent opened there${asked ? ': the request stays here' : ''}.`);
      if (asked) {
        requests.delete(agent.id);
        firstNotes.set(child.id, asked.text);
      }
      openConversation(child.id);
      return { ok: true, line: r.line, detail: f.detail };
    };
  } else if (id === 'remove-worktree') {
    // Retiré, le worktree d'une PR emporte sa branche pr-<n>, au dossier du parent (hors de la recette).
    job = async () => {
      const pr = agentParent(agent)?.pr;
      const parent = worktreeParent(agent);
      const r = await removeWorktreeChild(agent);
      if (!r.ok || !pr || !parent) return { ...r, detail: '' };
      const d = await directRunner({ dir: parent.dir, out: vibeOutDir(parent.id), prefix: agentPrefix(parent, cfg) }).dropPrBranch(pr);
      return d.ok ? { ...r, detail: d.detail } : d;
    };
  } else {
    const branch = view.repo?.branch;
    const base = view.pr?.base || view.repo?.base.replace(/^origin\//, '');
    if (!branch || !base) return fail(lang, 'repo');
    job = async () => moved(await clean() ? await run.toBase(branch, base) : refused(DIRTY));
  }
  directs.set(agent.id, mine);
  // Fini, les branches et l'état distant relus (Actualiser, Pull, Rebase… : HEAD ne bouge pas toujours) ;
  // l'ancienne réponse reste affichée d'ici là.
  void track(mine, id, () => job().finally(() => { const hit = gitCache.get(agent.id); if (hit) hit.key = ''; }));
  return { ok: true };
}

// Les réglages de l'agent (le rôle calculé, la PR suivie), changés d'après ceux d'à cet instant.
function patchVibe(id: string, patch: Partial<ReturnType<typeof agentVibe>>) {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (agent) updateAgent(id, { vibe: { ...agentVibe(agent), ...patch } });
}

// Une action directe de l'agent : « en cours », puis son résultat (un échec inattendu : sa ligne), au relevé.
async function track(mine: Record<string, NonNullable<VibeAction['direct']>>, id: string, job: () => Promise<DirectResult>) {
  mine[id] = { running: true, last: mine[id]?.last ?? null };
  refreshVibe({ now: true });
  const r = await job().catch((err): DirectResult => ({ ok: false, line: err instanceof Error ? err.message : String(err), detail: '' }));
  mine[id] = { running: false, last: { ...r, time: Date.now() } };
  refreshVibe({ now: true });
}

// Redémarrer depuis les sources : si un agent travaille (son tour, une course), la question d'abord, une à la
// fois ; Non : rien.
let asking = false;
async function confirmRestart() {
  if (asking) return;
  const busy = agentList(loadConfig()).filter((a) => isBusy(a.id) || lockingRuns(a.id).length > 0);
  if (busy.length) {
    asking = true;
    const { response } = await dialog.showMessageBox({
      type: 'warning', buttons: ['Non', 'Oui'], defaultId: 0, cancelId: 0, title: 'Redémarrer',
      message: 'Des agents tournent : voulez-vous quand même redémarrer ?',
      detail: `${busy.map((a) => a.name || a.dir).join('\n')}\n\nLeurs tours en cours s'arrêtent ; leurs conversations reprennent après.`,
    }).finally(() => { asking = false; });
    if (response !== 1) return;
  }
  restartApp();
}

// Un réglage de l'écran : arrêter Vibe (la bannière : vibeStop,
// la course en cours finit), la PR suivie (pour
// l'agent) ; « Vu » (la note de référence devient
// l'actuelle) ; modèle, effort et mode comme son
// menu (une valeur hors de ses choix est ignorée) ; arrêter son tour, comme
// Interrompre de son menu ; le robot de la PR dans son worktree (l'afficher,
// ou le proposer à nouveau : jamais un chemin, F-110) ; les PR ouvertes du dépôt (gh,
// sans agent, les deux rôles ; un échec s'affiche à la place) ; l'onglet Actions ouvert
// (ses courses vues, controllers/runs) ou fermé — même l'écran déjà quitté ; depuis les sources (app/dev),
// Recharger l'interface (reloadUi, pas pendant une dictée) ou Redémarrer (restartApp).
export function setVibe(patch: unknown) {
  if (!patch || typeof patch !== 'object') return;
  const p = patch as Record<string, unknown>;
  if (p.runsSeen === false) runsTab(null);
  const agent = viewAgent();
  if (!agent) return;
  const vibe = agentVibe(agent);
  if (p.vibe === false) vibeStop(agent);
  if (p.pr === null || prNumber(p.pr)) vibe.pr = p.pr as number | null;   // le rôle ne se choisit pas : un `flow` de la page est ignoré
  updateAgent(agent.id, { vibe });
  if (p.modulesView === 'ide' || p.modulesView === 'list') saveConfig({ vibeModulesView: p.modulesView });   // la vue des Modules, retenue ; autre valeur : ignorée
  if (p.seen === true) {
    const text = last.get(agent.id)?.note?.text;
    if (text !== undefined) turnNote.set(agent.id, { text, busy: isBusy(agent.id) });
  }
  for (const [key, choices] of [['model', MODELS], ['effort', EFFORTS], ['mode', MODES]] as const) {
    if (choices.some(([value]) => value === p[key])) setAgentSetting(agent.id, key, p[key] as string);
  }
  if (p.interrupt === true && isBusy(agent.id)) interruptAgent(agent.id);
  if (p.worktree === true) showWorktree(agent);
  if (p.runsSeen === true) runsTab(agent.id);
  // Depuis les sources (app/dev) : les pages seules reconstruites → les fenêtres rechargées, le principal et les
  // agents continuent ; le principal reconstruit → l'appli relancée, confirmé si un agent travaille.
  if (p.reloadUi === true && devState() === 'reload' && !state.recording) reloadPages();
  if (p.restartApp === true && devState() === 'restart') void confirmRestart();
  if (p.prs === true) {
    githubReader(ghRun(agent.dir, agentPrefix(agent, loadConfig()))).openPrs().then((list) => {
      prsFound.set(agent.id, list ?? false);
      refreshVibe({ now: true });
    });
  }
  refreshVibe({ now: true });
}

// ✓, ✗ ou oublier (null), pour le contenu que l'utilisateur a sous les yeux.
export function markVibe(target: unknown, verdict: unknown) {
  const agent = viewAgent();
  const view = agent && last.get(agent.id);
  if (!agent || !view || typeof target !== 'string' || (verdict !== 'ok' && verdict !== 'ko' && verdict !== null)) return;
  const hash = targetHash(view, target);
  if (!hash) return;
  const store = vibeStore();
  store.marks[agent.id] = setMark(store.marks[agent.id] || {}, target, hash, verdict);
  saveVibeStore(store);
  refreshVibe({ now: true });
}

// Relecteur : le brouillon de revue de la PR suivie — ajouter une remarque (sa
// cible, sur une ligne de 300 caractères au plus ; le texte du champ, 5 000),
// en changer le texte (mêmes limites) ou en retirer une.
export function draftVibe(op: unknown) {
  const agent = viewAgent();
  const { flow, pr } = agent ? agentVibe(agent) : { flow: null, pr: null };
  if (!agent || flow !== 'review' || !pr || !op || typeof op !== 'object') return;
  const { add, edit, remove } = op as {
    add?: { target?: unknown; text?: unknown } | null; edit?: { id?: unknown; text?: unknown } | null; remove?: unknown;
  };
  const okText = (t: unknown): t is string => typeof t === 'string' && !!t.trim() && t.length <= REMARK_MAX;
  const store = vibeStore();
  const drafts = store.drafts[agent.id] || {};
  if (add && typeof add.target === 'string' && typeof add.text === 'string'
    && add.target.length <= TARGET_MAX && !/[\r\n]/.test(add.target) && okText(add.text)) {
    store.drafts[agent.id] = addComment(drafts, pr, add.target, add.text);
  } else if (edit && Number.isInteger(edit.id) && okText(edit.text)) {
    store.drafts[agent.id] = editComment(drafts, pr, edit.id as number, edit.text);
  } else if (Number.isInteger(remove)) {
    store.drafts[agent.id] = removeComment(drafts, pr, remove as number);
  } else return;
  saveVibeStore(store);
  refreshVibe({ now: true });
}

// Un fichier écrit pour être ouvert (le diff d'un commit) : <sorties>/<rel>, en lecture seule, remplacé s'il existe ; son
// dossier doit rester dans le dossier de sorties (`..`, ou un lien qui en
// sort : rien). Son chemin, ou null.
function writeForEditor(out: string, rel: string, text: string) {
  const target = path.resolve(out, rel);
  if (!target.startsWith(path.resolve(out) + path.sep)) return null;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const dir = safePath(out, path.relative(out, path.dirname(target)), fs.realpathSync.native);
    if (!dir) return null;
    const file = path.join(dir, path.basename(target));
    fs.rmSync(file, { force: true });
    fs.writeFileSync(file, text, { mode: 0o444, flag: 'wx' });
    return file;
  } catch { return null; }
}

// Processus : une commande du fichier du projet par son rang dans le dernier
// relevé (lancer, arrêter, relancer, son journal), ou le fichier du projet
// dans l'éditeur ; jamais un texte ni un chemin (controllers/processes).
export async function vibeProcess(op: unknown, index?: unknown) {
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view) return;
  await processAction(agent, cfg, op, index, view.processes ?? []);
  refreshVibe({ now: true });
}

// Un fichier ou un commit du relevé, par son id (jamais un chemin, I-37) :
// - un fichier (n, t…, v…, m…) dans l'éditeur, à `line` si
//   elle est donnée : celui du dossier de l'agent (safePath), dans les deux rôles ;
// - `c<rang>` : le diff du commit (git show), écrit dans <sorties>/files/<hash>.diff ;
// - `gh:c<rang>` : la page du commit sur GitHub, dans le navigateur, d'après
//   l'origine du dépôt (githubPage, I-32) ; sans origine GitHub, rien ;
// - `a<i>` : un artefact du projet de l'agent, dans l'éditeur (artifactFile : dans son dossier, sans lien).
export async function openVibeItem(id: unknown, line?: unknown) {
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view || typeof id !== 'string') return;
  const at = Number.isInteger(line) && (line as number) > 0 ? line as number : undefined;
  const open = (file: string | null) => { if (file) findEditor(cfg.editorCommand)?.openFile(file, at); };
  const out = vibeOutDir(agent.id);
  const git = gitReader(gitRun(agent.dir));
  const commit = itemCommit(view, id);
  if (/^a\d+$/.test(id)) open(artifactFile(agent.id, artifactOf(view, id)));
  else if (commit?.web) {
    const page = githubPage(agent.dir, readFile);
    if (page && /^[0-9a-f]{7,64}$/.test(commit.hash)) shell.openExternal(`${page}/commit/${commit.hash}`);
  } else if (commit) {
    const text = await git.commit(commit.hash);
    open(text === null ? null : writeForEditor(out, path.join('files', `${commit.hash}.diff`), text));
  } else {
    const rel = itemPath(view, id);
    if (rel) open(safePath(agent.dir, rel, fs.realpathSync.native));
  }
}
