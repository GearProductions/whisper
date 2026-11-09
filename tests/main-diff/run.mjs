// Banc du principal : une version publiée (tag, branche ; v0.14.0 par défaut,
// la première à fenêtre unique) contre la version courante, sur l'appli
// réelle. Chacune est construite, lancée sur un profil neuf (un agent
// « essai », affiché la dernière fois), et pilotée par le même scénario
// (scenario.mjs), par le pont de la fenêtre : démarrage, l'agent affiché, la
// dictée (enregistrement, transcription rendue à la page, trop court),
// historique, envoi vide, Écouter sans réponse, lien et agent refusés,
// erreurs ; puis les boutons du contrat (VibeCoder) sur un projet git
// (un commit, une branche, une commande « sleep 30 », deux artefacts), sans
// agent lancé : refus, actions directes, processus, explorateur des
// artefacts, dépôt de fichiers. Les deux relevés doivent être identiques.
//
//   npm run test:main-diff -- v0.14.0
//
// Le lancement de l'appli (profil neuf, projet git, Electron) : launch.mjs.
// Il faut le modèle de dictée dans .data/whisper (whisper-dev l'y a mis) et
// build/whisper.cpp/samples/jfk.wav (npm run build:whisper). Une fenêtre
// s'ouvre brièvement.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, run } from './launch.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const REF = process.argv[2] || 'v0.14.0';
const WAV = path.join(ROOT, 'build/whisper.cpp/samples/jfk.wav');
const MODEL = path.join(ROOT, '.data/whisper');

for (const need of [WAV, MODEL]) if (!fs.existsSync(need)) { console.error(`introuvable : ${need}`); process.exit(2); }

async function measure(appDir, name, port) {
  const { data, stop, dispose } = await launch({ appDir, name, port });
  let out;
  try {
    out = JSON.parse(execFileSync(process.execPath, [path.join(import.meta.dirname, 'scenario.mjs'), String(port), WAV], { timeout: 120000 }).toString());
    await stop();
    out.agentSelectionneEnregistre = JSON.parse(fs.readFileSync(path.join(data, 'config.json'), 'utf8')).agentSelected;
  } finally {
    await dispose();
  }
  // Le dossier temporaire diffère d'un profil à l'autre : retiré du relevé.
  return JSON.parse(JSON.stringify(out).replaceAll(data, '<profil>'));
}

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
  run('git', ['worktree', 'remove', '--force', old], ROOT);
}
process.exit(failed ? 1 : 0);
