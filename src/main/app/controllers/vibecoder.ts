/** vibecoder — l'écran VibeCoder de l'agent affiché. Son relevé (le dépôt par
 *  git en lecture, la note, les tests de la branche, les sorties des skills,
 *  les validations → le parcours, core/vibecoder) part au panneau (`conv:vibe`)
 *  à chaque conversation envoyée (refreshConversation), toutes les 4 s tant
 *  que le panneau est visible, aussitôt après une action, une validation, un
 *  réglage — au plus un par seconde ; null, une fois, quand l'agent affiché
 *  n'est plus en VibeCoder ; chaque relevé passe les demandes de l'orchestrateur
 *  (runRequests de controllers/runs). Et ce que l'écran demande : une action (celle d'une
 *  étape court à part, ownRun → startRun de controllers/runs, sous sa propre
 *  entrée du runtime, si aucune course en cours ne la retient ; une action sans
 *  étape est un message à l'agent affiché, comme s'il était tapé, par
 *  sendToAgent : refusé s'il travaille, I-25 ; ou, pour commit, publish, load-pr
 *  et base, au clic de « direct » : leurs commandes, lancées par l'appli,
 *  F-114), une course (vibeRunOp : l'arrêter, la garder ou l'annuler, répondre
 *  à sa demande d'autorisation), un réglage (dont arrêter l'agent, comme Interrompre de son
 *  menu ; l'onglet Actions ouvert ou fermé : ses courses vues, runsTab de controllers/runs),
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
 *  (runModule → startRun). Ce qu'il écrit pour l'ouvrir (un fichier de la PR, le diff d'un
 *  commit) va sous <sorties>/files/, en lecture seule. Le message d'une
 *  action : son gabarit, rempli par buildMessage (I-38), avec le préfixe des
 *  commandes vu de l'agent qui le reçoit ({{prefix}} : processes.promptPrefix). git en lecture seule
 *  (technicals/git, I-39), sauf les actions directes (technicals/direct) ; gh aussi, sans agent (technicals/github, derrière
 *  le préfixe de l'agent : processes.agentPrefix) : Créer, la PR de la
 *  branche ; Relire, l'état de la PR chargée (60 s en cache, demandés en
 *  fond : le relevé ne les attend pas ; ↻ les redemande) et Mes PR à relire
 *  (setVibe({ prs })). Créer : les sorties
 *  suivent la branche (followBranch). Relire dans un worktree : le robot
 *  temporaire (controllers/worktrees), Décharger part à l'agent du dépôt.
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
import { agentVibe, vibeLang, type Config } from 'core/config';
import { githubPage } from 'core/repo';
import {
  addComment, blobSha, buildMessage, DIRECT_ACTIONS, draftText, editComment, findNote, forkedModel, isOutputName, isTest, itemCommit, itemPath,
  blockedBy, json, noteKey, ownRun, parseNote, prNumber, removeComment, runModule, runViews, safePath, setMark, vibeView, whoOf, type ActionDef, type MessageError,
} from 'core/vibecoder';
import { findEditor } from 'technicals/editor';
import { directRunner, VERDICTS, type DirectResult } from 'technicals/direct';
import { gitReader, gitRun, okRef } from 'technicals/git';
import { ghRun, githubReader } from 'technicals/github';
import { which } from 'technicals/paths';
import { loadConfig, saveConfig, saveVibeStore, updateAgent, vibeActions, vibeOutDir, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { conversationShown, openConversation } from 'app/windows';
import { interruptAgent, isBusy, liveViewAgent, sendToAgent, setAgentSetting } from './agents';
import { agentPrefix, processAction, processView, promptPrefix, readFile, readTimed } from './processes';
import { lockingRuns, runOp, viewLocks, runPending, runRequests, runsOf, runsTab, skillMd, startRun } from './runs';
import { showWorktree, syncWorktrees, wantWorktree, worktreeParent, worktreeState } from './worktrees';

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
    model: 'Ce modèle ne peut pas être choisi pour cette action.',
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
    model: 'This model cannot be chosen for this action.',
    noGit: 'git not found: the journey cannot be read. The conversation still works.',
    notRepo: 'This folder is not a git repository: the journey cannot be read. The conversation still works.',
  },
};

const last = new Map<string, VibeView>();  // le dernier relevé envoyé, par agent : ce que la page désigne
const turnNote = new Map<string, { text: string; busy: boolean }>();  // la note au début du tour (surlignage)
const showCache = new Map<string, Promise<string | null>>();  // Relire : un fichier à un commit donné ne change pas
const ghCache = new Map<string, { at: number; value: unknown; pending: boolean }>();  // par question à gh
const directs = new Map<string, Record<string, NonNullable<VibeAction['direct']>>>();  // par agent : ses actions directes (F-114)
const prsFound = new Map<string, unknown[]>();   // Relire : Mes PR à relire, par agent (la dernière réponse de gh)
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
const BRANCH_OUTPUTS = ['questions.md', 'align.md', 'review.md', 'commit.md', 'checks.json', 'ponytail.md', 'pr.json', 'ci.md'];

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

async function survey(agent: AgentConfig, cfg: Config): Promise<VibeView> {
  const lang = vibeLang(cfg);
  const { flow, autonomy, pr } = agentVibe(agent);
  const realpath = fs.realpathSync.native;
  const git = gitReader(gitRun(agent.dir));
  // Créer : la copie de travail. Relire : la PR suivie, à sa référence locale
  // (posée par le skill charger-pr), comparée à la base de sa fiche, sous le
  // nom de sa branche.
  const ref = flow === 'review' && pr ? `refs/vibecoder/pr/${pr}` : null;
  const created = flow === 'create' ? await git.facts() : null;
  const out = vibeOutDir(agent.id);
  if (created) followBranch(out, created.branch, created.base);
  const outputs = readOutputs(out);
  const card = ref ? json(outputs[`pr-${pr}.json`]?.text) : null;
  const base = branchName(card?.base);
  const facts = flow === 'create' ? created : ref ? await git.facts(ref, base ? `origin/${base}` : undefined) : null;
  // gh, sans agent : Créer, la PR de la branche (pas sur la base) ; Relire, l'état de la PR chargée.
  const gh = githubReader(ghRun(agent.dir, agentPrefix(agent, cfg)));
  const feature = created && created.branch !== 'HEAD' && created.base !== created.branch && !created.base.endsWith(`/${created.branch}`)
    ? created.branch : null;
  const github = {
    pr: feature ? fromGh(`pr ${agent.dir} ${feature}`, () => gh.prForBranch(feature)) : null,
    state: card && pr ? fromGh(`state ${agent.dir} ${pr}`, () => gh.prState(pr)) : null,
    prs: flow === 'review' ? prsFound.get(agent.id) ?? null : null,
  };
  // Relire : lu une fois par commit de tête de la PR (git show coûte un processus).
  const read = (rel: string) => {
    if (!ref || !facts) return Promise.resolve(onDisk(agent.dir, rel));
    const key = `${agent.dir}:${facts.head}:${rel}`;
    if (!showCache.has(key)) {
      if (showCache.size > 500) showCache.clear();
      const text = git.show(ref, rel);
      showCache.set(key, text);
      text.then((t) => { if (t === null) showCache.delete(key); });   // un échec se retente
    }
    return showCache.get(key)!;
  };
  const repo = facts && { branch: branchName(card?.head) ?? facts.branch, base: facts.base, changed: facts.changed, commits: facts.commits };
  // La note du ticket : sa clé d'après la branche (ticket, sinon version), parmi
  // les .md de docs/tickets/ que change la branche (ou la PR).
  const key = repo && noteKey(repo.branch, null);
  const notePath = repo && key ? findNote(repo.changed, key) : null;
  const noteText = notePath ? await read(notePath) : null;
  // Les tests de la branche, et leur empreinte, qui nomme leur lecture.
  const tests = (await Promise.all((repo?.changed ?? []).filter(isTest).map(async (p) => {
    const text = await read(p);
    return text === null ? [] : [{ path: p, blob: blobSha(text), text }];
  }))).flat();
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
  const journey = vibeView({
    agentId: agent.id, lang, flow, pr, autonomy,
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
    // en création : la conversation travaille, ou la course d'Ouvrir dans un worktree
    worktree: worktreeState(agent, flow === 'review' ? pr : null, busy || running.some((r) => r.id === 'open-worktree')),
    github,
    actions,
    direct: directs.get(agent.id),
    who,
    model: Object.fromEntries(actions.map((a) => [a.id, forkedModel(skills[a.id])])),
    skills: skillNames(agent.dir),
    exists: (rel) => { const file = safePath(agent.dir, rel, realpath); return !!file && fs.existsSync(file); },
    list: flow === 'create' ? (rel) => listFiles(agent.dir, rel) : undefined,   // Relire : le disque n'est pas la PR
    now: Date.now(),
  });
  // Processus : les commandes du projet, leur état (controllers/processes).
  return { ...journey, ...processView(agent, cfg) };
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
  if (sent.ok) refreshVibe({ now: true });
  return { ok: sent.ok, error: sent.error };
}

// Une action envoyée, au clic comme à la demande de l'orchestrateur (runs : runRequests) : grisée au
// relevé pour une autre raison qu'une course, refusée (une course, startRun la revoit sur l'état vivant :
// le relevé peut avoir un temps de retard) ; son gabarit rempli (I-38) ; une action d'étape court à
// part, les autres vont à la conversation. invalid : ses arguments ne vont pas, rien à retenter.
export function startAction(agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config): SendResult & { invalid?: true } {
  const lang = vibeLang(cfg);
  const shown = view.actions.find((a) => a.id === def.id);
  const held = ownRun(def) ? blockedBy(def, viewLocks(view, vibeActions(lang)), lang) : null;
  if (shown?.disabled && shown.disabled !== held) return { ok: false, error: shown.disabled };
  // Décharger, sur le robot d'un worktree : le message part à l'agent du dépôt (le worktree est à lui), avec ses sorties (F-110).
  const target = def.id === 'unload-worktree' ? worktreeParent(agent) : agent;
  if (!target) return { ...fail(lang, 'agent'), invalid: true };
  const message = buildMessage(def, args, { view, out: vibeOutDir(target.id), lang, prefix: promptPrefix(target, cfg) });
  if ('error' in message) return { ...fail(lang, message.error), invalid: true };
  const sent = ownRun(def) ? startRun(target, def, message.text, cfg, runModule(def.id, args, view.modules)) : sendToAgent(target, { text: message.text, images: [] }, cfg);
  if (sent.ok && def.id === 'open-worktree' && view.pr) wantWorktree(agent.id, view.pr.number);
  return sent;
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
// commandes (technicals/direct), sans agent, avec des valeurs du dernier relevé
// (la branche, la base de sa PR, la PR suivie, le brouillon) ou vérifiées (un
// numéro de PR entier, un verdict des trois). En fond, une à la fois par agent :
// « en cours » puis son résultat partent au relevé.
function runDirect(agent: AgentConfig, def: ActionDef, args: VibeArgs, view: VibeView, cfg: Config): SendResult {
  const { id } = def;
  const lang = vibeLang(cfg);
  const mine = directs.get(agent.id) ?? {};
  if (Object.values(mine).some((x) => x.running)) return fail(lang, 'action');
  // Une course vivante la retient comme une autre course (la règle de runs).
  const held = blockedBy(def, lockingRuns(agent.id), lang);
  if (held) return { ok: false, error: held };
  const run = directRunner({ dir: agent.dir, out: vibeOutDir(agent.id), prefix: agentPrefix(agent, cfg) });
  const n = prNumber(view.pr?.number);
  let job: Promise<DirectResult>;
  if (id === 'commit') job = run.commit();
  else if (id === 'load-pr') {
    const asked = args.pr === undefined ? n : prNumber(args.pr);
    if (!asked) return fail(lang, 'pr');
    job = run.loadPr(asked);
  } else if (id === 'publish') {
    if (!n) return fail(lang, 'pr');
    if (!(VERDICTS as readonly unknown[]).includes(args.verdict)) return fail(lang, 'verdict');
    if (!view.draft.length) return fail(lang, 'draft');
    job = run.publish(n, args.verdict, draftText(view.draft), view.pr?.url ?? '');
  } else {
    const branch = view.repo?.branch;
    const base = view.pr?.base || view.repo?.base.replace(/^origin\//, '');
    if (!branch || !base) return fail(lang, 'repo');
    job = run.toBase(branch, base);
  }
  mine[id] = { running: true, last: mine[id]?.last ?? null };
  directs.set(agent.id, mine);
  job.catch((err): DirectResult => ({ ok: false, line: err instanceof Error ? err.message : String(err), detail: '' })).then((r) => {
    mine[id] = { running: false, last: { ...r, time: Date.now() } };
    refreshVibe({ now: true });
  });
  refreshVibe({ now: true });
  return { ok: true };
}

// La vue d'un agent, retenue (VibeCoder, ou null : sa conversation), et le
// panneau ouvert sur lui, agrandi.
export function setAgentView(id: string, view: 'vibecoder' | null) {
  updateAgent(id, { view: view ?? undefined });
  openConversation(id, { mode: 'full' });
}

// Un réglage de l'écran : Créer ou Relire, Guide ou Vibe, la PR suivie (pour
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
  if (p.autonomy === 'guide' || p.autonomy === 'vibe') vibe.autonomy = p.autonomy;
  if (p.pr === null || prNumber(p.pr)) vibe.pr = p.pr as number | null;
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

// L'empreinte du contenu d'une cible dans le relevé : la note (son texte), la
// forme (sa rubrique), « rien à écrire » de l'étape Invariants (Créer : le texte de la note), un cas de test (le fichier), une case du plan de test
// (le plan), une case du § A.3 à cocher à la main (le commit de tête de la
// branche) ; null si la cible n'y est pas.
function targetHash(view: VibeView, target: string) {
  const { note } = view;
  const a3 = /^a3:(\d+)$/.exec(target);
  if (a3) return view.flow === 'create' && view.checklist[Number(a3[1])]?.manual ? view.commits.at(-1)?.hash ?? null : null;
  if (target === 'nothing' && view.flow !== 'create') return null;
  if (target === 'note' || target === 'nothing' || target === 'forme') return note && blobSha(target === 'forme' ? parseNote(note.text).forme : note.text);
  const file = view.invariants.find((f) => target.startsWith(`case:${f.path}:`) && f.cases.includes(target.slice(`case:${f.path}:`.length)));
  if (file) return file.blob;
  const check = /^check:(\d+):(\d+)$/.exec(target);
  const plan = check && view.pr?.number === Number(check[1]) && Number(check[2]) < view.checklist.length
    ? view.outputs[`pr-${check[1]}-ecran.md`] : undefined;
  return plan ? blobSha(plan.text) : null;
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

// Un fichier écrit pour être ouvert (un fichier de la PR, le diff d'un
// commit) : <sorties>/<rel>, en lecture seule, remplacé s'il existe ; son
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
//   elle est donnée ; Créer : la copie de travail ; Relire : sa version à la
//   tête de la PR (git show), écrite dans <sorties>/files/pr-<n>/<chemin> ;
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
    const n = prNumber(view.pr?.number);
    if (!rel) return;
    if (view.flow === 'create') return open(safePath(agent.dir, rel, fs.realpathSync.native));
    if (!n) return;
    const ref = `refs/vibecoder/pr/${n}`;
    const text = await git.show(ref, rel);
    // ponytail: un dossier (le fichier d'un module) rend sa liste (« tree <ref>:<chemin> ») : pas ouvert.
    open(text === null || text.startsWith(`tree ${ref}:`) ? null : writeForEditor(out, path.join('files', `pr-${n}`, rel), text));
  }
}
