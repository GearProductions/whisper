// Variants des processus lancés (note 0.8.0, « Lancer le projet ») : le
// journal, sa rotation, l'état d'une commande finie ou qui échoue.
// Sur du réel : de vrais processus (bash), un dossier temporaire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createProcesses, readTail } from 'technicals/process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-process-v-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = () => { const dir = path.join(tmp, `cas-${n++}`); fs.mkdirSync(dir); return dir; };
const until = async (ok: () => boolean, ms = 5000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise((r) => setTimeout(r, 25));
  return ok();
};
const sh = (dir: string, script: string) => ({ argv: ['bash', '-c', script], cwd: dir, log: path.join(dir, 'run', 'x.log') });

describe.skipIf(process.platform === 'win32')('une commande lancée', () => {
  it('sa sortie et ses erreurs dans son journal ; finie sans erreur : arrêtée, code 0', async () => {
    const dir = fresh();
    const procs = createProcesses();
    procs.start('a', sh(dir, 'echo erreur >&2; sleep 0.1; echo sortie; pwd'));
    expect(procs.state('a')?.status).toBe('running');
    await until(() => procs.state('a')?.status !== 'running');
    expect(procs.state('a')).toMatchObject({ status: 'stopped', exit: 0 });
    await until(() => readTail(path.join(dir, 'run', 'x.log'), 1000).includes(dir));
    expect(readTail(path.join(dir, 'run', 'x.log'), 1000)).toBe(`erreur\nsortie\n${fs.realpathSync(dir)}\n`);
  });

  it('finie sur une erreur : en échec, son code', async () => {
    const procs = createProcesses();
    procs.start('a', sh(fresh(), 'exit 3'));
    await until(() => procs.state('a')?.status !== 'running');
    expect(procs.state('a')).toMatchObject({ status: 'failed', exit: 3 });
  });

  it('arrêtée par l’appli : arrêtée, pas en échec', async () => {
    const procs = createProcesses();
    procs.start('a', sh(fresh(), 'sleep 30'));
    await procs.stop('a');
    await until(() => procs.state('a')?.status !== 'running');
    expect(procs.state('a')?.status).toBe('stopped');
    expect(procs.running()).toBe(false);
  });

  it('un dossier qui n’existe pas : en échec, la raison dans le journal', async () => {
    const dir = fresh();
    const procs = createProcesses();
    procs.start('a', { ...sh(dir, 'true'), cwd: path.join(dir, 'absent') });
    await until(() => procs.state('a')?.status !== 'running');
    expect(procs.state('a')?.status).toBe('failed');
    expect(readTail(path.join(dir, 'run', 'x.log'), 1000)).toMatch(/ENOENT/);
  });

  it('relancée : le journal précédent en .old', async () => {
    const dir = fresh();
    const procs = createProcesses();
    procs.start('a', sh(dir, 'echo un'));
    await until(() => procs.state('a')?.status !== 'running');
    procs.start('a', sh(dir, 'echo deux'));
    await until(() => procs.state('a')?.status !== 'running');
    await until(() => readTail(path.join(dir, 'run', 'x.log'), 100) === 'deux\n');
    expect(readTail(path.join(dir, 'run', 'x.log.old'), 100)).toBe('un\n');
  });

  it('au-delà de la taille maximale : le journal repart, l’ancien en .old', async () => {
    const dir = fresh();
    const procs = createProcesses({ logMax: 1000 });
    procs.start('a', sh(dir, 'for i in $(seq 1 300); do echo ligne $i; done'));
    await until(() => procs.state('a')?.status !== 'running');
    await new Promise((r) => setTimeout(r, 100));
    const log = readTail(path.join(dir, 'run', 'x.log'), 10000);
    expect(log.length).toBeLessThanOrEqual(1000);
    expect(log).toMatch(/ligne 300\n$/);
    // l'ancien journal garde le début
    expect(fs.statSync(path.join(dir, 'run', 'x.log.old')).size).toBeGreaterThan(0);
  });
});

it('un seul morceau plus gros que la limite : le journal en garde la fin', async () => {
  const dir = fresh();
  const procs = createProcesses({ logMax: 100 });
  procs.start('a', sh(dir, 'printf "%0300d" 0; echo FIN'));
  await until(() => procs.state('a')?.status !== 'running');
  await new Promise((r) => setTimeout(r, 100));
  const log = readTail(path.join(dir, 'run', 'x.log'), 10000);
  // le journal reste dans la limite
  expect(log.length).toBeLessThanOrEqual(100);
  // et finit par la dernière sortie
  expect(log).toMatch(/FIN\n$/);
});

it('la fin d’un fichier : ses derniers octets ; absent : rien', () => {
  const file = path.join(fresh(), 'f.log');
  fs.writeFileSync(file, 'abcdef');
  expect(readTail(file, 3)).toBe('def');
  expect(readTail(file, 100)).toBe('abcdef');
  expect(readTail(path.join(tmp, 'absent'), 3)).toBe('');
});
