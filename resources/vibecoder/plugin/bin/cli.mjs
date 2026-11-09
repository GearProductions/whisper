// cli — le pur de la commande vibecoder, en JS lancé par node sans
// construction (aucun import de src/) : où est live.json, ce qu'il porte, à qui
// se connecter (l'environnement d'un robot d'abord, et alors live.json jamais
// lu ; sinon live.json et son jeton extérieur), la ligne de commande lue, la
// réponse rendue et son code de sortie (0 : ok, en attente compris ; 1 : un
// refus ; usage : 2).
// Ne connaît pas : le réseau, le disque (les textes lui sont donnés), la table.
// Utilisé par : plugin/bin/vibecoder.mjs ; ses tests (tests/cli/,
// tests/invariants/cli-robot-env.test.ts).

import path from 'node:path';

const isPort = (n) => Number.isInteger(n) && n > 0 && n < 65536;

// livePath(env, platform: string, home: string) → string
export const livePath = (env, platform, home) => {
  const win = platform === 'win32';
  const dir = win ? (env.APPDATA || path.win32.join(home, 'AppData', 'Roaming')) : (env.XDG_CONFIG_HOME || path.posix.join(home, '.config'));
  return (win ? path.win32 : path.posix).join(dir, 'whisper-dictation', 'live.json');
};

// readLive(text: string | null) → { port: number ; token?: string } | null
export const readLive = (text) => {
  let v;
  try { v = JSON.parse(text ?? ''); } catch { return null; }
  if (!v || !isPort(v.port)) return null;
  return typeof v.token === 'string' && v.token ? { port: v.port, token: v.token } : { port: v.port };
};

// callFrom(env, readLiveFile: () => string | null) → { port ; token } | { error: string }
// Un robot a les deux dans son environnement : live.json n'est alors jamais lu (un programme qui
// y réécrirait le port recevrait son jeton). Un jeton sans port ne part jamais vers live.json.
export const callFrom = (env, readLiveFile) => {
  if (env.VIBECODER_PORT && env.VIBECODER_TOKEN) {
    const port = Number(env.VIBECODER_PORT);
    return isPort(port) ? { port, token: env.VIBECODER_TOKEN } : { error: 'VIBECODER_PORT is not a port number.' };
  }
  const live = readLive(readLiveFile());
  if (!live) return { error: 'VibeCoder is not running (no live.json, or unreadable).' };
  if (!live.token) return { error: 'Outside agents are off: turn on « Autoriser les agents extérieurs » in VibeCoder\'s settings.' };
  return { port: live.port, token: live.token };
};

const USAGE = `usage: vibecoder [--json] <command>
  status | next
  run start <action> [key=value…] | run stop <action> | run wait <action> | run list
  proc list | proc restart <name> | proc stop <name> | proc logs <name>
  <command> [key=value…]   (a value starting with { or [ is JSON)
  commands | schema <command>        (read from the table, the app not needed)`;

// run et proc : sous-commande → [commande de la table, clé de son argument, argument obligatoire]
const SHORT = {
  'run start': ['run.start', 'action'], 'run stop': ['run.stop', 'action'], 'run wait': ['run.wait', 'action'],
  'run list': ['runs'], 'proc list': ['procs'],
  'proc restart': ['proc.restart', 'name'], 'proc stop': ['proc.stop', 'name'], 'proc logs': ['logs', 'name'],
};

// parseCommandLine(argv: string[]) → { cmd ; args ; json } | { local ; name? ; json } | { usage }
export const parseCommandLine = (argv) => {
  const json = argv.includes('--json');
  const words = argv.filter((a) => a !== '--json');
  const usage = { usage: USAGE };
  const [first, second] = words;
  if (first === undefined) return usage;
  if (first === 'commands') return words.length === 1 ? { local: 'commands', json } : usage;
  if (first === 'schema') return words.length === 2 ? { local: 'schema', name: second, json } : usage;

  let cmd = first;
  let rest = words.slice(1);
  const args = {};
  if (first === 'run' || first === 'proc') {
    const [name, key] = SHORT[`${first} ${second}`] ?? [];
    if (!name) return usage;
    cmd = name;
    rest = words.slice(2);
    if (key) {
      if (rest[0] === undefined || rest[0].includes('=')) return usage;
      args[key] = rest.shift();
    }
  }
  for (const word of rest) {
    const at = word.indexOf('=');
    if (at < 1) return usage;
    let value = word.slice(at + 1);
    if (value[0] === '{' || value[0] === '[') {
      try { value = JSON.parse(value); } catch { return usage; }
    }
    args[word.slice(0, at)] = value;
  }
  return { cmd, args, json };
};

// render(answer, json: boolean) → string
export const render = (answer, json) => {
  if (json) return JSON.stringify(answer);
  if (!answer.ok) return `${answer.error.code}: ${answer.error.message}\n${answer.error.todo}`;
  const r = answer.result;
  if (r?.queued) return `Queued: the request waits for "${r.by}" to finish, the app starts it by itself.`;
  return r === null || r === undefined ? 'ok' : typeof r === 'string' ? r : JSON.stringify(r, null, 2);
};

// exitCode(answer) → 0 | 1
export const exitCode = (answer) => (answer.ok ? 0 : 1);
