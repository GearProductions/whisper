/** run-once — lancer une commande jusqu'au bout et attendre sa fin (une étape
 *  de la recette du projet). Sans shell de notre part (I-27 : l'argv tel quel),
 *  l'entrée fermée (stdin ignoré : un y/N lit une fin de fichier), son
 *  environnement : celui de l'appli, plus `env`, plus GIT_TERMINAL_PROMPT=0.
 *  Sa sortie (stdout, stderr) ajoutée au journal `log`, directement : un
 *  descendant resté en vie n'empêche pas la fin. Au délai, son groupe est tué
 *  (SIGKILL ; sous Windows, taskkill /T /F sur son arbre). Rend son
 *  code de sortie (null : tuée, ou pas lancée) et la dernière ligne utile de
 *  sa sortie, sans couleurs ; ne rejette jamais (pas lancée : la raison).
 *  Ne connaît pas : VibeCoder, le fichier du projet, Electron.
 *  Utilisé par : app/controllers/recipe. */
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readTail } from './process';

export type RunOnce = { argv: string[]; cwd: string; env?: Record<string, string>; log: string; timeoutMs: number };
export type RunResult = { exit: number | null; tail: string };

const TAIL_BYTES = 8192;

// La dernière ligne non vide, sans séquences ANSI ; une ligne réécrite par \r : son dernier état ;
// pas le « exit » qu'un shell interactif (bash -ic, le shell du fichier) écrit en sortant.
// ponytail: même expression que core/runner logTail (technicals ne dépend pas de core) ; à mettre dans helpers si une 3e copie arrive.
const lastLine = (text: string) => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
  .split('\n').map((l) => l.replace(/\r+$/, '').split('\r').at(-1)!.trim()).filter((l) => l && l !== 'exit').at(-1) ?? '';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function runOnce({ argv, cwd, env, log, timeoutMs }: RunOnce): Promise<RunResult> {
  return new Promise((resolve) => {
    let fd: number | null = null;
    let start = 0;
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    let done = false;
    const finish = (exit: number | null, error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error || timedOut) {
        const line = error ?? `délai dépassé (${Math.round(timeoutMs / 1000)} s)`;
        try { fs.appendFileSync(log, `\n${line}\n`); } catch { /* journal impossible */ }
        if (error) { resolve({ exit, tail: line }); return; }
      }
      let size = start;
      try { size = fs.statSync(log).size; } catch { /* pas de journal */ }
      resolve({ exit, tail: lastLine(readTail(log, Math.min(size - start, TAIL_BYTES))) });
    };
    try {
      fs.mkdirSync(path.dirname(log), { recursive: true });
      fd = fs.openSync(log, 'a');
      start = fs.fstatSync(fd).size;
      const child = spawn(argv[0], argv.slice(1), {
        cwd, detached: true, stdio: ['ignore', fd, fd], windowsHide: true,
        env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' },
      });
      fs.closeSync(fd);   // l'enfant a sa copie
      fd = null;
      // ponytail: SIGKILL d'emblée, sans SIGTERM d'abord ; une étape bloquée 15 min n'a rien à ranger.
      timer = setTimeout(() => {
        const pid = child.pid;
        timedOut = true;
        if (!pid) return;
        if (process.platform === 'win32') execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
        else try { process.kill(-pid, 'SIGKILL'); } catch { /* déjà parti */ }
      }, timeoutMs);
      child.on('error', (err) => finish(null, err.message));
      child.on('exit', (code) => finish(code));
    } catch (err) {
      if (fd !== null) try { fs.closeSync(fd); } catch { /* déjà fermé */ }
      finish(null, message(err));
    }
  });
}
