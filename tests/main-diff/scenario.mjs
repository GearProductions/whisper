// Le scénario du banc du principal (cf. run.mjs) : pilote une appli lancée
// avec --remote-debugging-port, par CDP, et écrit ce qu'elle fait (JSON) sur la
// sortie. Usage : node scenario.mjs <port> <fichier WAV 16 kHz mono>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  return { ev, errors, close: () => ws.close() };
}
const find = async (part) => { for (let i = 0; i < 60; i++) { const t = (await targets()).find((x) => x.url.includes(part)); if (t) return t; await sleep(250); } throw new Error(`page absente : ${part}`); };
const WL_PASTE = ['/run/host/usr/bin/wl-paste', 'wl-paste'];
const clip = () => {
  for (const cli of WL_PASTE) { try { return execFileSync(cli, ['--no-newline'], { timeout: 2000 }).toString(); } catch { /* suivant */ } }
  return null;
};
const out = {};
const icon = await connect(await find('icon/index.html'));
const bubble = await connect(await find('bubble/bubble.html'));
await sleep(800);
out.demarrage = {
  robots: await icon.ev(`document.querySelectorAll('.agent').length`),
  selectionne: await icon.ev(`document.querySelector('.agent').dataset.selected`),
  infobulle: await icon.ev(`document.querySelector('#icon').title`),
  lecture: await icon.ev(`document.querySelector('#app').dataset.tts`),
  bulle: await bubble.ev(`!!document.querySelector('#bubble #text')`),
  position: await icon.ev(`window.api.getBounds().then((b) => b && [b.width, b.height])`),
  config: await icon.ev(`window.api.getConfig()`),
};
out.lectureCoupee = await icon.ev(`window.api.speak()`);
await icon.ev(`window.api.setRecording(true)`); await sleep(200); await icon.ev(`window.api.setRecording(false)`);
await icon.ev(`window.api.agentClick('a1')`); await sleep(300);
out.selection = { infobulle: await icon.ev(`document.querySelector('#icon').title`), selectionne: await icon.ev(`document.querySelector('.agent').dataset.selected`) };
const pcm = JSON.stringify([...readFileSync(WAV).subarray(44)]);
out.dicteeAgent = await icon.ev(`window.api.transcribe(new Uint8Array(${pcm}).buffer)`);
const panel = await connect(await find('panel/conversation.html'));
await sleep(1000);
out.panneauAgent = {
  titre: await panel.ev(`document.querySelector('#title').textContent`),
  sous: await panel.ev(`document.querySelector('#sub').textContent.replace(/\\/tmp\\/[^/]+/, '<tmp>')`),
  champ: await panel.ev(`document.querySelector('#message').value`),
  focus: await panel.ev(`document.activeElement && document.activeElement.id`),
  historique: await panel.ev(`window.conv.history()`),
  copier: await panel.ev(`window.conv.copy()`),
  envoiVide: await panel.ev(`window.conv.send({ text: '', images: [], files: [], selection: '' })`),
  jauge: await panel.ev(`document.querySelector('#context-button').dataset.level`),
};
await icon.ev(`window.api.agentClick('a1')`); await sleep(800);
out.panneauDictee = await panel.ev(`[document.querySelector('#app').dataset.view, document.querySelector('#title').textContent, document.querySelector('#composer').hidden].join(' | ')`);
out.horsAgent = await panel.ev(`window.conv.send({ text: 'x', images: [], files: [], selection: '' })`);
out.dicteeCurseur = await icon.ev(`window.api.transcribe(new Uint8Array(${pcm}).buffer)`);
await sleep(800);
const board = clip();
out.presseAres = board === null ? 'illisible' : board === out.dicteeCurseur.text;
out.panneauTexte = await panel.ev(`document.querySelector('.message .body').textContent`);
out.copierDictee = await panel.ev(`window.conv.copy()`);
out.infobulleApres = await icon.ev(`document.querySelector('#icon').title`);
out.trop_court = await icon.ev(`window.api.transcribe(new Uint8Array(100).buffer)`);
out.lienRefuse = await panel.ev(`window.conv.openLink('file:///etc/passwd')`) ?? 'ignoré';
out.erreurs = { icon: icon.errors, bubble: bubble.errors, panel: panel.errors };
console.log(JSON.stringify(out));
for (const c of [icon, bubble, panel]) c.close();
