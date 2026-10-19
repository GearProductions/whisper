/** process — les processus que l'appli lance pour l'utilisateur (les
 *  commandes du projet, onglet Processus de VibeCoder), chacun sous une clé.
 *  Lancé détaché (son propre groupe), sans shell de notre part (I-27 :
 *  l'argv tel quel, le shell éventuel est dans l'argv), marqué dans son
 *  environnement (VIBECODER_RUN=<jeton>, que ses descendants héritent, même
 *  sortis du groupe ou passés dans une box : distrobox transmet
 *  l'environnement). Arrêter : SIGTERM au groupe et à chaque processus de CE
 *  jeton, SIGKILL après le délai (5 s, comme I-19) ; rien d'autre n'est
 *  touché. Une commande finie de lui-même : ce qu'elle laisse est arrêté
 *  aussi. Sa sortie (stdout, stderr) va dans son journal, mis en .old au
 *  lancement suivant et au-delà de 5 Mo. Sous Windows, taskkill /T /F.
 *  Et writeNew : écrire un fichier seulement s'il n'existe pas.
 *  Ne connaît pas : VibeCoder, le fichier du projet, Electron.
 *  Utilisé par : app/controllers/processes. */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type Launch = { argv: string[]; cwd: string; log: string };
export type ProcState = {
  status: 'running' | 'stopped' | 'failed';
  since: number;               // lancé à, ou fini à
  exit: number | null;         // code de sortie (null : tué par un signal, ou en cours)
};
type Rec = ProcState & { child: ChildProcess | null; token: string; stopping: boolean };

const MARK = 'VIBECODER_RUN';

// Les processus marqués de ce jeton (Linux : /proc/<pid>/environ) ; ailleurs, aucun.
function marked(token: string): number[] {
  if (process.platform !== 'linux') return [];
  const needle = `\0${MARK}=${token}\0`;
  let pids: string[] = [];
  try { pids = fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)); } catch { return []; }
  return pids.flatMap((pid) => {
    try { return `\0${fs.readFileSync(`/proc/${pid}/environ`, 'latin1')}`.includes(needle) ? [Number(pid)] : []; }
    catch { return []; }
  });
}

const kill = (pid: number, sig: NodeJS.Signals) => { try { process.kill(pid, sig); return true; } catch { return false; } };

export function createProcesses({ killAfter = 5000, logMax = 5 * 1024 * 1024 } = {}) {
  const recs = new Map<string, Rec>();

  // Envoie `sig` à tout ce que porte ce jeton ; vrai s'il restait quelqu'un.
  function signal(rec: Rec, sig: NodeJS.Signals) {
    const pid = rec.child?.pid;
    if (process.platform === 'win32') {
      if (pid && rec.child!.exitCode === null) execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
      return rec.child?.exitCode === null;
    }
    const group = pid && rec.child!.exitCode === null && rec.child!.signalCode === null ? kill(-pid, sig) : false;
    return marked(rec.token).map((p) => kill(p, sig)).some(Boolean) || group;
  }

  // Lance `key` ; faux s'il tourne déjà (rien n'est lancé).
  function start(key: string, { argv, cwd, log }: Launch) {
    if (recs.get(key)?.status === 'running') return false;
    fs.mkdirSync(path.dirname(log), { recursive: true });
    try { fs.renameSync(log, `${log}.old`); } catch { /* pas encore de journal */ }
    let fd: number | null = fs.openSync(log, 'w');
    let size = 0;
    const write = (text: string | Buffer) => {
      if (fd === null) return;
      let data = typeof text === 'string' ? Buffer.from(text) : text;
      // Plein : le journal passe en .old AVANT d'écrire la suite, pour que les
      // dernières lignes restent à l'écran ; un morceau plus gros que la limite
      // y laisse son début, le journal n'en garde que la fin.
      if (size + data.length > logMax && (size > 0 || data.length > logMax)) {
        if (data.length > logMax) { fs.writeSync(fd, data.subarray(0, data.length - logMax)); data = data.subarray(data.length - logMax); }
        fs.closeSync(fd);
        fs.renameSync(log, `${log}.old`);
        fd = fs.openSync(log, 'w');
        size = 0;
      }
      fs.writeSync(fd, data);
      size += data.length;
    };
    const close = () => { if (fd !== null) fs.closeSync(fd); fd = null; };
    const rec: Rec = { status: 'running', since: Date.now(), exit: null, child: null, token: randomUUID(), stopping: false };
    recs.set(key, rec);
    const end = (status: ProcState['status'], exit: number | null) => {
      if (rec.status !== 'running') return;
      Object.assign(rec, { status: rec.stopping ? 'stopped' : status, exit, since: Date.now() });
      if (!rec.stopping) signal(rec, 'SIGTERM');   // ce qu'elle laisse derrière elle
    };
    try {
      const child = spawn(argv[0], argv.slice(1), {
        cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, [MARK]: rec.token },
      });
      rec.child = child;
      child.stdout!.on('data', write);
      child.stderr!.on('data', write);
      child.on('error', (err) => { write(`\n${err.message}\n`); close(); end('failed', null); });
      child.on('exit', (code) => end(code === 0 ? 'stopped' : 'failed', code));
      child.on('close', close);
    } catch (err) {
      write(`${err instanceof Error ? err.message : err}\n`);
      close();
      end('failed', null);
    }
    return true;
  }

  // Arrête `key` (et ce qu'il a lancé) : SIGTERM, puis SIGKILL après le délai.
  // Une clé inconnue : rien.
  async function stop(key: string) {
    const rec = recs.get(key);
    if (!rec) return;
    rec.stopping = rec.status === 'running';
    if (!signal(rec, 'SIGTERM')) return;
    for (const end = Date.now() + killAfter; Date.now() < end;) {
      await new Promise((r) => setTimeout(r, 100));
      if (rec.status !== 'running' && !marked(rec.token).length) return;
    }
    signal(rec, 'SIGKILL');
  }

  return {
    start,
    stop,
    stopAll: async () => { await Promise.all([...recs.keys()].map(stop)); },
    state: (key: string): ProcState | null => {
      const rec = recs.get(key);
      return rec ? { status: rec.status, since: rec.since, exit: rec.exit } : null;
    },
    keys: () => [...recs.keys()],
    running: () => [...recs.values()].some((r) => r.status === 'running'),
  };
}

// Les `bytes` derniers octets d'un fichier ('' s'il manque).
export function readTail(file: string, bytes: number) {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const buf = Buffer.alloc(Math.min(size, bytes));
    fs.readSync(fd, buf, 0, buf.length, size - buf.length);
    return buf.toString('utf8');
  } catch { return ''; } finally { if (fd !== null) fs.closeSync(fd); }
}

// Écrit `text` dans `file` seulement s'il n'existe pas (jamais par-dessus) ; vrai si écrit.
export function writeNew(file: string, text: string) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, { flag: 'wx' });
    return true;
  } catch { return false; }
}
