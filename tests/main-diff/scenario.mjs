// Le scénario du banc du principal (cf. run.mjs) : pilote une appli lancée
// avec --remote-debugging-port, par CDP, et écrit ce qu'elle fait (JSON) sur la
// sortie. Usage : node scenario.mjs <port> <fichier WAV 16 kHz mono>
// Après la dictée : les boutons du contrat de VibeCoder (vibeRun, vibeRunOp,
// vibeProcess, vibeDrop), sans agent lancé, sur le projet git du profil
// (run.mjs) ; le relevé que la page reçoit (onVibe, heures retirées) dit ce
// qu'ils ont fait. Ni corbeille ni Copier dans le projet : le système, une
// boîte de dialogue. Le brouillon de revue exige une PR GitHub : ses variants.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const [PORT, WAV] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
  return { ev, send, errors, close: () => ws.close() };
}
const find = async (part) => { for (let i = 0; i < 60; i++) { const t = (await targets()).find((x) => x.url.includes(part)); if (t) return t; await sleep(250); } throw new Error(`page absente : ${part}`); };
let out = {};
const panel = await connect(await find('panel/conversation.html'));
await sleep(2000);
const robots = `[...document.querySelectorAll('.vc-agents .vc-agent')]`;
out.demarrage = {
  robots: await panel.ev(`${robots}.length`),
  affiche: await panel.ev(`${robots}.map((b) => b.querySelector('.vc-agent-name')?.textContent ?? '').join(' | ')`),
  conversation: await panel.ev(`document.querySelector('.vc-conv-name')?.textContent ?? null`),
  config: await panel.ev(`window.conv.getConfig()`),
};
await panel.ev(`window.conv.setRecording(true)`); await sleep(200); await panel.ev(`window.conv.setRecording(false)`);
const pcm = JSON.stringify([...readFileSync(WAV).subarray(44)]);
// La transcription est rendue à la page, qui l'insère dans son champ : rien n'est collé ni envoyé.
out.dictee = await panel.ev(`window.conv.transcribe(new Uint8Array(${pcm}).buffer)`);
out.tropCourt = await panel.ev(`window.conv.transcribe(new Uint8Array(100).buffer)`);
out.panneau = {
  champ: await panel.ev(`document.querySelector('#message').value`),
  historique: await panel.ev(`window.conv.history()`),
  envoiVide: await panel.ev(`window.conv.send({ text: '', images: [], files: [], selection: '' })`),
  jauge: await panel.ev(`document.querySelector('#context-button')?.dataset.level ?? null`),
};
out.ecouterSansReponse = await panel.ev(`window.conv.speak(0)`);
out.lienRefuse = await panel.ev(`window.conv.openLink('file:///etc/passwd')`) ?? 'ignoré';
out.agentInconnu = await panel.ev(`window.conv.showAgent('/etc')`) ?? 'ignoré';

// --- Les boutons du contrat ---------------------------------------------------
// Le dernier relevé reçu par la page (window.__v), sans ses heures ; un relevé
// neuf demandé jusqu'à ce que `until` le valide (sinon le dernier : l'écart se verra).
await panel.ev(`window.__v = null; window.conv.onVibe((v) => { window.__v = v; })`);
const noTime = (_k, v) => (_k === 'time' || _k === 'since' ? undefined : v);
async function view(until = () => true) {
  let v = null;
  for (let i = 0; i < 25; i++) {
    await panel.ev(`window.conv.vibeRefresh()`); await sleep(400);
    v = JSON.parse(await panel.ev(`JSON.stringify(window.__v)`));
    if (v && until(v)) break;
  }
  return v;
}
const call = (expr) => panel.ev(`(${expr}) ?? 'ignoré'`);
const run = (action, args) => call(`window.conv.vibeRun(${JSON.stringify(action)}, ${JSON.stringify(args)})`);
const tree = (v) => ({
  dossiers: v.artifactDirs.map((d) => d.name).sort(),
  fichiers: v.artifacts.map((a) => `${a.name} (${a.size})`).sort(),
});
const idOf = (v, name) => (v.artifacts.find((a) => a.name === name) ?? v.artifactDirs.find((d) => d.name === name))?.id;
// Les actions directes qui ont un résultat (ou tournent) : leur ligne.
const directes = (v) => Object.fromEntries(v.actions.filter((a) => a.direct?.running || a.direct?.last)
  .map((a) => [a.id, { running: a.direct.running, ok: a.direct.last?.ok, line: a.direct.last?.line }]));
const lastOf = (v, id) => v.actions.find((a) => a.id === id)?.direct;
// Une action directe : la réponse du bouton, puis sa ligne de résultat au relevé (finie, plus récente que la précédente).
async function direct(id, args) {
  const before = lastOf(await view(), id)?.last?.time ?? 0;
  const answer = await run(id, { direct: true, ...args });
  if (!answer.ok) return { answer };   // refusée : rien ne tourne
  const v = await view((x) => { const d = lastOf(x, id); return d && !d.running && d.last && d.last.time > before; });
  const { ok, line, detail } = lastOf(v, id)?.last ?? {};
  return { answer, resultat: { ok, line, detail } };
}

// Le projet : deux artefacts, écrits dans le dossier que l'appli désigne.
let v = await view((x) => x.artifactsDir);
mkdirSync(v.artifactsDir, { recursive: true });
writeFileSync(path.join(v.artifactsDir, 'notes.md'), '# notes\n');
writeFileSync(path.join(v.artifactsDir, 'donnees.txt'), 'a,b\n');
v = await view((x) => x.artifacts.length === 2);
out.vibeDepart = {
  depot: v.repo, branches: v.branches, flow: v.flow, erreur: v.error, projectFile: v.projectFile,
  processus: v.processes.map((p) => `${p.name} : ${p.run} (${p.status})`), explorateur: tree(v), courses: v.runs,
};

// Refus : rien ne part (ni agent ni commande), la réponse du bouton dit pourquoi.
out.vibeRefus = {
  actionInconnue: await run('nope', {}),
  argumentsFautifs: await run('new-request', 42),
  brancheInconnue: await run('switch-branch', { direct: true, branch: 'inconnue' }),
  texteVide: await run('new-request', {}),
  texteNonTexte: await run('new-request', { text: 42 }),
  texteTropLong: await run('new-request', { text: 'x'.repeat(20001) }),
  actionGriseeAgent: await run('forme', {}),
  actionGriseeDirecte: await run('pull', { direct: true }),
  depotParLeCanalDesActions: await run('add-artifact', { direct: true }),
  corbeilleNomsDifferents: await run('trash-artifacts', { direct: true, artifacts: [idOf(v, 'notes.md')], names: ['autre.md'] }),
  copierArtefactInconnu: await run('copy-artifact', { direct: true, artifacts: ['a99'] }),
};
v = await view();
out.vibeRefus.apres = { directes: directes(v), courses: v.runs };

// Des actions directes sans effet risqué : la ligne de résultat.
out.vibeDirectes = {
  stash: await direct('stash'),
  fetch: await direct('fetch'),
};

// Une course qui n'existe pas : rien ne bouge.
for (const op of ['stop', 'keep', 'undo', 'allow', 'always', 'deny']) await call(`window.conv.vibeRunOp('inconnue', ${JSON.stringify(op)})`);
await call(`window.conv.vibeRunOp(42, 'stop')`); await call(`window.conv.vibeRunOp('inconnue', 'nope')`);
out.vibeCourses = { courses: (await view()).runs };

// Les processus : lancer, relancer (un autre lancement : l'heure change), arrêter.
const proc = (x) => x.processes[0];
await call(`window.conv.vibeProcess('start', 0)`);
const started = await view((x) => proc(x).status === 'running');
await sleep(1100);   // l'heure de lancement est à la seconde près
await call(`window.conv.vibeProcess('restart', 0)`);
const restarted = await view((x) => proc(x).status === 'running' && proc(x).since !== proc(started).since);
await call(`window.conv.vibeProcess('stop', 0)`);
const stopped = await view((x) => proc(x).status !== 'running');
await call(`window.conv.vibeProcess('start', 7)`);   // un rang inconnu : rien
await call(`window.conv.vibeProcess('nope', 0)`);
out.vibeProcessus = {
  start: { status: proc(started).status, exit: proc(started).exit },
  restart: { status: proc(restarted).status, relance: proc(restarted).since !== proc(started).since },
  stop: { status: proc(stopped).status, exit: proc(stopped).exit },
  rangInconnu: (await view()).processes.map((p) => p.status),
};

// L'explorateur : chaque geste, sa réponse et sa ligne, puis l'arbre des artefacts.
const explorer = {};
explorer.nouveauDossier = await direct('new-artifact-folder', { name: 'dossier' });
explorer.nouveauFichier = await direct('new-artifact-file', { name: 'nouveau.txt' });
explorer.nomPris = await direct('new-artifact-file', { name: 'nouveau.txt' });
explorer.nomInvalide = await direct('new-artifact-file', { name: '../evade.txt' });
v = await view((x) => idOf(x, 'nouveau.txt') && idOf(x, 'dossier'));
explorer.renommer = await direct('rename-artifact', { artifacts: [idOf(v, 'nouveau.txt')], name: 'renomme.txt' });
explorer.renommerPlusieurs = await direct('rename-artifact', { artifacts: [idOf(v, 'notes.md'), idOf(v, 'donnees.txt')], name: 'x.txt' });
v = await view((x) => idOf(x, 'renomme.txt'));
explorer.dupliquer = await direct('duplicate-artifacts', { artifacts: [idOf(v, 'renomme.txt')] });
explorer.deplacer = await direct('move-artifacts', { artifacts: [idOf(v, 'notes.md')], folder: idOf(v, 'dossier') });
explorer.coller = await direct('copy-artifacts', { artifacts: [idOf(v, 'donnees.txt')], folder: idOf(v, 'dossier') });
explorer.deplacerDansSoi = await direct('move-artifacts', { artifacts: [idOf(v, 'dossier')], folder: idOf(v, 'dossier') });
explorer.idInconnu = await direct('duplicate-artifacts', { artifacts: ['a99'] });
explorer.arbre = tree(await view((x) => x.artifacts.length === 5));
out.vibeExplorateur = explorer;

// Déposer : un vrai fichier (un File lu par le pont, obtenu par DOM.setFileInputFiles), puis un File sans chemin.
const depot = mkdtempSync(path.join(tmpdir(), 'whisper-main-diff-depot-'));
writeFileSync(path.join(depot, 'depose.txt'), 'depose\n');
await panel.ev(`(() => { const i = document.createElement('input'); i.type = 'file'; i.id = 'depot'; document.body.append(i); })()`);
const { result: { root } } = await panel.send('DOM.getDocument');
const { result: { nodeId } } = await panel.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#depot' });
await panel.send('DOM.setFileInputFiles', { nodeId, files: [path.join(depot, 'depose.txt')] });
v = await view();
const drop = async (expr) => {
  const before = lastOf(v, 'add-artifact')?.last?.time ?? 0;
  const answer = await call(expr);
  if (!answer.ok) return { answer };
  v = await view((x) => { const d = lastOf(x, 'add-artifact'); return d && !d.running && d.last && d.last.time > before; });
  const { ok, line, detail } = lastOf(v, 'add-artifact')?.last ?? {};
  return { answer, resultat: { ok, line, detail } };
};
out.vibeDepot = {
  fichierReel: await drop(`window.conv.vibeDrop([...document.querySelector('#depot').files], ${JSON.stringify(idOf(v, 'dossier'))})`),
  fichierSansChemin: await drop(`window.conv.vibeDrop([new File(['x'], 'sans-chemin.txt')])`),
  dossierInconnu: await drop(`window.conv.vibeDrop([...document.querySelector('#depot').files], 'd99')`),
  rienDepose: await drop(`window.conv.vibeDrop([])`),
  arbre: tree(await view()),
};
await panel.ev(`document.querySelector('#depot').remove()`);
rmSync(depot, { recursive: true, force: true });
// Ce que le système de fichiers a de nouveau, par le chemin de dépôt ; retiré du relevé.
out = JSON.parse(JSON.stringify(out).replaceAll(depot, '<depot>'));
out.erreurs = { panel: panel.errors };
console.log(JSON.stringify(out));
panel.close();
