// Les cas des courses : run.start (une course, puis une seconde en attente,
// busy), run.stop, run.keep, run.undo (no-run sans course arrêtée) ;
// run.allow, run.always, run.deny fermés aux agents (closed). Les droits vus
// de l'extérieur : la course dont le faux claude simule un refus d'outil
// finit terminée (run.wait : done), le refus cité en tête de sa réponse.
// Ne connaît pas : l'état interne de l'appli, le mode donné à Claude Code.
// Utilisé par : tests/contract/run.mjs.
import { asJson, check, said, refused, good } from '../bench.mjs';

// Le refus cité en tête, dans la langue de l'appli (fr ou en).
const DENIAL = /^(Appels refusés : Bash « git push »|Calls denied: Bash “git push”)\./;

/** @param {import('../bench.mjs').App} app */
export async function runs(app) {
  const here = app.projet;

  // La table appelle `busy` le refus d'une action qui écrit pendant qu'une autre course retient le dossier ; à la porte agent
  // (l'extérieur), l'appli ne le rend jamais : la demande est mise en file, { queued: true, by }, un succès.
  const first = await asJson(['run', 'start', 'forme'], here);
  check('run.start', 'une action de l\'étape part', good(first), said(first));
  const same = await asJson(['run', 'start', 'forme'], here);
  check('run.start', 'la même action déjà en cours : refusée, same', refused(same, 'same'), said(same), 'same');
  const unknown = await asJson(['run', 'start', 'inconnue'], here);
  check('run.start', 'une action hors de la table : refusée, invalid-args', refused(unknown, 'invalid-args'), said(unknown), 'invalid-args');
  const second = await asJson(['run', 'start', 'ponytail'], here);
  check('run.start', 'une seconde action : en attente derrière la première (queued, by)',
    good(second) && second.json.result?.queued === true && second.json.result.by === 'forme', said(second));
  // Attendue dès maintenant : la course de ponytail finit vite, après garder, et run.wait la manquerait si on l'appelait après.
  const ponytail = asJson(['run', 'wait', 'ponytail'], here);

  // Pas encore arrêtée : ni garder ni annuler n'ont de course arrêtée à traiter.
  const early = await asJson(['run.keep', 'action=forme'], here);
  check('run.keep', 'sans course arrêtée (elle court) : refusé, no-run', refused(early, 'no-run'), said(early), 'no-run');
  const earlyUndo = await asJson(['run.undo', 'action=forme'], here);
  check('run.undo', 'sans course arrêtée (elle court) : refusé, no-run', refused(earlyUndo, 'no-run'), said(earlyUndo), 'no-run');

  const stop = await asJson(['run', 'stop', 'forme'], here);
  check('run.stop', 'une course en cours s\'arrête', good(stop), said(stop));
  const stopAgain = await asJson(['run', 'stop', 'forme'], here);
  check('run.stop', 'déjà arrêtée : refusé, no-run', refused(stopAgain, 'no-run'), said(stopAgain), 'no-run');
  const stopNone = await asJson(['run', 'stop', 'checks'], here);
  check('run.stop', 'une action sans course : refusé, no-run', refused(stopNone, 'no-run'), said(stopNone), 'no-run');

  // Arrêtée, la course retient encore le dossier (la seconde attend) : garder la libère, la seconde part seule.
  const keep = await asJson(['run.keep', 'action=forme'], here);
  check('run.keep', 'une course arrêtée est gardée', good(keep), said(keep));
  const keepAgain = await asJson(['run.keep', 'action=forme'], here);
  check('run.keep', 'déjà gardée : refusé, no-run', refused(keepAgain, 'no-run'), said(keepAgain), 'no-run');
  const undoKept = await asJson(['run.undo', 'action=forme'], here);
  check('run.undo', 'une course gardée : refusé, no-run', refused(undoKept, 'no-run'), said(undoKept), 'no-run');

  // Les droits, vus de l'extérieur : un refus d'outil ne fait pas échouer la course, il est cité en tête de sa réponse.
  const end = await ponytail;
  check('run.wait', 'la course au refus simulé : terminée (done), pas en échec', end.code === 0 && end.json?.result?.state === 'done', said(end));
  check('run.wait', 'le refus cité en tête de sa réponse', DENIAL.test(end.json?.result?.reply ?? ''), said(end));

  // Une autre course arrêtée, annulée cette fois.
  const again = await asJson(['run', 'start', 'forme'], here);
  check('run.start', 'une action déjà gardée repart', good(again), said(again));
  await asJson(['run', 'stop', 'forme'], here);
  const undo = await asJson(['run.undo', 'action=forme'], here);
  check('run.undo', 'une course arrêtée est annulée', good(undo), said(undo));
  const undoAgain = await asJson(['run.undo', 'action=forme'], here);
  check('run.undo', 'déjà annulée : refusé, no-run', refused(undoAgain, 'no-run'), said(undoAgain), 'no-run');

  // Les droits ne se donnent qu'à l'écran : fermés à l'agent, même sans demande en cours.
  for (const name of ['run.allow', 'run.always', 'run.deny']) {
    const r = await asJson([name, 'action=forme'], here);
    check(name, 'fermé aux agents', refused(r, 'closed'), said(r), 'closed');
  }
}
