// Les cas des artefacts : add-artifact, rename-artifact, new-artifact-file,
// new-artifact-folder, move-artifacts, copy-artifacts, duplicate-artifacts,
// trash-artifacts, copy-artifact — chacune un succès et ses refus principaux,
// chacun avec le code de la table. trash-artifacts : seulement si la
// corbeille du banc est vérifiée (trashSafe, de trash.mjs trashLanding) ;
// sinon ses cas sont en échec, la raison dite, rien n'est mis à la corbeille.
// copy-artifact, qui demande un dossier dans une fenêtre : ses refus seuls (un
// id inconnu, une autre action en cours), et compté couvert.
// Ces commandes répondent quand leur travail est fini (copy-artifact : avant sa
// fenêtre) : un refus du travail est un code d'erreur, rien ne change — un id
// inconnu, d'un élément ou d'un dossier d'arrivée (add-artifact compris) :
// unknown-artifact ; un nom refusé : invalid-args ; un nom pris, un dossier
// dans lui-même, des noms confirmés qui diffèrent, une partie refusée :
// refused. Le résultat se relit par artifacts.
// Les artefacts du banc sont tous nommés cx-… et effacés à la fin, dans le
// dossier que artifacts a rendu (le profil du banc, jamais la corbeille).
// Ne connaît pas : la corbeille (trash.mjs), l'état interne de l'appli.
// Utilisé par : tests/contract/run.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { asJson, check, cli, said, good, refused } from '../bench.mjs';

const b64 = (s) => Buffer.from(s).toString('base64');
const names = (l) => [...l.files, ...l.folders].map((x) => x.name).sort();
const ids = (list) => `artifacts=${JSON.stringify(list)}`;
const files = (list) => `files=${JSON.stringify(list)}`;

/** @param {import('../bench.mjs').App} app @param {boolean} trashSafe */
export async function artifacts(app, trashSafe) {
  const here = app.projet;
  // Une commande ; un busy (la fin de l'écriture d'avant, juste après sa réponse) est retenté.
  const send = async (...args) => {
    let r;
    for (let i = 0; i < 10; i++) { r = await asJson(args, here); if (!refused(r, 'busy')) break; await sleep(200); }
    return r;
  };
  const list = async () => (await asJson(['artifacts'], here)).json?.result ?? { dir: '', files: [], folders: [] };
  // Le relevé dès que `done` y est vrai (4 s au plus).
  const until = async (done) => {
    let l = await list();
    for (let i = 0; i < 20 && !done(l); i++) { await sleep(200); l = await list(); }
    return l;
  };
  const idOf = async (name) => { const l = await list(); return [...l.files, ...l.folders].find((x) => x.name === name)?.id; };
  const count = (l, re) => names(l).filter((n) => re.test(n)).length;
  const textOf = async (l, name) => (await asJson(['artifact', `artifact=${l.files.find((f) => f.name === name)?.id}`], here)).json?.result?.text;
  // Un refus du travail : la commande répond son code d'erreur, et le relevé relu n'a pas changé.
  const nothing = async (command, name, code, ...args) => {
    const before = names(await list());
    const r = await send(command, ...args);
    const l = await list();
    check(command, name, refused(r, code) && JSON.stringify(names(l)) === JSON.stringify(before), `${said(r)} ${before} → ${names(l)}`, code);
  };
  const badArgs = async (command, cases) => {
    for (const [what, args] of cases) {
      const r = await send(command, ...args);
      check(command, `${command} ${what} : invalid-args`, refused(r, 'invalid-args'), said(r), 'invalid-args');
    }
  };
  // Préparations (non comptées) : un fichier ou un dossier, dans un dossier (son nom dans le relevé) ou à la racine.
  const make = (command) => async (name, parent = '') => {
    await send(command, ...(parent ? [`folder=${await idOf(parent)}`] : []), `name=${name}`);
    await until((l) => names(l).includes(parent ? `${parent}/${name}` : name));
  };
  const mkfile = make('new-artifact-file');
  const mkdir = make('new-artifact-folder');

  const root = (await list()).dir;
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-contract-src-'));   // la source d'un ajout par chemin
  fs.writeFileSync(path.join(src, 'cx-src.txt'), 'depuis un chemin\n');
  try {
    // --- add-artifact
    await mkdir('cx-dir');
    let r = await send('add-artifact', files([{ name: 'cx-a.md', content: b64('# a\n') }]));
    let l = await until((x) => names(x).includes('cx-a.md'));
    check('add-artifact', 'add-artifact d\'un contenu en base64 : le fichier est là, son texte aussi',
      good(r) && (await textOf(l, 'cx-a.md')) === '# a\n', `${said(r)} ${names(l)}`);
    r = await send('add-artifact', files([{ path: path.join(src, 'cx-src.txt') }]));
    l = await until((x) => names(x).includes('cx-src.txt'));
    check('add-artifact', 'add-artifact d\'un chemin : le fichier est là', good(r) && names(l).includes('cx-src.txt'), `${said(r)} ${names(l)}`);
    r = await send('add-artifact', files([{ name: 'cx-a.md', content: b64('# autre\n') }]));
    l = await until((x) => count(x, /^cx-a/) === 2);
    check('add-artifact', 'add-artifact d\'un nom pris : jamais écrasé, le nouveau est numéroté',
      good(r) && count(l, /^cx-a/) === 2 && (await textOf(l, 'cx-a.md')) === '# a\n', `${said(r)} ${names(l)}`);
    r = await send('add-artifact', `folder=${await idOf('cx-dir')}`, files([{ name: 'cx-in.txt', content: b64('x') }]));
    l = await until((x) => names(x).includes('cx-dir/cx-in.txt'));
    check('add-artifact', 'add-artifact dans un dossier du relevé', good(r) && names(l).includes('cx-dir/cx-in.txt'), `${said(r)} ${names(l)}`);
    r = await send('add-artifact', files([
      { name: '../cx-evil.txt', content: b64('x') }, { name: 'cx-bad64.txt', content: '***' }, { name: 'cx-ok.txt', content: b64('x') }]));
    l = await until((x) => names(x).includes('cx-ok.txt'));
    check('add-artifact', 'add-artifact d\'un nom pas sûr et d\'un base64 invalide : refused, l\'autre ajouté',
      refused(r, 'refused') && names(l).includes('cx-ok.txt') && !names(l).some((n) => n.includes('evil') || n.includes('bad64')), `${said(r)} ${names(l)}`, 'refused');
    await nothing('add-artifact', 'add-artifact dans un dossier inconnu : unknown-artifact, rien d\'écrit', 'unknown-artifact',
      'folder=d999', files([{ name: 'cx-nope.txt', content: b64('x') }]));
    await badArgs('add-artifact', [['sans files', []], ['avec files qui n\'est pas une liste', ['files=oops']],
      ['avec un fichier à clé inconnue', [files([{ foo: 1 }])]]]);

    // --- rename-artifact
    await mkfile('cx-r.txt');
    r = await send('rename-artifact', ids([await idOf('cx-r.txt')]), 'name=cx-r2.txt');
    l = await until((x) => names(x).includes('cx-r2.txt'));
    check('rename-artifact', 'rename-artifact : le nouveau nom remplace l\'ancien',
      good(r) && names(l).includes('cx-r2.txt') && !names(l).includes('cx-r.txt'), `${said(r)} ${names(l)}`);
    const rid = await idOf('cx-r2.txt');
    await nothing('rename-artifact', 'rename-artifact vers un nom pris : refused, rien ne change', 'refused', ids([rid]), 'name=cx-src.txt');
    await nothing('rename-artifact', 'rename-artifact vers un nom avec / : invalid-args, rien ne change', 'invalid-args', ids([rid]), 'name=cx-x/y.txt');
    await nothing('rename-artifact', 'rename-artifact d\'un id inconnu : unknown-artifact, rien ne change', 'unknown-artifact', ids(['a999']), 'name=cx-z.txt');
    await badArgs('rename-artifact', [['sans name', [ids([rid])]], ['sans artifacts', ['name=cx-q.txt']],
      ['de deux ids', [ids([rid, await idOf('cx-src.txt')]), 'name=cx-q.txt']], ['d\'une liste vide', [ids([]), 'name=cx-q.txt']]]);

    // --- new-artifact-file
    r = await send('new-artifact-file', 'name=cx-n.txt');
    l = await until((x) => names(x).includes('cx-n.txt'));
    check('new-artifact-file', 'new-artifact-file à la racine : un fichier vide', good(r) && l.files.find((f) => f.name === 'cx-n.txt')?.size === 0, `${said(r)} ${names(l)}`);
    r = await send('new-artifact-file', `folder=${await idOf('cx-dir')}`, 'name=cx-n2.txt');
    l = await until((x) => names(x).includes('cx-dir/cx-n2.txt'));
    check('new-artifact-file', 'new-artifact-file dans un dossier du relevé', good(r) && names(l).includes('cx-dir/cx-n2.txt'), `${said(r)} ${names(l)}`);
    await nothing('new-artifact-file', 'new-artifact-file d\'un nom pris : refused, rien ne change', 'refused', 'name=cx-n.txt');
    await nothing('new-artifact-file', 'new-artifact-file d\'un nom avec / : invalid-args, rien ne change', 'invalid-args', 'name=cx-bad/n.txt');
    await nothing('new-artifact-file', 'new-artifact-file d\'un dossier inconnu : unknown-artifact, rien ne change', 'unknown-artifact', 'folder=d999', 'name=cx-n3.txt');
    await badArgs('new-artifact-file', [['sans name', []], ['avec un argument inconnu', ['name=cx-n4.txt', 'inconnu=1']]]);

    // --- new-artifact-folder
    r = await send('new-artifact-folder', 'name=cx-f1');
    l = await until((x) => names(x).includes('cx-f1'));
    check('new-artifact-folder', 'new-artifact-folder à la racine', good(r) && l.folders.some((f) => f.name === 'cx-f1'), `${said(r)} ${names(l)}`);
    r = await send('new-artifact-folder', `folder=${await idOf('cx-f1')}`, 'name=cx-sub');
    l = await until((x) => names(x).includes('cx-f1/cx-sub'));
    check('new-artifact-folder', 'new-artifact-folder dans un dossier du relevé', good(r) && l.folders.some((f) => f.name === 'cx-f1/cx-sub'), `${said(r)} ${names(l)}`);
    await nothing('new-artifact-folder', 'new-artifact-folder d\'un nom pris : refused, rien ne change', 'refused', 'name=cx-f1');
    await nothing('new-artifact-folder', 'new-artifact-folder d\'un nom qui commence par un point : invalid-args, rien ne change', 'invalid-args', 'name=.cx-hidden');
    await nothing('new-artifact-folder', 'new-artifact-folder d\'un dossier inconnu : unknown-artifact, rien ne change', 'unknown-artifact', 'folder=d999', 'name=cx-f2');
    await badArgs('new-artifact-folder', [['sans name', []]]);

    // --- move-artifacts
    await mkfile('cx-m.txt');
    r = await send('move-artifacts', ids([await idOf('cx-m.txt')]), `folder=${await idOf('cx-f1')}`);
    l = await until((x) => names(x).includes('cx-f1/cx-m.txt'));
    check('move-artifacts', 'move-artifacts vers un dossier', good(r) && names(l).includes('cx-f1/cx-m.txt') && !names(l).includes('cx-m.txt'), `${said(r)} ${names(l)}`);
    r = await send('move-artifacts', ids([await idOf('cx-f1/cx-m.txt')]));
    l = await until((x) => names(x).includes('cx-m.txt'));
    check('move-artifacts', 'move-artifacts sans dossier : à la racine', good(r) && names(l).includes('cx-m.txt') && !names(l).includes('cx-f1/cx-m.txt'), `${said(r)} ${names(l)}`);
    await mkfile('cx-m.txt', 'cx-f1');
    r = await send('move-artifacts', ids([await idOf('cx-m.txt')]), `folder=${await idOf('cx-f1')}`);
    l = await until((x) => count(x, /^cx-f1\/cx-m/) === 2);
    check('move-artifacts', 'move-artifacts d\'un nom pris : le premier numéro libre',
      good(r) && count(l, /^cx-f1\/cx-m/) === 2 && !names(l).includes('cx-m.txt'), `${said(r)} ${names(l)}`);
    await nothing('move-artifacts', 'move-artifacts d\'un dossier dans lui-même : refused, rien ne change', 'refused', ids([await idOf('cx-f1')]), `folder=${await idOf('cx-f1/cx-sub')}`);
    await nothing('move-artifacts', 'move-artifacts d\'un id inconnu : unknown-artifact, rien ne change', 'unknown-artifact', ids(['a999']), `folder=${await idOf('cx-f1')}`);
    await nothing('move-artifacts', 'move-artifacts vers un dossier inconnu : unknown-artifact, rien ne change', 'unknown-artifact', ids([await idOf('cx-f1/cx-m.txt')]), 'folder=d999');
    await badArgs('move-artifacts', [['sans artifacts', ['folder=d0']], ['avec artifacts qui n\'est pas une liste', ['artifacts=oops']]]);

    // --- copy-artifacts
    await mkfile('cx-c.txt');
    r = await send('copy-artifacts', ids([await idOf('cx-c.txt')]), `folder=${await idOf('cx-f1')}`);
    l = await until((x) => names(x).includes('cx-f1/cx-c.txt'));
    check('copy-artifacts', 'copy-artifacts vers un dossier : la copie, l\'original reste', good(r) && names(l).includes('cx-f1/cx-c.txt') && names(l).includes('cx-c.txt'), `${said(r)} ${names(l)}`);
    r = await send('copy-artifacts', ids([await idOf('cx-c.txt')]), `folder=${await idOf('cx-f1')}`);
    l = await until((x) => count(x, /^cx-f1\/cx-c/) === 2);
    check('copy-artifacts', 'copy-artifacts d\'un nom pris : le premier numéro libre', good(r) && count(l, /^cx-f1\/cx-c/) === 2, `${said(r)} ${names(l)}`);
    r = await send('copy-artifacts', ids([await idOf('cx-f1/cx-c.txt')]));
    l = await until((x) => count(x, /^cx-c/) === 2);
    check('copy-artifacts', 'copy-artifacts sans dossier : à la racine, numéroté', good(r) && count(l, /^cx-c/) === 2, `${said(r)} ${names(l)}`);
    await nothing('copy-artifacts', 'copy-artifacts d\'un id inconnu : unknown-artifact, rien ne change', 'unknown-artifact', ids(['a999']));
    await nothing('copy-artifacts', 'copy-artifacts vers un dossier inconnu : unknown-artifact, rien ne change', 'unknown-artifact', ids([await idOf('cx-c.txt')]), 'folder=d999');
    await badArgs('copy-artifacts', [['sans artifacts', []]]);

    // --- duplicate-artifacts
    await mkfile('cx-dup.txt');
    r = await send('duplicate-artifacts', ids([await idOf('cx-dup.txt')]));
    l = await until((x) => count(x, /^cx-dup/) === 2);
    check('duplicate-artifacts', 'duplicate-artifacts d\'un fichier : une copie numérotée', good(r) && count(l, /^cx-dup/) === 2, `${said(r)} ${names(l)}`);
    r = await send('duplicate-artifacts', ids([await idOf('cx-f1')]));
    l = await until((x) => count(x, /^cx-f1[^/]*$/) === 2);
    check('duplicate-artifacts', 'duplicate-artifacts d\'un dossier : une copie numérotée', good(r) && count(l, /^cx-f1[^/]*$/) === 2, `${said(r)} ${names(l)}`);
    await nothing('duplicate-artifacts', 'duplicate-artifacts d\'un id inconnu : unknown-artifact, rien ne change', 'unknown-artifact', ids(['a999']));
    await badArgs('duplicate-artifacts', [['sans artifacts', []]]);

    // --- trash-artifacts : seulement si la corbeille du banc est celle du profil temporaire
    if (!trashSafe) {
      const why = 'la corbeille du banc n\'est pas isolée (trash.mjs) : trash-artifacts n\'est pas appelée, rien n\'est mis à la corbeille';
      for (const name of ['trash-artifacts : un fichier et un dossier à la corbeille', 'trash-artifacts avec des noms qui ne correspondent pas : rien ne part',
        'trash-artifacts sans names : invalid-args']) check('trash-artifacts', name, false, why);
    } else {
      await mkfile('cx-t.txt');
      r = await send('trash-artifacts', ids([await idOf('cx-t.txt'), await idOf('cx-f1')]), `names=${JSON.stringify(['cx-t.txt', 'cx-f1'])}`);
      l = await until((x) => !names(x).includes('cx-t.txt') && !names(x).includes('cx-f1'));
      check('trash-artifacts', 'trash-artifacts d\'un fichier et d\'un dossier : ils quittent le relevé',
        good(r) && !names(l).includes('cx-t.txt') && !names(l).includes('cx-f1'), `${said(r)} ${names(l)}`);
      await mkfile('cx-t2.txt');
      const tid = await idOf('cx-t2.txt');
      await nothing('trash-artifacts', 'trash-artifacts de noms qui ne correspondent pas : refused, rien ne part', 'refused', ids([tid]), 'names=["autre.txt"]');
      await nothing('trash-artifacts', 'trash-artifacts de moins de noms que d\'ids : refused, rien ne part', 'refused', ids([tid]), 'names=[]');
      await nothing('trash-artifacts', 'trash-artifacts d\'un id inconnu : unknown-artifact, rien ne part', 'unknown-artifact', ids(['a999']), 'names=["cx-t2.txt"]');
      await badArgs('trash-artifacts', [['sans names', [ids([tid])]], ['sans artifacts', ['names=["cx-t2.txt"]']]]);
    }

    // --- copy-artifact : sa fenêtre ne s'ouvre jamais ici, un id inconnu ou une course tenue la précèdent
    r = await send('copy-artifact', 'artifacts=["a999"]');
    check('copy-artifact', 'copy-artifact d\'un id inconnu : unknown-artifact, avant sa fenêtre', refused(r, 'unknown-artifact'), said(r), 'unknown-artifact');
    await badArgs('copy-artifact', [['sans artifacts', []], ['avec artifacts qui n\'est pas une liste', ['artifacts=oops']]]);
    const started = await cli(['run', 'start', 'forme'], here);
    if (started.code !== 0) check('copy-artifact', 'copy-artifact pendant une course : préparation, run start forme', false, said(started));
    else {
      r = await asJson(['copy-artifact', 'artifacts=["a999"]'], here);   // un id inconnu : sans la retenue, il est refusé avant la fenêtre
      check('copy-artifact', 'copy-artifact pendant une course : busy', refused(r, 'busy'), said(r), 'busy');
      const ended = await cli(['run', 'wait', 'forme'], here);
      check('copy-artifact', 'copy-artifact : la course tenue finit', ended.code === 0, said(ended));
    }
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    if (root && fs.existsSync(root)) for (const e of fs.readdirSync(root)) if (e.startsWith('cx-')) fs.rmSync(path.join(root, e), { recursive: true, force: true });
    await list();   // le relevé suit le disque
  }
}
