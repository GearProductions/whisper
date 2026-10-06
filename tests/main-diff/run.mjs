// Banc du principal : une version publiée (tag, branche) contre la version
// courante, sur l'appli réelle. Chacune est construite, lancée sur un profil
// neuf (un agent « essai », collage automatique désactivé, lecture coupée), et
// pilotée par le même scénario (scenario.mjs) : démarrage, sélection d'un
// robot, dictée vers l'agent, contexte « Dictée », dictée vers le curseur,
// Copier, erreurs. Les deux relevés doivent être identiques.
//
//   npm run test:main-diff -- v0.5.0-rc.1
//
// Il faut le modèle de dictée dans .data/whisper (whisper-dev l'y a mis) et
// build/whisper.cpp/samples/jfk.wav (npm run build:whisper). Des fenêtres
// s'ouvrent brièvement ; le texte du presse-papiers est sauvé puis rendu.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const REF = process.argv[2] || 'v0.5.0-rc.1';
const WAV = path.join(ROOT, 'build/whisper.cpp/samples/jfk.wav');
const MODEL = path.join(ROOT, '.data/whisper');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'ignore' });
const tool = (name) => ['/run/host/usr/bin/' + name, name].find((p) => { try { execFileSync(p, ['--version'], { stdio: 'ignore', timeout: 2000 }); return true; } catch { return false; } });

for (const need of [WAV, MODEL]) if (!fs.existsSync(need)) { console.error(`introuvable : ${need}`); process.exit(2); }

async function measure(appDir, name, port) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), `whisper-main-diff-${name}-`));
  fs.mkdirSync(path.join(data, 'projet'));
  fs.symlinkSync(MODEL, path.join(data, 'whisper'));
  fs.writeFileSync(path.join(data, 'config.json'), JSON.stringify({
    agentsEnabled: true, autoPaste: false, showText: true, speak: 'off', agentSelected: 'a1',
    agents: [{ id: 'a1', dir: path.join(data, 'projet'), name: 'essai', model: '', effort: '', mode: 'default', sessionId: null }],
    agentFolders: [{ dir: path.join(data, 'projet'), color: '#22c55e' }],
  }));
  const app = spawn(path.join(ROOT, 'node_modules/.bin/electron'), ['.', `--user-data-dir=${data}`, `--remote-debugging-port=${port}`], { cwd: appDir, stdio: 'ignore' });
  await sleep(4000);
  let out;
  try {
    out = JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, 'scenario.mjs'), String(port), WAV], { timeout: 120000 }).toString());
  } finally {
    app.kill();
    await new Promise((r) => app.once('exit', r));
  }
  out.agentSelectionneEnregistre = JSON.parse(fs.readFileSync(path.join(data, 'config.json'), 'utf8')).agentSelected;
  fs.rmSync(data, { recursive: true, force: true });
  // Le dossier temporaire diffère d'un profil à l'autre : retiré du relevé.
  return JSON.parse(JSON.stringify(out).replaceAll(data, '<profil>'));
}

const paste = tool('wl-paste');
const copy = tool('wl-copy');
const saved = paste ? (() => { try { return execFileSync(paste, ['--no-newline'], { timeout: 2000 }).toString(); } catch { return ''; } })() : null;
const old = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-main-diff-ref-'));
let failed = false;
try {
  run('git', ['worktree', 'add', '--detach', old, REF], ROOT);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(old, 'node_modules'));
  run('npm', ['run', 'build'], old);
  run('npm', ['run', 'build'], ROOT);
  const before = await measure(old, 'ref', 9361);
  const after = await measure(ROOT, 'courante', 9362);
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = JSON.stringify(before[k]); const b = JSON.stringify(after[k]);
    if (a !== b) { failed = true; console.log(`✗ ${k}\n  ${REF} : ${a}\n  courante : ${b}`); }
  }
  for (const [v, r] of [[REF, before], ['courante', after]]) {
    if (Object.values(r.erreurs).some((e) => e.length)) { failed = true; console.log(`✗ erreurs dans les pages (${v}) : ${JSON.stringify(r.erreurs)}`); }
  }
  console.log(failed ? '\nDifférent de la référence.' : `Identique à ${REF} (${Object.keys(after).length} relevés).`);
} finally {
  // wl-copy reste en arrière-plan pour servir le presse-papiers : sa sortie n'est pas attendue.
  if (saved !== null && copy) execFileSync(copy, [], { input: saved, stdio: ['pipe', 'ignore', 'ignore'] });
  run('git', ['worktree', 'remove', '--force', old], ROOT);
}
process.exit(failed ? 1 : 0);
