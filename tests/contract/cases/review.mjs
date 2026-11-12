// Les cas de la revue : draft.add, draft.edit, draft.remove sur la PR d'essai
// du faux gh (publish est dans cases/gh.mjs) — chacune un succès et ses refus
// principaux (invalid-args…), chacun avec le code de la table ; draft.edit et
// draft.remove d'une remarque inconnue : invalid-args, rien ne change.
// Le décor (non compté) : l'auteur de la PR devient un autre (rôle relecteur), load-pr 1 la suit ;
// à la fin, unload-pr, retour sur la branche de la note, faux gh remis à zéro.
// Ne connaît pas : l'état interne de l'appli (la commande draft, la réponse de la CLI).
// Utilisé par : tests/contract/run.mjs.
import { sleep } from '../../main-diff/launch.mjs';
import { asJson, check, setGh } from '../bench.mjs';

const BRANCH = 'feat/0.9.0-essai';
const FILE = 'docs/tickets/feat/0.9.0-essai.md';   // un fichier du diff de la PR d'essai

/** @param {import('../bench.mjs').App} app */
export async function review(app) {
  const say = (...args) => asJson(args, app.projet);
  const until = async (fn) => { for (let i = 0; i < 40; i++) { if (await fn()) return true; await sleep(500); } return false; };
  const remarks = async () => (await say('draft')).json?.result?.remarks ?? [];
  const ok = (r) => r.code === 0 && r.json?.ok === true;
  const refused = (r, code) => r.code === 1 && r.json?.error?.code === code;
  const same = async (before) => JSON.stringify(await remarks()) === JSON.stringify(before);

  // Sans PR suivie : no-pr, pour les trois.
  for (const args of [['draft.add', `target=${FILE}:3`, 'text=x'], ['draft.edit', 'id=1', 'text=x'], ['draft.remove', 'id=1']]) {
    const r = await say(...args);
    check(args[0], 'aucune PR suivie : refusé', refused(r, 'no-pr'), r.out, 'no-pr');
  }

  // Le décor : relecteur, PR 1 suivie ; prêt quand draft.remove d'un id inconnu n'est plus refusé no-pr, mais invalid-args.
  setGh(app, { author: 'autre-dev' });
  await say('load-pr', 'pr=1');
  const ready = await until(async () => refused(await say('draft.remove', 'id=999'), 'invalid-args'));
  check('draft.add', 'le banc relit la PR #1', ready, 'le rôle de relecteur ou la PR chargée ne sont jamais venus');

  // draft.add
  let r = await say('draft.add', `target=${FILE}:3`, 'text=Premiere remarque');
  let list = await remarks();
  const first = list.find((c) => c.text === 'Premiere remarque');
  check('draft.add', 'ajoute une remarque', ok(r) && list.length === 1 && first?.target === `${FILE}:3`, r.out);
  r = await say('draft.add', `target=${FILE}`, 'text=Seconde remarque');
  list = await remarks();
  const second = list.find((c) => c.text === 'Seconde remarque');
  check('draft.add', 'ajoute une seconde remarque, dans l\'ordre', ok(r) && list.length === 2 && list[1]?.id === second?.id && second?.id !== first?.id, r.out);
  const two = list;
  const bad = [
    ['sans texte', ['draft.add', `target=${FILE}`]],
    ['sans cible', ['draft.add', 'text=x']],
    ['une cible sur deux lignes', ['draft.add', `target=${FILE}\nautre`, 'text=x']],
    ['une cible de plus de 300 caractères', ['draft.add', `target=${'a'.repeat(301)}`, 'text=x']],
    ['un texte vide', ['draft.add', `target=${FILE}`, 'text=   ']],
    ['un texte de plus de 5000 caractères', ['draft.add', `target=${FILE}`, `text=${'x'.repeat(5001)}`]],
    ['un argument inconnu', ['draft.add', `target=${FILE}`, 'text=x', 'line=3']],
  ];
  for (const [name, args] of bad) {
    r = await say(...args);
    check('draft.add', `${name} : refusé`, refused(r, 'invalid-args') && await same(two), r.out, 'invalid-args');
  }

  // draft.edit
  r = await say('draft.edit', `id=${first?.id}`, 'text=Premiere remarque, corrigee');
  list = await remarks();
  check('draft.edit', 'change le texte, garde la cible', ok(r) && list[0]?.id === first?.id && list[0]?.text === 'Premiere remarque, corrigee' && list[0]?.target === first?.target && list.length === 2, r.out);
  const edited = list;
  for (const [name, args] of [
    ['sans texte', ['draft.edit', `id=${first?.id}`]],
    ['sans id', ['draft.edit', 'text=x']],
    ['un id qui n\'est pas un nombre', ['draft.edit', 'id=abc', 'text=x']],
    ['un texte vide', ['draft.edit', `id=${first?.id}`, 'text=   ']],
    ['un texte de plus de 5000 caractères', ['draft.edit', `id=${first?.id}`, `text=${'x'.repeat(5001)}`]],
  ]) {
    r = await say(...args);
    check('draft.edit', `${name} : refusé`, refused(r, 'invalid-args') && await same(edited), r.out, 'invalid-args');
  }
  r = await say('draft.edit', 'id=999', 'text=x');
  check('draft.edit', 'un id inconnu : refusé', refused(r, 'invalid-args') && await same(edited), r.out, 'invalid-args');

  // draft.remove
  r = await say('draft.remove', `id=${first?.id}`);
  list = await remarks();
  check('draft.remove', 'retire la remarque', ok(r) && list.length === 1 && list[0].id === second?.id, r.out);
  for (const [name, args] of [['sans id', ['draft.remove']], ['un id qui n\'est pas un nombre', ['draft.remove', 'id=abc']]]) {
    r = await say(...args);
    check('draft.remove', `${name} : refusé`, refused(r, 'invalid-args') && (await remarks()).length === 1, r.out, 'invalid-args');
  }
  r = await say('draft.remove', 'id=999');
  check('draft.remove', 'un id inconnu : refusé', refused(r, 'invalid-args') && (await remarks()).length === 1, r.out, 'invalid-args');
  r = await say('draft.remove', `id=${second?.id}`);
  check('draft.remove', 'retire la dernière remarque : le brouillon est vide', ok(r) && (await remarks()).length === 0, r.out);

  // Laisser l'appli comme trouvée : PR plus suivie, brouillon vide, branche de la note, faux gh remis à zéro.
  for (const c of await remarks()) await say('draft.remove', `id=${c.id}`);
  await say('unload-pr');
  await until(async () => (await say('status')).json?.result?.pr === null);
  setGh(app, {});
  await say('switch-branch', `branch=${BRANCH}`);
  await until(async () => (await say('status')).json?.result?.branch === BRANCH);
}
