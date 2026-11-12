// Les cas des actions qui passent par gh, servies par le faux gh : load-pr,
// pr-here, pr-worktree, request-review, assign-pr, unassign-pr, publish —
// chacune un succès et ses refus principaux (not-offered, invalid-args…),
// chacun avec le code de la table.
// Hors du banc, par construction : le succès de request-review (la liste des PR
// ouvertes n'est relevée que par la page, setVibe({ prs })) et celui de
// pr-worktree (le robot du worktree pose la question de confiance, une boîte
// native que le banc ne peut pas fermer : l'action resterait en cours).
// Ne connaît pas : GitHub (jamais joint), l'état interne de l'appli (seules les
// réponses des commandes sont lues ; le dépôt n'est que sali, puis nettoyé).
// Utilisé par : tests/contract/run.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { sleep } from '../../main-diff/launch.mjs';
import { asJson, check, setGh, said } from '../bench.mjs';

const BRANCH = 'feat/0.9.0-essai';
const RUNNING = /direct command is running|commande directe est en cours/;

/** @param {import('../bench.mjs').App} app */
export async function ghActions(app) {
  const run = (command, ...args) => asJson([command, ...args], app.projet);
  // Un refus : code de sortie 1 et le code d'erreur de la table.
  const refused = async (command, name, args, code) => {
    const r = await run(command, ...args);
    check(command, name, r.code === 1 && r.json?.ok === false && r.json.error?.code === code, said(r), code);
  };
  const succeeded = async (command, name, args = []) => {
    const r = await run(command, ...args);
    check(command, name, r.code === 0 && r.json?.ok === true, said(r));
  };
  // Relit (chaque lecture relève le dossier et redemande gh) jusqu'à ce que la réponse convienne ; 10 s au plus.
  const until = async (read, ok) => {
    let result;
    for (let i = 0; i < 40; i++) {
      result = (await run(read)).json?.result;
      if (result && ok(result)) return result;
      await sleep(250);
    }
    return result;
  };
  // Une action directe rend ok aussitôt et travaille en fond : on attend qu'aucune commande directe ne soit plus en cours.
  const idle = () => until('next', (n) => !n.disabled.some((d) => RUNNING.test(d.reason)));
  const offered = (id) => (n) => [...n.proposed.map((p) => p.action), ...n.disabled.map((d) => d.action)].includes(id);
  // Avant et après les cas, sans les compter : une commande de préparation ou de remise en état, finie.
  const quietly = async (command, ...args) => { await run(command, ...args); await idle(); };

  // Créateur (l'auteur de la PR est l'utilisateur de gh), aucune PR chargée.
  // Sans pr, load-pr prend la PR du relevé : sur la branche du banc, sa propre PR (#1) ; sur main, aucune.
  await quietly('switch-branch', 'branch=main');
  await refused('load-pr', 'sur main, sans PR donnée ni suivie : invalid-args', [], 'invalid-args');
  await quietly('switch-branch', `branch=${BRANCH}`);
  await refused('load-pr', 'pr=0 : invalid-args', ['pr=0'], 'invalid-args');
  await refused('pr-here', 'aucune PR suivie : pas proposée', [], 'not-offered');
  await refused('pr-here', 'argument inconnu : invalid-args', ['pr=1'], 'invalid-args');
  await refused('pr-worktree', 'aucune PR suivie : pas proposée', [], 'not-offered');
  await refused('pr-worktree', 'argument inconnu : invalid-args', ['pr=1'], 'invalid-args');
  await refused('assign-pr', 'créateur : pas proposée', [], 'not-offered');
  await refused('unassign-pr', 'créateur : pas proposée', [], 'not-offered');
  await refused('publish', 'créateur : pas proposée', ['verdict=approve'], 'not-offered');
  await refused('publish', 'sans verdict : invalid-args', [], 'invalid-args');
  await refused('publish', 'verdict inconnu : invalid-args', ['verdict=maybe'], 'invalid-args');
  await refused('request-review', 'sans pr : invalid-args', [], 'invalid-args');
  await refused('request-review', 'pr=0 : invalid-args', ['pr=0'], 'invalid-args');
  await refused('request-review', 'une PR hors des PR ouvertes du relevé : invalid-args', ['pr=999'], 'invalid-args');

  // load-pr : la PR #1, dont la tête est la branche du banc.
  await succeeded('load-pr', 'la PR #1', ['pr=1']);
  await idle();
  await refused('pr-here', 'dossier déjà sur la tête de la PR : pas proposée', [], 'not-offered');
  await refused('pr-worktree', 'dossier déjà sur la tête de la PR : pas proposée', [], 'not-offered');

  // pr-here : depuis une autre branche, sale d'abord (refusé), propre ensuite.
  await quietly('switch-branch', 'branch=autre');
  const dirt = path.join(app.projet, 'sale.txt');
  fs.writeFileSync(dirt, 'sale\n');
  await until('next', offered('pr-here'));
  await refused('pr-here', 'modifications non commitées : disabled', [], 'disabled');
  fs.rmSync(dirt);
  await succeeded('pr-here', 'le dossier passe sur la tête de la PR');
  await idle();
  const status = await run('status');
  check('pr-here', 'le dossier est sur la branche de la PR', status.json?.result?.branch === BRANCH, said(status));

  // Relecteur : la PR est d'un autre auteur. S'assigner la rend à son créateur, se retirer la rend au relecteur.
  setGh(app, { author: 'autre-dev' });
  await until('status', (s) => s.flow === 'review');
  await succeeded('assign-pr', 's\'assigner la PR');
  await until('next', offered('unassign-pr'));
  await idle();
  await refused('assign-pr', 'déjà assigné : pas proposée', [], 'not-offered');
  await succeeded('unassign-pr', 'se retirer de la PR');
  await until('status', (s) => s.flow === 'review');
  await idle();
  await refused('unassign-pr', 'plus assigné : pas proposée', [], 'not-offered');

  // publish : un brouillon d'une remarque (préparation, non comptée), puis la revue.
  await refused('publish', 'brouillon vide : disabled', ['verdict=approve'], 'disabled');
  await run('draft.add', 'target=src/a.ts:3', 'text=une remarque du banc');
  await until('next', (n) => n.proposed.some((p) => p.action === 'publish'));
  await succeeded('publish', 'la revue publiée', ['verdict=comment']);
  await idle();

  // Remise en état : le brouillon vidé, créateur, la PR plus suivie, la branche du banc.
  const draft = (await run('draft')).json?.result;
  for (const remark of draft?.remarks ?? []) await run('draft.remove', `id=${remark.id}`);
  setGh(app, {});
  await until('status', (s) => s.flow === 'create');
  await quietly('unload-pr');
  await quietly('switch-branch', `branch=${BRANCH}`);
  const end = await run('status');
  check(null, 'banc remis en état : sur sa branche, créateur', end.json?.result?.branch === BRANCH && end.json.result.flow === 'create', said(end));
}
