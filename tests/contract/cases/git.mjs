// Les cas des actions directes git, sur le dépôt d'essai et son origin local :
// pull, push, fetch, switch-branch, rebase, stash, commit, base, new-here,
// new-worktree, remove-worktree, unload-pr — chacune un succès et ses refus
// principaux (busy : une autre action en cours ; disabled ; not-offered ;
// invalid-args…), chacun avec le code de la table. base attend la PR fusionnée
// du faux gh.
// Une action directe répond aussitôt et travaille en fond : le succès est la
// réponse ok, puis ce que les commandes en disent (status : la branche ; next :
// ce qui est proposé ou grisé), attendu par sondage. Les préconditions sont
// préparées par git dans app.projet ou app.origin (une identité git locale ; un
// clone sous app.data qui pousse un commit pour pull ; un fichier indexé et un
// fichier sale pour commit et stash) et par le message qu'écrirait
// commit-prepare (commit.md, dans les sorties de l'agent « essai », a1 : le
// faux claude n'en écrit pas).
// Hors de ce fichier, faute de succès joignable sans fenêtre : new-worktree
// (la question de confiance du nouveau dossier est une boîte de dialogue) et
// remove-worktree (n'existe que dans un worktree, ouvert par ce même
// dialogue) n'ont que leurs refus.
// Ne connaît pas : l'état interne de l'appli (le dépôt n'est lu que par ce que
// répond la commande).
// Utilisé par : tests/contract/run.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { git, sleep } from '../../main-diff/launch.mjs';
import { asJson, check, setGh, said } from '../bench.mjs';

const BRANCH = 'feat/0.9.0-essai';

/** @param {import('../bench.mjs').App} app */
export async function gitActions(app) {
  const call = (...args) => asJson(args, app.projet);
  const accepted = (cmd, name, r) => check(cmd, name, r.code === 0 && r.json?.ok === true, said(r));
  const refused = (cmd, name, r, code) => check(cmd, name, r.code === 1 && r.json?.error?.code === code, said(r), code);
  // Rappelle la commande jusqu'à ce que pred(réponse) : l'appli travaille en fond et se relève toute seule.
  const until = async (args, pred) => {
    let r;
    for (let i = 0; i < 40; i++) { r = await asJson(args, app.projet); if (pred(r)) break; await sleep(250); }
    return r;
  };
  // Ranger après coup : un cas en échec ne doit pas faire lever le reste du banc.
  const tidy = (...args) => { try { git(app.projet, ...args); } catch { /* rien à ranger */ } };
  const list = (r, key) => r.json?.result?.[key] ?? [];
  const proposes = (...actions) => (r) => actions.every((a) => list(r, 'proposed').some((p) => p.action === a));
  // L'action qu'elle vient de lancer a fini : next grise tout le temps qu'une commande directe tourne.
  const settle = () => until(['next'], (r) => !list(r, 'disabled').some((d) => /direct/i.test(d.reason)));
  const onBranch = async (cmd, branch) => {
    const r = await until(['status'], (s) => s.json?.result?.branch === branch);
    check(cmd, `status dit le dossier sur ${branch}`, r.json?.result?.branch === branch, said(r));
  };

  // Le commit de l'appli (git commit, lancé par elle) ne dépend pas de l'identité ni de la signature de l'utilisateur.
  for (const [key, value] of [['user.name', 'banc'], ['user.email', 'banc@example.invalid'], ['commit.gpgsign', 'false']]) git(app.projet, 'config', key, value);

  // 1. Dépôt propre, en phase, PR ouverte : les refus qui ne demandent rien.
  for (const cmd of ['pull', 'push', 'fetch', 'stash', 'commit', 'base', 'unload-pr', 'remove-worktree']) {
    refused(cmd, 'un argument inconnu', await call(cmd, 'junk=1'), 'invalid-args');
  }
  refused('pull', 'à jour : grisé', await call('pull'), 'disabled');
  refused('push', 'rien de rebasé : pas proposé', await call('push'), 'not-offered');
  refused('stash', 'rien à mettre de côté : pas proposé', await call('stash'), 'not-offered');
  refused('commit', 'aucun message préparé : pas proposé', await call('commit'), 'not-offered');
  refused('base', 'la PR n\'est pas fusionnée : pas proposé', await call('base'), 'not-offered');
  refused('remove-worktree', 'pas un worktree : pas proposé', await call('remove-worktree'), 'not-offered');
  refused('switch-branch', 'sans branche', await call('switch-branch'), 'invalid-args');
  refused('switch-branch', 'un nom pas sûr', await call('switch-branch', 'branch=--force'), 'invalid-args');
  refused('switch-branch', 'une branche qui n\'existe pas', await call('switch-branch', 'branch=nope'), 'invalid-args');
  refused('rebase', 'un nom pas sûr', await call('rebase', 'onto=--force'), 'invalid-args');
  refused('rebase', 'une branche qui n\'existe pas', await call('rebase', 'onto=nope'), 'invalid-args');
  refused('new-here', 'un nom qui est déjà une branche', await call('new-here', 'branch=autre'), 'invalid-args');
  refused('new-here', 'un point de départ qui n\'existe pas', await call('new-here', 'branch=essai-ici', 'start=nope'), 'invalid-args');
  refused('new-here', 'un nom pas sûr', await call('new-here', 'branch=a..b'), 'invalid-args');
  refused('new-here', 'sans nom ni demande retenue : pas proposé', await call('new-here'), 'not-offered');
  refused('new-worktree', 'un nom qui est déjà une branche', await call('new-worktree', 'branch=autre'), 'invalid-args');
  refused('new-worktree', 'sans nom ni demande retenue : pas proposé', await call('new-worktree'), 'not-offered');

  // 2. fetch puis pull : un commit arrive sur origin depuis un clone, sous app.data.
  const clone = path.join(app.data, 'clone');
  git(app.data, 'clone', '-q', app.origin, clone);
  git(clone, 'switch', '-q', BRANCH);
  fs.writeFileSync(path.join(clone, 'amont.txt'), 'amont\n');
  git(clone, 'add', 'amont.txt');
  git(clone, 'commit', '-q', '-m', 'amont');
  git(clone, 'push', '-q', 'origin', BRANCH);
  fs.rmSync(clone, { recursive: true, force: true });
  accepted('fetch', 'relève l\'état du dépôt distant', await call('fetch'));
  await settle();
  const behind = await until(['next'], proposes('pull'));
  check('fetch', 'le relevé suit : pull est proposé', proposes('pull')(behind), said(behind));
  accepted('pull', 'ramène le commit', await call('pull'));
  await settle();
  const upToDate = await until(['next'], (r) => list(r, 'disabled').some((d) => d.action === 'pull'));
  check('pull', 'puis de nouveau à jour', list(upToDate, 'disabled').some((d) => d.action === 'pull'), said(upToDate));
  refused('pull', 'de nouveau à jour : grisé', await call('pull'), 'disabled');

  // 3. Le lieu : retour sur la base, branche créée ici, retour sur la branche de la note.
  accepted('unload-pr', 'revient sur la branche principale', await call('unload-pr'));
  await settle();
  await onBranch('unload-pr', 'main');
  refused('unload-pr', 'sur la base : pas proposé', await call('unload-pr'), 'not-offered');
  accepted('switch-branch', 'passe sur une branche locale', await call('switch-branch', `branch=${BRANCH}`));
  await settle();
  await onBranch('switch-branch', BRANCH);
  accepted('new-here', 'crée une branche ici', await call('new-here', 'branch=essai-ici'));
  await settle();
  await onBranch('new-here', 'essai-ici');
  accepted('switch-branch', 'revient sur la branche de la note', await call('switch-branch', `branch=${BRANCH}`));
  await settle();
  await onBranch('switch-branch', BRANCH);
  tidy('branch', '-D', 'essai-ici');

  // 4. Un fichier indexé, un fichier sale, le message préparé, la PR fusionnée.
  fs.writeFileSync(path.join(app.projet, 'commite.txt'), 'à commiter\n');
  git(app.projet, 'add', 'commite.txt');
  fs.writeFileSync(path.join(app.projet, 'sale.txt'), 'sale\n');
  const out = path.join(app.data, 'vibecoder-out', 'a1');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'commit.md'), 'chore: commit du banc\n');
  setGh(app, { state: 'MERGED' });
  await until(['status'], (r) => r.json?.result?.pr?.state === 'MERGED');
  await until(['next'], proposes('commit', 'stash', 'base'));
  refused('switch-branch', 'des modifications non commitées : grisé', await call('switch-branch', 'branch=autre'), 'disabled');
  refused('new-here', 'des modifications non commitées : grisé', await call('new-here', 'branch=essai-ici'), 'disabled');
  refused('unload-pr', 'des modifications non commitées : grisé', await call('unload-pr'), 'disabled');

  // 5. Une course retient le dossier : chaque action qui écrit est refusée busy (en parallèle, la course dure 4 s) ;
  //    le dépôt est sale, au cas où la course finirait avant : switch-branch, new-here, unload-pr et base seraient refusés de toute façon.
  const held = [['base'], ['switch-branch', 'branch=autre'], ['new-here', 'branch=essai-ici'], ['unload-pr'], ['commit'], ['stash'], ['pull'], ['fetch'], ['rebase']];
  const started = await call('run', 'start', 'forme');
  if (started.code === 0) {
    const answers = await Promise.all(held.map((args) => call(...args)));
    held.forEach(([cmd], i) => refused(cmd, 'une autre course retient le dossier', answers[i], 'busy'));
    await call('run', 'wait', 'forme');
  } else check('commit', 'une course part pour retenir le dossier', false, said(started));

  // 6. Commit, rebase puis push, stash.
  accepted('commit', 'commite le message préparé', await call('commit'));
  await settle();
  refused('commit', 'le message est consommé : pas proposé', await call('commit'), 'not-offered');
  accepted('rebase', 'rebase sur la base', await call('rebase'));
  await settle();
  const pushable = await until(['next'], proposes('push'));
  check('rebase', 'puis push est proposé', proposes('push')(pushable), said(pushable));
  accepted('push', 'pousse la branche', await call('push'));
  await settle();
  refused('push', 'poussée : plus proposé', await call('push'), 'not-offered');
  accepted('stash', 'met les modifications de côté', await call('stash'));
  await settle();
  refused('stash', 'plus rien à mettre de côté : pas proposé', await call('stash'), 'not-offered');
  tidy('stash', 'drop');

  // 7. base : la PR fusionnée ; la branche locale est supprimée, on la refait depuis origin.
  accepted('base', 'revient sur la base', await call('base'));
  await settle();
  await onBranch('base', 'main');
  tidy('switch', '-q', '-c', BRANCH, '--track', `origin/${BRANCH}`);
  tidy('switch', '-q', BRANCH);   // la branche n'avait pas été supprimée
  setGh(app, {});
  const back = await until(['status'], (r) => r.json?.result?.branch === BRANCH && r.json?.result?.pr?.state === 'OPEN');
  check('base', 'le dossier est revenu comme avant', back.json?.result?.branch === BRANCH && back.json?.result?.pr?.state === 'OPEN', said(back));
}
