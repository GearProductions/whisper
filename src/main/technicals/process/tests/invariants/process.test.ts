// Invariants des processus que lance l'appli (onglet Processus de VibeCoder).
// Protégés : si un test échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : laisser tourner après la
//   sortie de l'appli ce qu'elle a lancé, ou arrêter un processus qu'elle n'a
//   pas lancé. Arrêter = SIGTERM, SIGKILL après le délai (comme I-19). Et :
//   le fichier du projet n'est écrit que s'il n'existe pas, jamais remplacé.
// Sur du réel : de vrais processus (bash, sleep, setsid), un dossier temporaire.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createProcesses, writeNew } from 'technicals/process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-process-'));
const strays: number[] = [];
afterAll(() => {
  for (const pid of strays) { try { process.kill(pid, 'SIGKILL'); } catch { /* déjà mort */ } }
  fs.rmSync(tmp, { recursive: true, force: true });
});

let n = 0;
const fresh = () => { const dir = path.join(tmp, `cas-${n++}`); fs.mkdirSync(dir); return dir; };
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const until = async (ok: () => boolean, ms = 5000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise((r) => setTimeout(r, 25));
  return ok();
};
// Le pid qu'un script a écrit dans <dir>/<name>, une fois écrit.
async function pidIn(dir: string, name: string) {
  const file = path.join(dir, name);
  await until(() => fs.existsSync(file) && fs.readFileSync(file, 'utf8').endsWith('\n'));
  const pid = Number(fs.readFileSync(file, 'utf8'));
  strays.push(pid);
  return pid;
}
const run = (dir: string, script: string) => ({ argv: ['bash', '-c', script], cwd: dir, log: path.join(dir, 'x.log') });

describe.skipIf(process.platform === 'win32')('arrêter ce que l’appli a lancé, et seulement cela', () => {
  it('arrêter tue le processus lancé et ses enfants', async () => {
    const dir = fresh();
    const procs = createProcesses({ killAfter: 1000 });
    procs.start('a', run(dir, 'sleep 30 & echo $! > enfant; echo $$ > pid; wait'));
    const [pid, child] = [await pidIn(dir, 'pid'), await pidIn(dir, 'enfant')];
    await procs.stop('a');
    expect(await until(() => !alive(pid) && !alive(child))).toBe(true);
  });

  it('un processus que l’appli n’a pas lancé n’est pas arrêté', async () => {
    const dir = fresh();
    const other = spawn('sleep', ['30'], { stdio: 'ignore' });
    strays.push(other.pid!);
    const procs = createProcesses({ killAfter: 1000 });
    procs.start('a', run(dir, 'echo $$ > pid; sleep 30'));
    const pid = await pidIn(dir, 'pid');
    await procs.stopAll();
    expect(await until(() => !alive(pid))).toBe(true);
    expect(alive(other.pid!)).toBe(true);
  });

  it('arrêter un nom que l’appli n’a pas lancé ne fait rien', async () => {
    const dir = fresh();
    const procs = createProcesses({ killAfter: 1000 });
    procs.start('a', run(dir, 'echo $$ > pid; sleep 30'));
    const pid = await pidIn(dir, 'pid');
    await procs.stop('inconnu');
    expect(alive(pid)).toBe(true);
    await procs.stop('a');
  });

  it('quitter arrête tout ce qu’elle a lancé, même un descendant sorti du groupe (setsid)', async () => {
    const dir = fresh();
    const procs = createProcesses({ killAfter: 1000 });
    procs.start('a', run(dir, 'echo $$ > pid; sleep 30'));
    procs.start('b', run(dir, 'setsid bash -c \'echo $$ > echappe; exec sleep 30\' & wait'));
    const [a, escaped] = [await pidIn(dir, 'pid'), await pidIn(dir, 'echappe')];
    await procs.stopAll();
    expect(await until(() => !alive(a) && !alive(escaped))).toBe(true);
  });

  it('un processus qui ignore SIGTERM est tué après le délai', async () => {
    const dir = fresh();
    const procs = createProcesses({ killAfter: 300 });
    procs.start('a', run(dir, 'trap "" TERM; echo $$ > pid; while :; do sleep 0.1; done'));
    const pid = await pidIn(dir, 'pid');
    await procs.stop('a');
    expect(await until(() => !alive(pid), 2000)).toBe(true);
  });

  it('une commande qui tourne n’est pas lancée une deuxième fois', async () => {
    const dir = fresh();
    const procs = createProcesses({ killAfter: 1000 });
    procs.start('a', run(dir, 'echo $$ >> pids; sleep 30'));
    await pidIn(dir, 'pids');
    expect(procs.start('a', run(dir, 'echo $$ >> pids; sleep 30'))).toBe(false);
    await new Promise((r) => setTimeout(r, 300));
    expect(fs.readFileSync(path.join(dir, 'pids'), 'utf8').trim().split('\n')).toHaveLength(1);
    await procs.stopAll();
  });
});

describe('le fichier du projet n’est jamais remplacé', () => {
  it('absent : écrit', () => {
    const file = path.join(fresh(), 'projet.json');
    expect(writeNew(file, '{"commands":[]}')).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('{"commands":[]}');
  });

  it('présent : laissé tel quel', () => {
    const file = path.join(fresh(), 'projet.json');
    fs.writeFileSync(file, 'le mien');
    expect(writeNew(file, '{"commands":[]}')).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('le mien');
  });
});
