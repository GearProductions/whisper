// Le scénario du banc du principal (cf. run.mjs) : pilote une appli lancée
// avec --remote-debugging-port, par CDP, et écrit ce qu'elle fait (JSON) sur la
// sortie. Usage : node scenario.mjs <port> <fichier WAV 16 kHz mono>
import { readFileSync } from 'node:fs';
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
const out = {};
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
out.erreurs = { panel: panel.errors };
console.log(JSON.stringify(out));
panel.close();
