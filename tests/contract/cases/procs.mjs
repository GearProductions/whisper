// Les cas des processus : proc.start, proc.stop, proc.restart sur la commande
// `dormir` du dépôt d'essai, et un nom inconnu refusé (son code de la table).
// L'état de `dormir` se juge par la réponse de `procs` (une lecture de la CLI),
// jamais par l'état interne ; à la fin, `dormir` est arrêtée.
// Ne connaît pas : l'état interne de l'appli.
// Utilisé par : tests/contract/run.mjs.
import { asJson, check, said, refused } from '../bench.mjs';

const done = (r) => r.code === 0 && r.json?.ok === true && r.json.result === null;

/** @param {import('../bench.mjs').App} app */
export async function procs(app) {
  const cwd = app.projet;
  const status = async () => (await asJson(['procs'], cwd)).json?.result?.find((p) => p.name === 'dormir')?.status;
  const isRunning = async () => (await status()) === 'running';

  // La CLI n'a pas de `proc start` court : la commande de la table, par son nom.
  let r = await asJson(['proc.start', 'name=dormir'], cwd);
  check('proc.start', 'dormir : démarrée, sans réponse', done(r), said(r));
  check('proc.start', 'procs la dit running', await isRunning(), await status());
  r = await asJson(['proc.start', 'name=dormir'], cwd);
  check('proc.start', 'déjà en marche : rien à faire, pas d\'erreur', done(r) && await isRunning(), said(r));
  r = await asJson(['proc.start', 'name=inconnu'], cwd);
  check('proc.start', 'un nom inconnu refusé', refused(r, 'unknown-process'), said(r), 'unknown-process');
  r = await asJson(['proc.start'], cwd);
  check('proc.start', 'sans nom refusé', refused(r, 'invalid-args'), said(r), 'invalid-args');

  r = await asJson(['proc', 'restart', 'dormir'], cwd);
  check('proc.restart', 'en marche : relancée, sans réponse', done(r) && await isRunning(), said(r));
  r = await asJson(['proc', 'stop', 'dormir'], cwd);
  check('proc.stop', 'arrêtée, sans réponse', done(r), said(r));
  check('proc.stop', 'procs la dit arrêtée', (await status()) === 'stopped', await status());
  r = await asJson(['proc', 'stop', 'dormir'], cwd);
  check('proc.stop', 'déjà arrêtée : rien à faire, pas d\'erreur', done(r), said(r));
  r = await asJson(['proc', 'stop', 'inconnu'], cwd);
  check('proc.stop', 'un nom inconnu refusé', refused(r, 'unknown-process'), said(r), 'unknown-process');
  r = await asJson(['proc.stop'], cwd);
  check('proc.stop', 'sans nom refusé', refused(r, 'invalid-args'), said(r), 'invalid-args');

  r = await asJson(['proc', 'restart', 'dormir'], cwd);
  check('proc.restart', 'arrêtée : démarrée', done(r) && await isRunning(), said(r));
  r = await asJson(['proc', 'restart', 'inconnu'], cwd);
  check('proc.restart', 'un nom inconnu refusé', refused(r, 'unknown-process'), said(r), 'unknown-process');
  r = await asJson(['proc.restart'], cwd);
  check('proc.restart', 'sans nom refusé', refused(r, 'invalid-args'), said(r), 'invalid-args');

  // l'appli comme on l'a trouvée : dormir arrêtée
  r = await asJson(['proc', 'stop', 'dormir'], cwd);
  check('proc.stop', 'nettoyage : dormir arrêtée', done(r) && !(await isRunning()), said(r));
}
