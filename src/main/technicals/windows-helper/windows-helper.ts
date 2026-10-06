/** windows-helper — l'assistant Windows (resources/scripts/windows-helper.ps1) :
 *  un PowerShell PERMANENT. Le lancer et compiler ses types coûte ~1 s, qu'on
 *  ne veut payer ni à chaque collage ni au début de chaque dictée (coupure du
 *  micro Discord). Démarré avec l'appli, relancé s'il meurt.
 *  Une commande par ligne, une ligne de réponse, dans l'ordre : paste, copy,
 *  discord-mute, discord-restore, others-mute, others-restore (cf. le script).
 *  Ne connaît pas : ce que font les commandes. Utilisé par : technicals (paste,
 *  selection), app (coupures, cycle de vie). */
import { spawn, type ChildProcess } from 'node:child_process';
import { scriptPath } from 'technicals/paths';

const TIMEOUT_MS = 5000;

let helper: ChildProcess | null = null;
let pending: ((line: string | null) => void)[] = [];

export function start() {
  if (helper) return helper;
  const child = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath('windows-helper.ps1')],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  child.stdout!.on('data', (d) => {
    buf += d;
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line && pending.length) pending.shift()!(line);
    }
  });
  const dead = () => {
    if (helper === child) helper = null;
    for (const p of pending) p(null);
    pending = [];
  };
  child.on('error', dead);
  child.on('close', dead);
  child.stdin!.on('error', () => {});
  helper = child;
  return child;
}

// Réponse du script, ou null (mort, TIMEOUT_MS sans réponse).
export function request(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = start();
    const timer = setTimeout(() => {
      const idx = pending.indexOf(done);
      if (idx >= 0) pending.splice(idx, 1);
      resolve(null);
    }, TIMEOUT_MS);
    function done(line: string | null) { clearTimeout(timer); resolve(line); }
    pending.push(done);
    child.stdin!.write(`${command}\n`);
  });
}

export function stop() {
  if (helper) { try { helper.kill(); } catch { /* déjà mort */ } helper = null; }
}
