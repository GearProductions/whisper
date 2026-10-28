/** vibecoder — l'écran VibeCoder de l'agent affiché. Son relevé (le dépôt par
 *  git en lecture, la note, les tests de la branche, les sorties des skills,
 *  les validations → le parcours, core/vibecoder) part au panneau (`conv:vibe`)
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
 *  remove-worktree, stash, unload-pr, new-here, new-worktree), au clic de « direct » : leurs
 *  commandes, lancées par l'appli, F-114), une course (vibeRunOp : l'arrêter, la garder ou l'annuler, répondre
 *  à sa demande d'autorisation), un réglage (dont arrêter l'agent, comme Interrompre de son
 *  menu ; arrêter Vibe, la bannière : vibeStop de controllers/runs ;
 *  l'onglet Actions ouvert ou fermé : ses courses vues, runsTab de controllers/runs),
 *  une validation (dont ✓ Rien à écrire, Créer : pour le texte de la note), le brouillon de revue, ouvrir un fichier ou un commit
 *  du relevé (dans l'éditeur, à une ligne ; la page d'un commit dans le
 *  navigateur, d'après l'origine GitHub du dépôt, I-32).
 *  Ne lit que la note et les tests que git donne dans le dossier de l'agent
 *  (safePath), et les sorties de cet agent sous leurs noms connus (isOutputName),
 *  dont toutes ses lectures d'invariants (invariants/<blob>.md : celle d'un
 *  test modifié depuis reste montrée, périmée, core/vibecoder) : une page
 *  désigne un fichier par son id dans le dernier relevé (lastView), jamais par
 *  un chemin (I-37). Les fichiers d'un module touché : leurs chemins seulement
 *  (list : sous son dossier, ni lien ni fichier ou dossier caché ni node_modules,
 *  target, dist, build, son dossier par safePath, au plus LIST_MAX),
 *  pas leur texte (controllers/module-code lit le fichier ouvert). Une action qui génère un module : sa course le retient
 *  (runModule → startRun). Ce qu'il écrit pour l'ouvrir (le diff d'un
 *  commit) va sous <sorties>/files/, en lecture seule. Le message d'une
 *  action : son gabarit, rempli par buildMessage (I-38 ; un argument inutile est
 *  ignoré, rendu dans ignored pour l'orchestrateur, F-115), avec le préfixe des
 *  commandes vu de l'agent qui le reçoit ({{prefix}} : processes.promptPrefix). git en lecture seule
 *  (technicals/git, I-39), sauf les actions directes (technicals/direct, la recette) ; gh aussi, sans agent (technicals/github, derrière
 *  le préfixe de l'agent : processes.agentPrefix) : Créer, la PR de la
 *  branche ; Relire, l'état de la PR chargée (60 s en cache, demandés en
 *  fond : le relevé ne les attend pas ; ↻ les redemande) et Mes PR à relire
 *  (setVibe({ prs })). Créer : les sorties
 *  suivent la branche (followBranch). Relire lit la copie de travail, comme
 *  Créer, comparée à origin/<base de la fiche pr-<n>.json> (note
 *  0.12.0-creer-relire-meme-dossier : la PR se charge dans ce dossier) ; passer
 *  en Relire sans PR suivie suit la PR ouverte du dernier relevé de Créer (sa
 *  fiche écrite, rien de chargé). Au relevé, pour le parcours : le dossier
 *  (checkout : sa branche, ses modifications), l'agent enfant d'un worktree
 *  (child), la recette de sa famille (controllers/recipe), la branche d'une
 *  nouvelle demande retenue (request). Chaque choix de lieu est une action
 *  directe, au clic seulement, jamais au relevé ni à la suite d'une autre :
 *  avant tout git switch (pr-here, unload-pr, new-here, base), git status relu,
 *  une ligne ou pas de réponse → refusé ; pr-here : la tête de pr-<n>.json
 *  rapatriée puis git switch ; pr-worktree : la tête rapatriée, la recette
 *  (VIBECODER_BRANCH pr-<n>, VIBECODER_BASE la tête, départ origin/<tête>),
 *  puis le robot (controllers/worktrees prWorktreeReady : la question de
 *  confiance toujours, I-41) ; stash : git stash push -u, puis git status
 *  relu (propre : ok ; sinon l'échec), rien d'autre ne suit ; unload-pr : la
 *  base du dépôt, puis la PR plus suivie. Retirer le worktree
 *  (remove-worktree, directe seulement, jamais par l'agent) :
 *  controllers/worktrees ; celui d'une PR retiré, sa branche pr-<n> supprimée
 *  au dossier du parent (technicals/direct). Nouvelle demande (new-request) :
 *  la demande retenue en mémoire ; au relevé, <sorties>/new-request.json (la
 *  branche nommée par l'agent) supprimé et, avec une demande retenue, sa
 *  branche retenue avec elle (rien de créé au relevé) ; new-here : git switch
 *  -c <branche> origin/<base>, le dossier en Créer ; new-worktree : le
 *  worktree (départ origin/<base>), l'enfant (la question de confiance),
 *  affiché ; puis, au premier relevé du dossier ou de l'enfant, Rédiger la
 *  note avec la demande.
 *  git manquant, dossier sans dépôt,
 *  fichier illisible : rien ne bloque le fil ni l'agent (I-29). L'onglet
 *  Processus (les commandes du projet, au relevé ; vibeProcess) :
 *  controllers/processes.
 *  Ne connaît pas : la page (seulement ses canaux), la fenêtre.
 *  Utilisé par : app/ipc, app/menus, app/windows (vibeAgent : la taille du
 *  panneau), controllers/conversation, controllers/runs, controllers/module-code
 *  (lastView). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shell } from 'electron';
import type { SendResult, VibeAction, VibeArgs, VibeLang, VibeRunOp, VibeView } from 'shared/bridge';
import { EFFORTS, MODELS, MODES, type AgentConfig } from 'core/agents';
import { agentList, agentVibe, vibeLang, type Config } from 'core/config';
import { agentParent } from 'core/family';
import { githubPage } from 'core/repo';
import {
  addComment, blobSha, buildMessage, vibeMarks, DIRECT_ACTIONS, DIRECT_ONLY, draftText, editComment, findNote, forkedModel, isOutputName, isTest, itemCommit, itemPath,
  blockedBy, json, newRequestCard, noteKey, ownRun, prNumber, removeComment, runModule, runViews, safePath, setMark, targetHash, vibeView, whoOf, type ActionDef, type MessageError,
} from 'core/vibecoder';
import { findEditor } from 'technicals/editor';
import { directRunner, prCardText, VERDICTS, type DirectResult } from 'technicals/direct';
import { gitReader, gitRun, okRef } from 'technicals/git';
import { ghRun, githubReader } from 'technicals/github';
import { which } from 'technicals/paths';
import { loadConfig, saveConfig, saveVibeStore, updateAgent, vibeActions, vibeOutDir, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { conversationShown, openConversation } from 'app/windows';
import { interruptAgent, isBusy, liveViewAgent, sendToAgent, setAgentSetting } from './agents';
import { agentPrefix, processAction, processView, promptPrefix, readFile, readTimed } from './processes';
import { createWorktree } from './recipe';
import { lockingRuns, runOp, viewLocks, runPending, runRequests, runsOf, runsTab, skillMd, startRun, vibeOn, vibeStart, vibeStop } from './runs';
import { openChild, prWorktreeReady, removeWorktreeChild, showWorktree, syncWorktrees, wantWorktree, worktreeParent, worktreeState } from './worktrees';

const VIBE_MS = 4000;          // le relevé régulier, panneau visible
const THROTTLE_MS = 1000;      // au plus un relevé par seconde
const TARGET_MAX = 300;        // une remarque du brouillon de revue : sa cible…
const REMARK_MAX = 5000;       // … et son texte
const GH_MS = 60_000;          // une réponse de gh vaut 60 s
const LIST_MAX = 1000;         // les fichiers d'un module au relevé : les premiers seulement
const SKIP_DIRS = new Set(['node_modules', 'target', 'dist', 'build']);   // ni leurs fichiers

const ERRORS: Record<VibeLang, Record<MessageError | 'agent' | 'action' | 'args' | 'noGit' | 'notRepo', string>> = {
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
    variable: 'Badly written action (unknown variable), or refused value (control character): see the VibeCoder folder.',
    check: 'This check is not in the last list (checks.json).',
    noGit: 'git not found: the journey cannot be read. The conversation still works.',
    notRepo: 'This folder is not a git repository: the journey cannot be read. The conversation still works.',
  },
};

const last = new Map<string, VibeView>();  // le dernier relevé envoyé, par agent : ce que la page désigne
const turnNote = new Map<string, { text: string; busy: boolean }>();  // la note au début du tour (surlignage)
const ghCache = new Map<string, { at: number; value: unknown; pending: boolean }>();  // par question à gh
const directs = new Map<string, Record<string, NonNullable<VibeAction['direct']>>>();  // par agent : ses actions directes (F-114)
const prsFound = new Map<string, unknown[]>();   // Relire : Mes PR à relire, par agent (la dernière réponse de gh)
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

// L'agent affiché, sur sa session en cours, s'il est en VibeCoder.
export function vibeAgent(cfg: Config = loadConfig()) {
  const agent = liveViewAgent(cfg);
  return agent && agent.view === 'vibecoder' ? agent : null;
}

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

// Relève l'agent affiché en VibeCoder et envoie son parcours au panneau ;
// sinon null, une fois. Un relevé à la fois, au plus un par seconde (sauf
// `now`, ou un autre agent) : le suivant attend ; un appel pendant un relevé
// se résout à sa fin (panelReady attend ainsi le premier). `fresh` (↻) : les
// réponses de gh sont redemandées.
export async function refreshVibe({ now = false, fresh = false }: { now?: boolean; fresh?: boolean } = {}) {
  if (fresh) for (const entry of ghCache.values()) entry.at = 0;
  syncWorktrees(); // Relire dans un worktree : le robot temporaire arrive ou part (F-110)
  const cfg = loadConfig();
  const agent = vibeAgent(cfg);
  const panel = state.panel && !state.panel.isDestroyed() ? state.panel : null;
  if (!agent || !panel) {
    if (timer) { clearInterval(timer); timer = null; }
    if (shown !== null) panel?.webContents.send('conv:vibe', null);
    shown = null;
    return;
  }
  // Toutes les 4 s, seulement panneau visible ; arrêté quand l'agent n'est plus en VibeCoder.
  timer ??= setInterval(() => { if (conversationShown() || !vibeAgent()) refreshVibe(); }, VIBE_MS);
  // Panneau caché (réduit) : aucun relevé ; il reprend à sa réapparition.
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
      if (state.panel && !state.panel.isDestroyed() && vibeAgent()?.id === agent.id) {
        last.set(agent.id, view);
        state.panel.webContents.send('conv:vibe', view);
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

// Les fichiers d'un chemin du dépôt et de ses sous-dossiers, relatifs au dépôt (un fichier : lui-même) ;
// ni lien (ni fichier ni dossier pour son Dirent) ni dossier ou fichier caché, ni SKIP_DIRS, le chemin
// dans le dossier de l'agent (safePath, une fois) ; au plus LIST_MAX, les premiers trouvés. Leurs chemins, pas leur texte.
function listFiles(dir: string, rel: string): string[] {
  const out: string[] = [];
  const walk = (r: string) => {
    try {
      for (const e of fs.readdirSync(path.join(dir, r), { withFileTypes: true })) {
        if (out.length >= LIST_MAX || e.name.startsWith('.')) continue;
        if (e.isFile()) out.push(path.posix.join(r, e.name));
        else if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(path.posix.join(r, e.name));
      }
    } catch { /* illisible : sans lui */ }
  };
  if (!safePath(dir, rel, fs.realpathSync.native)) return out;
  try {
    const st = fs.lstatSync(path.join(dir, rel));
    if (st.isFile()) out.push(rel);
    else if (st.isDirectory()) walk(rel);
  } catch { /* illisible : sans lui */ }
  return out;
}

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

// Créer : les sorties que les skills écrivent pour une branche (pas les lectures
// invariants/, nommées par l'empreinte du test, ni celles de Relire, par PR).
const BRANCH_OUTPUTS = ['questions.md', 'align.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'ponytail-applied.json', 'pr.json', 'ci.md'];

// Les sorties de Créer suivent la branche : la dernière vue est dans
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
function firstNote(agent: AgentConfig, view: VibeView, cfg: Config) {
  const text = firstNotes.get(agent.id);
  const def = text === undefined ? null : vibeActions(vibeLang(cfg)).find((a) => a.id === 'note');
  if (!def) return;
  const sent = startAction(agent, def, { text }, view, cfg);
  if (sent.ok || sent.invalid) firstNotes.delete(agent.id);
}

async function survey(agent: AgentConfig, cfg: Config): Promise<VibeView> {
  const lang = vibeLang(cfg);
  const { flow, pr } = agentVibe(agent);
  const realpath = fs.realpathSync.native;
  const git = gitReader(gitRun(agent.dir));
  // La copie de travail, dans les deux parcours. Relire : la PR chargée (sa fiche), comparée à la base
  // de sa fiche, sous le nom de sa branche ; sans fiche, rien à lire.
  const created = flow === 'create' ? await git.facts() : null;
  const out = vibeOutDir(agent.id);
  if (created) followBranch(out, created.branch, created.base);
  const outputs = readOutputs(out);
  if (outputs['new-request.json']) takeRequest(agent, outputs['new-request.json'].text);
  const card = flow === 'review' && pr ? json(outputs[`pr-${pr}.json`]?.text) : null;
  const base = branchName(card?.base);
  const facts = created ?? (card ? await git.facts(undefined, base ? `origin/${base}` : undefined) : null);
  // gh, sans agent : Créer, la PR de la branche (pas sur la base) ; Relire, l'état de la PR chargée.
  const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
  const feature = created && created.branch !== 'HEAD' && created.base !== created.branch && !created.base.endsWith(`/${created.branch}`)
    ? created.branch : null;
  const github = {
    pr: feature ? fromGh(`pr ${agent.dir} ${feature}`, () => gh.prForBranch(feature)) : null,
    state: card && pr ? fromGh(`state ${agent.dir} ${pr}`, () => gh.prState(pr)) : null,
    prs: flow === 'review' ? prsFound.get(agent.id) ?? null : null,
  };
  const repo = facts && { branch: branchName(card?.head) ?? facts.branch, base: facts.base, changed: facts.changed, dirty: facts.dirty, commits: facts.commits };
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
  const who = Object.fromEntries(actions.map((a) => [a.id, whoOf(skills[a.id], lang)]));
  const running = lockingRuns(agent.id);
  // Le dossier : d'après facts (même copie de travail) ; Relire sans fiche, relu à part.
  const checkout = facts ? { branch: facts.branch, dirty: facts.dirty.length > 0 } : await checkoutOf(agent.dir);
  // Processus : les commandes du projet, leur état, la recette de la famille (controllers/processes).
  const proc = processView(agent, cfg);
  const journey = vibeView({
    agentId: agent.id, lang, flow, pr, vibe: vibeOn(agent.id),
    agent: { model: agent.model || '', effort: agent.effort || '', mode: agent.mode || 'default' },
    busy,
    running,
    runs: runViews(runsOf(agent), actions.map((a) => ({ id: a.id, label: a.label, who: who[a.id] })), runPending(agent.id)),
    repo,
    error: repo ? null : !which('git') ? ERRORS[lang].noGit : flow === 'create' ? ERRORS[lang].notRepo : null,
    note: notePath && noteText !== null ? { path: notePath, text: noteText, before: before !== null && before !== noteText ? before : null } : null,
    tests,
    readings,
    outputs,
    marks: store.marks[agent.id] || {},
    draft: flow === 'review' && pr ? store.drafts[agent.id]?.[pr] || [] : [],
    // en création : Dans un worktree (pr-worktree, direct) en cours
    worktree: worktreeState(agent, flow === 'review' ? pr : null, !!directs.get(agent.id)?.['pr-worktree']?.running),
    child: !!agentParent(agent),
    recipe: proc.recipe,
    checkout,
    request: requests.get(agent.id)?.branch ?? null,
    github,
    actions,
    direct: directs.get(agent.id),
    who,
    model: Object.fromEntries(actions.map((a) => [a.id, forkedModel(skills[a.id])])),
    skills: skillNames(agent.dir),
    exists: (rel) => { const file = safePath(agent.dir, rel, realpath); return !!file && fs.existsSync(file); },
    list: (rel) => listFiles(agent.dir, rel),
    now: Date.now(),
  });
  // Vibe en cours : les étapes faites reçoivent leur ✓, qu'elles gardent une fois Vibe fini (F-102).
  if (journey.vibe) {
    const marks = store.marks[agent.id] || {};
    const next = vibeMarks(marks, journey);
    if (next !== marks) { store.marks[agent.id] = next; saveVibeStore(store); }
  }
  return { ...journey, ...proc };
}

/* ---- Ce que demande l'écran ------------------------------------------------ */

const fail = (lang: VibeLang, key: keyof typeof ERRORS.fr): SendResult => ({ ok: false, error: ERRORS[lang][key] });

// Une action de l'écran (son id, dans le dernier relevé de l'agent affiché, et
// active) → son gabarit rempli de valeurs vérifiées (buildMessage : le type,
// la taille et la valeur de chaque argument), envoyé comme un message tapé.
export function runVibeAction(id: unknown, args: unknown): SendResult {
  const cfg = loadConfig();
  const lang = vibeLang(cfg);
  const agent = vibeAgent(cfg);
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
  const shown = view.actions.find((a) => a.id === def.id);
  const held = ownRun(def) ? blockedBy(def, viewLocks(view, vibeActions(lang)), lang) : null;
  if (shown?.disabled && shown.disabled !== held) return { ok: false, error: shown.disabled };
  const message = buildMessage(def, args, { view, out: vibeOutDir(agent.id), lang, prefix: promptPrefix(agent, cfg) });
  if ('error' in message) return { ...fail(lang, message.error), invalid: true };
  const sent = ownRun(def) ? startRun(agent, def, message.text, cfg, runModule(def.id, args, view.modules)) : sendToAgent(agent, { text: message.text, images: [] }, cfg);
  // Dans un worktree, par l'agent : sa fiche pr-<n>-worktree.json attendue (syncWorktrees, la question de confiance).
  if (sent.ok && def.id === 'pr-worktree' && view.pr) wantWorktree(agent.id, view.pr.number);
  // Nouvelle demande : la demande retenue ; une fiche d'avant et les derniers résultats de ses choix, oubliés.
  if (sent.ok && def.id === 'new-request') {
    fs.rmSync(path.join(vibeOutDir(agent.id), 'new-request.json'), { force: true });
    requests.set(agent.id, { text: args.text as string });
    for (const id of ['new-here', 'new-worktree']) delete directs.get(agent.id)?.[id];
  }
  return message.ignored ? { ...sent, ignored: message.ignored } : sent;
}

// Les actions directes en cours de l'agent, comme des courses (elles lisent ou modifient la branche) : startRun les respecte.
export const directLocks = (agentId: string, defs: ActionDef[]) => Object.entries(directs.get(agentId) ?? {})
  .filter(([, x]) => x.running).map(([id]) => ({ id, reads: !!defs.find((d) => d.id === id)?.reads }));

const RUN_OPS: VibeRunOp[] = ['stop', 'keep', 'undo', 'allow', 'always', 'deny'];

// Une course de l'agent affiché (l'id de son action, jamais un chemin ni un texte) :
// l'arrêter, la garder ou l'annuler, répondre à sa demande d'autorisation (controllers/runs).
export function vibeRunOp(id: unknown, op: unknown) {
  const agent = vibeAgent();
  if (!agent || typeof id !== 'string' || !RUN_OPS.includes(op as VibeRunOp)) return;
  void runOp(agent, id, op as VibeRunOp);
}

// Une action directe (F-114) : l'appli lance elle-même sa liste fermée de
// commandes (technicals/direct) ou la recette (controllers/recipe), sans agent,
// avec des valeurs du dernier relevé (la branche, la base de sa PR, la PR
// suivie, le brouillon), de la fiche pr-<n>.json (la tête de la PR), de la
// demande retenue (sa branche), de git (la base du dépôt) ou vérifiées (un
// numéro de PR entier, un verdict des trois). En fond, une à la fois par
// agent : « en cours » puis son résultat partent au relevé. Rien ne suit une
// action (load-pr charge seulement). Avant tout git switch : git status relu ;
// une ligne, ou pas de réponse → refusé.
function runDirect(agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config): SendResult {
  const { id } = def;
  const lang = vibeLang(cfg);
  const mine = directs.get(agent.id) ?? {};
  if (Object.values(mine).some((x) => x.running)) return fail(lang, 'action');
  // Une course vivante la retient comme une autre course (la règle de runs).
  const held = blockedBy(def, lockingRuns(agent.id), lang);
  if (held) return { ok: false, error: held };
  const out = vibeOutDir(agent.id);
  const run = directRunner({ dir: agent.dir, out, prefix: agentPrefix(agent, cfg) });
  const n = prNumber(view.pr?.number);
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
  const asked = requests.get(agent.id);
  let job: () => Promise<DirectResult>;
  if (id === 'commit') job = () => run.commit();
  else if (id === 'load-pr') {
    const pr = args.pr === undefined ? n : prNumber(args.pr);
    if (!pr) return fail(lang, 'pr');
    // Une PR d'un fork refusée ; la fiche et la tête, puis la base de la fiche (le relevé compare à origin/<base>).
    job = async () => {
      const same = await run.sameRepo(pr);
      if (!same.ok) return same;
      const r = await run.loadPr(pr);
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
      const r = await clean() ? await run.switchTo(f.head) : refused(DIRTY);
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
      const r = await clean() ? await run.switchTo(base) : refused(DIRTY);
      if (r.ok) patchVibe(agent.id, { pr: null });
      return r;
    };
  } else if (id === 'new-here' || id === 'new-worktree') {
    const branch = asked?.branch;
    if (!asked || !branch) return fail(lang, 'action');
    // La base du dépôt rapatriée, puis le choix.
    job = async () => {
      const base = await repoBase();
      if (!base) return refused(NO_BASE);
      const f = await run.fetchBranch(base);
      if (!f.ok) return f;
      if (id === 'new-here') {
        // git switch -c <branche> origin/<base> (le dossier propre à cet instant), le dossier en Créer.
        const r = await clean() ? await run.switchTo(branch, `origin/${base}`) : refused(DIRTY);
        if (!r.ok) return r;
        requests.delete(agent.id);
        patchVibe(agent.id, { flow: 'create' });
        firstNotes.set(agent.id, asked.text);
        return r;
      }
      // Le worktree de la branche depuis origin/<base>, l'enfant (la question de confiance), affiché ;
      // pas d'enfant (confiance refusée…) : la demande reste retenue ici.
      const r = await createWorktree(agent, { branch, base, start: `origin/${base}` }, cfg);
      if (!r.ok || !r.dir) return { ok: r.ok, line: r.line, detail: f.detail };
      const child = await openChild(agent, r.dir, { name: branch, create: true });
      if (!child) return refused(`Worktree created (${r.dir}), but no agent opened there: the request stays here.`);
      requests.delete(agent.id);
      firstNotes.set(child.id, asked.text);
      setAgentView(child.id, 'vibecoder');
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
    job = async () => (await clean() ? run.toBase(branch, base) : refused(DIRTY));
  }
  directs.set(agent.id, mine);
  void track(mine, id, job);
  return { ok: true };
}

// Le parcours de l'agent (Créer ou Relire, la PR suivie), changé d'après ses réglages à cet instant.
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

// La vue d'un agent, retenue (VibeCoder, ou null : sa conversation), et le
// panneau ouvert sur lui, agrandi.
export function setAgentView(id: string, view: 'vibecoder' | null) {
  updateAgent(id, { view: view ?? undefined });
  openConversation(id, { mode: 'full' });
}

// Un réglage de l'écran : Créer ou Relire (passer en Relire sans PR suivie : la
// PR ouverte du dernier relevé de Créer suivie, sa fiche pr-<n>.json écrite
// d'après lui, rien de chargé), arrêter Vibe (la bannière : vibeStop,
// la course en cours finit), la PR suivie (pour
// l'agent) ; la langue (tout VibeCoder) ; « Vu » (la note de référence devient
// l'actuelle) ; revenir à la conversation ; modèle, effort et mode comme son
// menu (une valeur hors de ses choix est ignorée) ; arrêter son tour, comme
// Interrompre de son menu ; le robot de la PR dans son worktree (l'afficher,
// ou le proposer à nouveau : jamais un chemin, F-110) ; Mes PR à relire (gh,
// sans agent ; un échec laisse la liste d'avant) ; l'onglet Actions ouvert
// (ses courses vues, controllers/runs) ou fermé — même l'écran déjà quitté.
export function setVibe(patch: unknown) {
  if (!patch || typeof patch !== 'object') return;
  const p = patch as Record<string, unknown>;
  if (p.runsSeen === false) runsTab(null);
  const agent = vibeAgent();
  if (!agent) return;
  const vibe = agentVibe(agent);
  if (p.flow === 'create' || p.flow === 'review') vibe.flow = p.flow;
  if (p.vibe === false) vibeStop(agent);
  if (p.pr === null || prNumber(p.pr)) vibe.pr = p.pr as number | null;
  const was = last.get(agent.id);
  if (p.flow === 'review' && !vibe.pr && was?.flow === 'create' && was.pr?.state === 'OPEN' && prNumber(was.pr.number)) {
    const out = vibeOutDir(agent.id);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `pr-${was.pr.number}.json`), prCardText(was.pr));
    vibe.pr = was.pr.number;
  }
  updateAgent(agent.id, { vibe });
  if (p.lang === 'fr' || p.lang === 'en') saveConfig({ vibeLang: p.lang });
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
  if (p.prs === true && vibe.flow === 'review') {
    githubReader(ghRun(agent.dir, agentPrefix(agent, loadConfig()))).prsToReview().then((list) => {
      if (list) prsFound.set(agent.id, list);
      refreshVibe({ now: true });
    });
  }
  if (p.view === 'conversation') setAgentView(agent.id, null);
  else refreshVibe({ now: true });
}

// ✓, ✗ ou oublier (null), pour le contenu que l'utilisateur a sous les yeux.
export function markVibe(target: unknown, verdict: unknown) {
  const agent = vibeAgent();
  const view = agent && last.get(agent.id);
  if (!agent || !view || typeof target !== 'string' || (verdict !== 'ok' && verdict !== 'ko' && verdict !== null)) return;
  const hash = targetHash(view, target);
  if (!hash) return;
  const store = vibeStore();
  store.marks[agent.id] = setMark(store.marks[agent.id] || {}, target, hash, verdict);
  saveVibeStore(store);
  refreshVibe({ now: true });
}

// Relire : le brouillon de revue de la PR suivie — ajouter une remarque (sa
// cible, sur une ligne de 300 caractères au plus ; le texte du champ, 5 000),
// en changer le texte (mêmes limites) ou en retirer une.
export function draftVibe(op: unknown) {
  const agent = vibeAgent();
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
  const agent = vibeAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view) return;
  await processAction(agent, cfg, op, index, view.processes ?? []);
  refreshVibe({ now: true });
}

// Un fichier ou un commit du relevé, par son id (jamais un chemin, I-37) :
// - un fichier (n, t…, v…, m…, `c<rang>/<i>`) dans l'éditeur, à `line` si
//   elle est donnée : celui du dossier de l'agent (safePath), dans les deux parcours ;
// - `c<rang>` : le diff du commit (git show), écrit dans <sorties>/files/<hash>.diff ;
// - `gh:c<rang>` : la page du commit sur GitHub, dans le navigateur, d'après
//   l'origine du dépôt (githubPage, I-32) ; sans origine GitHub, rien.
export async function openVibeItem(id: unknown, line?: unknown) {
  const cfg = loadConfig();
  const agent = vibeAgent(cfg);
  const view = agent && last.get(agent.id);
  if (!agent || !view || typeof id !== 'string') return;
  const at = Number.isInteger(line) && (line as number) > 0 ? line as number : undefined;
  const open = (file: string | null) => { if (file) findEditor(cfg.editorCommand)?.openFile(file, at); };
  const out = vibeOutDir(agent.id);
  const git = gitReader(gitRun(agent.dir));
  const commit = itemCommit(view, id);
  if (commit?.web) {
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
