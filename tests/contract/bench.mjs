// Le décor du banc de contrat : l'appli réelle lancée par le lancement partagé
// (tests/main-diff/launch.mjs, inchangé : son setup et son env), dans un
// profil temporaire (XDG_CONFIG_HOME et XDG_DATA_HOME, donnés à l'appli et à la
// commande ; le ~/.config et la corbeille de l'utilisateur jamais lus), son
// dépôt d'essai avec un origin local (un dépôt nu : pull, push, fetch, rebase)
// et la branche de la note, le faux gh (bin/gh) en tête du PATH, le faux
// Claude Code (fake-claude.mjs) pour commande des agents.
// startApp(o) → l'appli et son live.json ; cli(args, cwd, door) : la commande
// vibecoder lancée par node, sans shell, jamais en échec ; door 'outside'
// (défaut : le jeton lu dans live.json) ou 'robot' (VIBECODER_PORT et
// VIBECODER_TOKEN de l'environnement) ; asJson : avec --json, la réponse lue.
// setGh(app, state) : l'état que répond le faux gh (GH_STATE_FILE, app.ghState).
// check(command, name, ok, detail) : un cas, ✓ ou ✗ ; il compte la commande
// de la table comme couverte et, sur un refus, le code d'erreur rendu.
// Ne connaît pas : les cas (cases/), le résumé (coverage.mjs), l'état interne
// de l'appli (seuls la commande et sa réponse sont jugés).
// Utilisé par : tests/contract/run.mjs, tests/contract/cases/.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, launch, sleep } from '../main-diff/launch.mjs';

/** @typedef {{ code: number; out: string; err: string; ms: number; json?: any }} Said */
/** @typedef {{ data: string; projet: string; origin: string; ghState: string; dispose(): Promise<void> }} App */

const ROOT = path.resolve(import.meta.dirname, '../..');
const CLI = path.join(ROOT, 'resources/vibecoder/plugin/bin/vibecoder.mjs');
const FAKE_CLAUDE = path.join(import.meta.dirname, 'fake-claude.mjs');
const FAKE_BIN = path.join(import.meta.dirname, 'bin');
const BRANCH = 'feat/0.9.0-essai';

// Ni port ni jeton de robot hérités : la commande est un agent extérieur, sauf par la porte 'robot'.
const { VIBECODER_PORT, VIBECODER_TOKEN, ...base } = process.env;

/** Les applis lancées et pas encore finies : le profil de chacune, pour que cli sache laquelle interroger. */
const live = [];

/** @param {{ name: string; port: number; config?: object }} o @returns {Promise<App>} */
// Les aides de lecture des cas, communes aux familles : la réponse brute (pour le détail d'un échec), un succès,
// un refus de tel code.
export const said = (r) => JSON.stringify([r.code, r.out, r.err]);
export const good = (r) => r.code === 0 && r.json?.ok === true;
export const refused = (r, code) => r.code === 1 && r.json?.ok === false && r.json.error?.code === code;

export async function startApp({ name, port, config = {} }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `whisper-contract-${name}-`));
  const xdgConfig = path.join(profile, 'config');
  const xdgData = path.join(profile, 'data');
  fs.mkdirSync(xdgConfig);
  fs.mkdirSync(xdgData);
  const note = path.join(profile, 'robot.json');
  const ghState = path.join(profile, 'gh-state.json');
  const env = {
    ...base, XDG_CONFIG_HOME: xdgConfig, XDG_DATA_HOME: xdgData, PATH: `${FAKE_BIN}${path.delimiter}${base.PATH ?? ''}`,
    GH_STATE_FILE: ghState, CONTRACT_CLI: CLI, CONTRACT_NOTE: note,
  };
  let origin = '';
  const app = await launch({
    appDir: ROOT, name, port, env,
    config: { agentCommand: `"${process.execPath}" "${FAKE_CLAUDE}"`, outsideAgents: true, ...config },
    // la branche de la note (les actions du parcours sont proposées), puis l'origin local : un dépôt nu, les branches poussées
    setup(projet) {
      git(projet, 'checkout', '-q', '-b', BRANCH);
      fs.mkdirSync(path.join(projet, 'docs/tickets/feat'), { recursive: true });
      fs.writeFileSync(path.join(projet, 'docs/tickets/feat/0.9.0-essai.md'), '# 0.9.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
      git(projet, 'add', '.');
      git(projet, 'commit', '-q', '-m', 'note');
      origin = path.join(path.dirname(projet), 'origin.git');
      fs.mkdirSync(origin);
      git(origin, 'init', '-q', '--bare', '-b', 'main');
      git(projet, 'remote', 'add', 'origin', origin);
      git(projet, 'push', '-q', '-u', 'origin', 'main', 'autre', BRANCH);
    },
  }).catch((e) => { fs.rmSync(profile, { recursive: true, force: true }); throw e; });
  // La commande cherche live.json dans <XDG_CONFIG_HOME>/whisper-dictation : le profil de l'appli.
  fs.symlinkSync(app.data, path.join(xdgConfig, 'whisper-dictation'));
  const dispose = async () => {
    live.splice(0, live.length, ...live.filter((a) => a !== entry));
    await app.dispose();
    fs.rmSync(profile, { recursive: true, force: true });
  };
  const entry = { data: app.data, projet: app.projet, origin, ghState, dispose, env: { ...base, XDG_CONFIG_HOME: xdgConfig, XDG_DATA_HOME: xdgData }, note };
  live.push(entry);
  const file = path.join(app.data, 'live.json');
  for (let i = 0; i < 60 && !fs.existsSync(file); i++) await sleep(500);
  if (!fs.existsSync(file)) { await dispose(); throw new Error(`${name} : pas de live.json après 30 s`); }
  return entry;
}

/** L'état que répond le faux gh (bin/gh) : { state: OPEN | MERGED | CLOSED, author, assignees[] }, tout facultatif ; remplace le précédent. */
export function setGh(app, state) {
  fs.writeFileSync(app.ghState, JSON.stringify(state));
}

const failedSaid = (err) => ({ code: -1, out: '', err, ms: 0 });

// La note du faux claude (son premier tour) : la porte du robot, son port et son jeton ; attendue quelques secondes.
async function robotEnv(note) {
  for (let i = 0; i < 40; i++) {
    try { const n = JSON.parse(fs.readFileSync(note, 'utf8')); return { VIBECODER_PORT: String(n.port), VIBECODER_TOKEN: n.token }; } catch { await sleep(250); }
  }
  return null;
}

/** @param {string[]} args @param {string} cwd @param {'outside' | 'robot'} [door] @returns {Promise<Said>} */
export async function cli(args, cwd, door = 'outside') {
  // l'appli dont le dossier contient cwd, sinon la dernière lancée
  const app = live.find((a) => cwd.startsWith(a.data + path.sep)) ?? live.at(-1);
  if (!app) return failedSaid('bench : aucune appli lancée');
  let env = app.env;
  if (door === 'robot') {
    const robot = await robotEnv(app.note);
    if (!robot) return failedSaid('bench : le faux claude n\'a pas écrit CONTRACT_NOTE (aucune porte de robot)');
    env = { ...env, ...robot };
  }
  const t = Date.now();
  return new Promise((done) => {
    execFile(process.execPath, [CLI, ...args], { cwd, env, timeout: 30000, maxBuffer: 1 << 24 }, (error, out, err) =>
      done({ code: !error ? 0 : typeof error.code === 'number' ? error.code : -1, out: out.trim(), err: err.trim() || (typeof error?.code === 'number' ? '' : error?.message ?? ''), ms: Date.now() - t }));
  });
}

/** @param {string[]} args @param {string} cwd @param {'outside' | 'robot'} [door] @returns {Promise<Said>} */
export async function asJson(args, cwd, door = 'outside') {
  const r = await cli(['--json', ...args], cwd, door);
  try { return { ...r, json: JSON.parse(r.out) }; } catch { return r; }
}

const covered = new Map();
const codes = new Set();
let failed = 0;
let group = '';

/** @param {string | null} command la commande de la table, ou null : un cas de la CLI seule, qui ne couvre rien @param {string} name @param {boolean} ok @param {string} [detail] @param {string | null} [code] le code d'erreur de la table que le cas attend rendu */
export function check(command, name, ok, detail = '', code = null) {
  const label = command || '(CLI)';
  if (label !== group) { group = label; console.log(`\n${label}`); }
  if (command) covered.set(command, (covered.get(command) ?? 0) + 1);
  if (ok && code) codes.add(code);
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${String(detail).slice(0, 400)}`}`);
}

/** Ce que les cas ont couvert : les commandes (nombre de cas chacune), les codes d'erreur rendus, les cas en échec. */
/** @returns {{ covered: Map<string, number>; codes: Set<string>; failed: number }} */
export function tally() {
  return { covered, codes, failed };
}
