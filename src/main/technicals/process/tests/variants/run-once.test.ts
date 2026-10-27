// Variants de runOnce (note 0.12.0, « La recette, sans IA ») : l'entrée
// fermée, l'environnement, le journal ajouté, la dernière ligne utile, le
// délai, une commande qui ne se lance pas.
// Sur du réel : de vrais processus (node -e), un dossier temporaire.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runOnce } from 'technicals/process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-run-once-v-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const log = () => path.join(tmp, `cas-${n++}`, 'recipe.log');
const node = (script: string) => [process.execPath, '-e', script];
const run = (script: string, more: Partial<Parameters<typeof runOnce>[0]> = {}) =>
  runOnce({ argv: node(script), cwd: tmp, log: log(), timeoutMs: 10_000, ...more });

describe('runOnce', () => {
  it('sa sortie et ses erreurs ajoutées au journal ; tail : la dernière ligne non vide, sans couleurs', async () => {
    const file = log();
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, 'avant\n');
    const r = await runOnce({
      argv: node("console.log('un'); console.error('\\x1b[31mdeux\\x1b[0m'); console.log('\\n  \\n')"),
      cwd: tmp, log: file, timeoutMs: 10_000,
    });
    expect(r).toEqual({ exit: 0, tail: 'deux' });
    expect(fs.readFileSync(file, 'utf8')).toMatch(/^avant\nun\n/);
  });

  it('le « exit » d’un shell interactif qui sort n’est pas la dernière ligne utile', async () => {
    expect(await run("console.error('yarn: introuvable'); console.error('exit'); process.exit(127)")).toEqual({ exit: 127, tail: 'yarn: introuvable' });
  });

  it('son code de sortie ; rien écrit : tail vide, pas la ligne d’avant', async () => {
    const file = log();
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, 'étape précédente\n');
    expect(await runOnce({ argv: node('process.exit(3)'), cwd: tmp, log: file, timeoutMs: 10_000 })).toEqual({ exit: 3, tail: '' });
  });

  it('l’entrée fermée : une question y/N lit une fin de fichier, ne bloque pas', async () => {
    const r = await run("let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{console.log('fin:'+JSON.stringify(s)); process.exit(1)})");
    expect(r).toEqual({ exit: 1, tail: 'fin:""' });
  });

  it('l’environnement de l’appli, plus env, plus GIT_TERMINAL_PROMPT=0', async () => {
    process.env.WHISPER_RUN_ONCE_APP = 'appli';
    const r = await run("console.log([process.env.WHISPER_RUN_ONCE_APP, process.env.VIBECODER_BRANCH, process.env.GIT_TERMINAL_PROMPT].join(','))",
      { env: { VIBECODER_BRANCH: 'feat/x', GIT_TERMINAL_PROMPT: '1' } });
    delete process.env.WHISPER_RUN_ONCE_APP;
    expect(r.tail).toBe('appli,feat/x,0');
  });

  it('dans son dossier', async () => {
    expect((await run('console.log(process.cwd())')).tail).toBe(fs.realpathSync(tmp));
  });

  it.skipIf(process.platform === 'win32')('au délai : son groupe tué, descendants compris ; exit null, la raison', async () => {
    const file = log();
    const pidFile = path.join(tmp, `petit-${n}.pid`);
    const child = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(()=>{}, 1000)`;
    const t = Date.now();
    const r = await runOnce({
      argv: node(`process.on('SIGTERM',()=>{}); require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(child)}], {stdio:'inherit'}); setInterval(()=>{}, 1000)`),
      cwd: tmp, log: file, timeoutMs: 500,
    });
    expect(Date.now() - t).toBeLessThan(5000);
    expect(r.exit).toBeNull();
    expect(r.tail).toMatch(/délai/);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    await new Promise((res) => setTimeout(res, 200));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('une commande qui ne se lance pas : ne rejette pas, exit null, la raison (aussi au journal)', async () => {
    const file = log();
    const r = await runOnce({ argv: ['commande-qui-nexiste-pas-xyz'], cwd: tmp, log: file, timeoutMs: 10_000 });
    expect(r.exit).toBeNull();
    expect(r.tail).toMatch(/ENOENT/);
    expect(fs.readFileSync(file, 'utf8')).toMatch(/ENOENT/);
    expect(await runOnce({ argv: [], cwd: tmp, log: log(), timeoutMs: 10_000 })).toMatchObject({ exit: null });
    expect((await run('', { cwd: path.join(tmp, 'absent') })).exit).toBeNull();
  });
});
