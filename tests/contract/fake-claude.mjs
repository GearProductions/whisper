// Un faux Claude Code pour le banc de contrat (tests/contract/run.mjs) : juste
// assez du flux stream-json du SDK sur stdin/stdout. Une demande de contrôle
// (initialisation, mode, modèle…) reçoit un succès vide ; chaque message reçu
// ouvre un tour, qui finit par un résultat. Le premier tour appelle
// `vibecoder status` avec l'environnement reçu (la porte robot : port et jeton
// de l'appli) et note la sortie dans CONTRACT_NOTE ; un tour « forme » dure
// HOLD_MS (ou jusqu'à une interruption), pour qu'une seconde course attende.
// Ne connaît pas : l'appli, le contrat vérifié (le banc relit la note).
// Utilisé par : tests/contract/run.mjs (agentCommand de config.json).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';

const HOLD_MS = 4000;
const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
let first = true;
let release = () => {};
let tour = Promise.resolve();   // les tours se suivent : un message reçu pendant un tour attend

const statusAsRobot = () => new Promise((done) => {
  execFile(process.execPath, [process.env.CONTRACT_CLI, 'status'], { env: process.env }, (error, stdout, stderr) => {
    fs.writeFileSync(process.env.CONTRACT_NOTE, JSON.stringify({ code: error ? error.code : 0, stdout, stderr }));
    done();
  });
});

async function answer(text) {
  if (first) { first = false; await statusAsRobot(); }
  if (text.includes('/vibecoder:forme')) await new Promise((r) => { release = r; setTimeout(r, HOLD_MS); });
  send({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: 's1' });
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line);
  if (m.type === 'control_request') {
    if (m.request.subtype === 'interrupt') release();
    send({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: {} } });
  } else if (m.type === 'user') {
    const text = typeof m.message.content === 'string' ? m.message.content : JSON.stringify(m.message.content);
    send({ type: 'system', subtype: 'init', session_id: 's1' });
    tour = tour.then(() => answer(text));
  }
});
