// Banc du contrat, vu de l'extérieur : la version courante seule, sur l'appli
// réelle (lancement : tests/main-diff/launch.mjs) avec un faux Claude Code
// (fake-claude.mjs : agentCommand) ; la commande vibecoder (le script du
// plugin, par node) y est appelée comme un agent extérieur, depuis le projet
// et d'ailleurs, et vérifie : le réglage « agents extérieurs » désactivé
// (refus), puis activé : status, next, commands, schema ; un refus en moins
// d'une seconde, code de sortie 1 ; run.allow fermé ; run start (forme), une
// seconde course en attente, run wait rendu à la fin ; proc list, restart,
// logs ; --json ; et que le robot, lui, joint l'appli par son environnement.
//
//   npm run test:contract        (lancé à la main, hors de npm test)
//
// Tout vit dans un profil temporaire : XDG_CONFIG_HOME, donné à l'appli et à la
// commande, y pointe live.json ; le ~/.config de l'utilisateur n'est jamais lu.
// Une fenêtre s'ouvre brièvement. Il faut `npm run build` avant.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, launch, sleep } from '../main-diff/launch.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CLI = path.join(ROOT, 'resources/vibecoder/plugin/bin/vibecoder.mjs');
const FAKE = path.join(import.meta.dirname, 'fake-claude.mjs');

if (!fs.existsSync(path.join(ROOT, 'out/main/index.js'))) { console.error('npm run build d\'abord'); process.exit(2); }

const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-contract-xdg-'));
const ailleurs = path.join(xdg, 'ailleurs');
fs.mkdirSync(ailleurs);
const live = path.join(xdg, 'whisper-dictation', 'live.json');
const note = path.join(xdg, 'robot.json');
// Ni port ni jeton de robot : la commande est un agent extérieur, qui lit live.json (dans le profil).
const { VIBECODER_PORT, VIBECODER_TOKEN, ...base } = process.env;
const env = { ...base, XDG_CONFIG_HOME: xdg };

// La commande, sans shell ; n'échoue jamais : { code, out, err, ms }.
const vibecoder = (args, cwd) => new Promise((done) => {
  const t = Date.now();
  execFile(process.execPath, [CLI, ...args], { cwd, env, timeout: 30000 }, (error, out, err) =>
    done({ code: error ? error.code : 0, out: out.trim(), err: err.trim(), ms: Date.now() - t }));
});
const asJson = async (args, cwd) => { const r = await vibecoder(['--json', ...args], cwd); try { return { ...r, json: JSON.parse(r.out) }; } catch { return r; } };

let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${detail}`}`); };
const said = (r) => JSON.stringify([r.code, r.out, r.err]);

// L'appli, son live.json (dans le profil du banc) ; config : les réglages de config.json.
async function start(name, port, config) {
  const app = await launch({
    appDir: ROOT, name, port, config, env: { ...env, CONTRACT_CLI: CLI, CONTRACT_NOTE: note },
    // une branche avec sa note : les actions du parcours sont proposées
    setup(projet) {
      git(projet, 'checkout', '-q', '-b', 'feat/0.9.0-essai');
      fs.mkdirSync(path.join(projet, 'docs/tickets/feat'), { recursive: true });
      fs.writeFileSync(path.join(projet, 'docs/tickets/feat/0.9.0-essai.md'), '# 0.9.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
      git(projet, 'add', '.');
      git(projet, 'commit', '-q', '-m', 'note');
    },
  });
  fs.rmSync(path.join(xdg, 'whisper-dictation'), { force: true });
  fs.symlinkSync(app.data, path.join(xdg, 'whisper-dictation'));
  for (let i = 0; i < 60 && !fs.existsSync(live); i++) await sleep(500);
  return app;
}

try {
  // Réglage désactivé (le défaut) : live.json sans jeton, la commande refuse.
  let app = await start('contract-off', 9363, {});
  try {
    const r = await vibecoder(['status'], app.projet);
    check('réglage désactivé : refusé, code 1, en moins d\'une seconde', r.code === 1 && r.ms < 1000 && /Outside agents are off/.test(r.err), `${said(r)} ${r.ms} ms`);
    check('réglage désactivé : pas de jeton dans live.json', !('token' in JSON.parse(fs.readFileSync(live, 'utf8'))));
  } finally { await app.dispose(); }

  // Réglage activé, le faux Claude Code pour agent.
  app = await start('contract', 9364, { agentCommand: `"${process.execPath}" "${FAKE}"`, outsideAgents: true });
  try {
    const here = app.projet;
    const status = await asJson(['status'], here);
    check('status depuis le projet', status.code === 0 && status.json?.ok === true, said(status));
    const next = await vibecoder(['next'], here);
    check('next', next.code === 0, said(next));
    const commands = await vibecoder(['commands'], here);
    check('commands : la table, sans l\'appli', commands.code === 0 && /^run\.start /m.test(commands.out), said(commands));
    const schema = await asJson(['schema', 'run.start'], here);
    check('schema run.start', schema.code === 0 && schema.json?.name === 'run.start', said(schema));

    const away = await vibecoder(['status'], ailleurs);
    check('d\'ailleurs (aucun robot sur ce dossier) : refus, code 1, en moins d\'une seconde', away.code === 1 && away.ms < 1000, `${said(away)} ${away.ms} ms`);
    const closed = await asJson(['run.allow', 'action=forme'], here);
    check('run.allow : fermé aux agents', closed.code === 1 && closed.json?.error?.code === 'closed', said(closed));

    const first = await vibecoder(['run', 'start', 'forme'], here);
    check('run start forme', first.code === 0, said(first));
    const second = await asJson(['run', 'start', 'ponytail'], here);
    check('une seconde course : en attente', second.code === 0 && second.json?.result?.queued === true && second.json.result.by === 'forme', said(second));
    const list = await vibecoder(['run', 'list'], here);
    check('run list', list.code === 0 && list.out.includes('"queued"'), said(list));
    const wait = await asJson(['run', 'wait', 'forme'], here);
    check('run wait rendu à la fin de la course', wait.code === 0 && wait.json?.result?.state === 'done', said(wait));

    const robot = fs.existsSync(note) ? JSON.parse(fs.readFileSync(note, 'utf8')) : null;
    check('le robot (faux Claude Code) joint l\'appli par son environnement', robot?.code === 0 && robot.stdout.includes('{'), JSON.stringify(robot));

    const procs = await vibecoder(['proc', 'list'], here);
    check('proc list', procs.code === 0 && procs.out.includes('dormir'), said(procs));
    const restart = await vibecoder(['proc', 'restart', 'dormir'], here);
    check('proc restart', restart.code === 0, said(restart));
    await sleep(1000);
    const logs = await vibecoder(['proc', 'logs', 'dormir'], here);
    check('proc logs', logs.code === 0, said(logs));
    const unknown = await vibecoder(['proc', 'logs', 'inconnu'], here);
    check('proc logs d\'un processus inconnu : refus, code 1', unknown.code === 1, said(unknown));
    await vibecoder(['proc', 'stop', 'dormir'], here);
  } finally { await app.dispose(); }
} finally {
  fs.rmSync(xdg, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} vérification(s) en échec.` : '\nContrat tenu.');
process.exit(failed ? 1 : 0);
