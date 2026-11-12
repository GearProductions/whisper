// Les cas des lectures : status, next, actions, runs, run.wait, procs, logs,
// artifacts, artifact, draft — chacune un succès (code 0, la forme de sa
// réponse) et ses refus principaux, chacun avec le code d'erreur de la table
// (invalid-args, un id ou un nom inconnu…).
// Préparations hors lecture (non comptées) : run start forme (une course tenue
// 4 s, pour run.wait et les lectures d'une course en cours) et add-artifact (un
// artefact à lire), défait ensuite en effaçant le fichier dans le dossier que
// artifacts a rendu (le profil du banc, jamais la corbeille).
// Ne connaît pas : l'état interne de l'appli.
// Utilisé par : tests/contract/run.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { asJson, check, cli, said, good, refused } from '../bench.mjs';

const named = (list, key, value) => (Array.isArray(list) ? list.find((x) => x[key] === value) : undefined);

/** @param {import('../bench.mjs').App} app */
export async function reads(app) {
  const here = app.projet;
  const read = (...args) => asJson(args, here);

  // Chaque lecture sans argument refuse un argument inconnu.
  for (const c of ['status', 'next', 'actions', 'runs', 'procs', 'artifacts', 'draft']) {
    const r = await read(c, 'inconnu=1');
    check(c, `${c} avec un argument inconnu : invalid-args`, refused(r, 'invalid-args'), said(r), 'invalid-args');
  }

  // status, next, actions
  const status = await read('status');
  const s = status.json?.result;
  check('status', 'status : la branche, le parcours, la note, rien en cours',
    good(status) && s.branch === 'feat/0.9.0-essai' && s.flow === 'create' && typeof s.note === 'string' && s.note.endsWith('0.9.0-essai.md') && s.vibe === false && Array.isArray(s.running) && s.running.length === 0, said(status));
  const next = await read('next');
  const n = next.json?.result;
  check('next', 'next : des actions proposées et grisées', good(next) && Array.isArray(n.proposed) && n.proposed.length > 0 && Array.isArray(n.disabled), said(next));
  const actions = await read('actions');
  const forme = named(actions.json?.result, 'action', 'forme');
  check('actions', 'actions : la liste, forme y court seule', good(actions) && forme?.run === true && Array.isArray(forme.args), said(actions));

  // runs (rien en cours), run.wait refusé
  const runs = await read('runs');
  check('runs', 'runs : une liste', good(runs) && Array.isArray(runs.json.result), said(runs));
  const none = await read('run.wait', 'action=forme');
  check('run.wait', 'run.wait sans course : no-run', refused(none, 'no-run'), said(none), 'no-run');
  const noArg = await read('run.wait');
  check('run.wait', 'run.wait sans action : invalid-args', refused(noArg, 'invalid-args'), said(noArg), 'invalid-args');

  // procs, logs (dormir, jamais lancé : son journal est vide mais il existe)
  const procs = await read('procs');
  const dormir = named(procs.json?.result, 'name', 'dormir');
  check('procs', 'procs : dormir est listé avec sa ligne de commande', good(procs) && dormir?.run === 'sleep 30' && ['running', 'stopped', 'failed'].includes(dormir.status), said(procs));
  const logs = await read('proc', 'logs', 'dormir');
  check('logs', 'logs de dormir : { name, log }', good(logs) && logs.json.result.name === 'dormir' && typeof logs.json.result.log === 'string', said(logs));
  const logsUnknown = await read('proc', 'logs', 'inconnu');
  check('logs', 'logs d\'un processus inconnu : unknown-process', refused(logsUnknown, 'unknown-process'), said(logsUnknown), 'unknown-process');
  const logsNoArg = await read('logs');
  check('logs', 'logs sans nom : invalid-args', refused(logsNoArg, 'invalid-args'), said(logsNoArg), 'invalid-args');

  // draft : aucune PR chargée à la main ici, le brouillon est vide
  const draft = await read('draft');
  const d = draft.json?.result;
  check('draft', 'draft : { pr, remarks }, sans remarque', good(draft) && (d.pr === null || Number.isInteger(d.pr)) && Array.isArray(d.remarks) && d.remarks.length === 0, said(draft));

  // artifacts, artifact : un artefact posé par add-artifact, effacé à la fin
  const before = await read('artifacts');
  const dir = before.json?.result?.dir;
  check('artifacts', 'artifacts : le dossier, ses fichiers et ses dossiers', good(before) && typeof dir === 'string' && dir !== '' && Array.isArray(before.json.result.files) && Array.isArray(before.json.result.folders), said(before));
  const content = Buffer.from('# lecture\n').toString('base64');
  const added = await read('add-artifact', `files=[{"name":"lecture.md","content":"${content}"}]`);
  const listed = await read('artifacts');
  const file = named(listed.json?.result?.files, 'name', 'lecture.md');
  check('artifacts', 'artifacts : l\'artefact ajouté y est, markdown', added.code === 0 && good(listed) && file?.kind === 'markdown' && file.size === 10, said(listed));
  if (file) {
    const one = await read('artifact', `artifact=${file.id}`);
    check('artifact', 'artifact : son nom, son genre, son texte', good(one) && one.json.result.name === 'lecture.md' && one.json.result.kind === 'markdown' && one.json.result.text === '# lecture\n' && one.json.result.truncated === false, said(one));
  } else check('artifact', 'artifact : un artefact à lire', false, `add-artifact : ${said(added)}`);
  if (dir) fs.rmSync(path.join(dir, 'lecture.md'), { force: true });
  await read('artifacts');   // le relevé suit le disque
  const unknown = await read('artifact', 'artifact=a999');
  check('artifact', 'artifact d\'un id inconnu : unknown-artifact', refused(unknown, 'unknown-artifact'), said(unknown), 'unknown-artifact');
  const artifactNoArg = await read('artifact');
  check('artifact', 'artifact sans id : invalid-args', refused(artifactNoArg, 'invalid-args'), said(artifactNoArg), 'invalid-args');

  // Une course tenue (forme, 4 s) : les lectures d'une course en cours, puis run.wait jusqu'à sa fin
  const started = await cli(['run', 'start', 'forme'], here);
  if (started.code !== 0) { check(null, 'préparation : run start forme', false, said(started)); return; }
  const during = await read('status');
  check('status', 'status pendant une course : forme y est en cours', good(during) && named(during.json.result.running, 'action', 'forme')?.state === 'running', said(during));
  const list = await read('run', 'list');
  check('runs', 'runs pendant une course : forme running', good(list) && named(list.json.result, 'action', 'forme')?.state === 'running', said(list));
  const waited = await read('run', 'wait', 'forme');
  check('run.wait', 'run.wait rendu à la fin : forme done', good(waited) && waited.json.result.action === 'forme' && waited.json.result.state === 'done' && typeof waited.json.result.reply === 'string', said(waited));
  const again = await read('run', 'wait', 'forme');
  check('run.wait', 'run.wait après la fin : no-run', refused(again, 'no-run'), said(again), 'no-run');
}
