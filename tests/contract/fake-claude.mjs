// Un faux Claude Code pour le banc de contrat (tests/contract/run.mjs) : juste
// assez du flux stream-json du SDK sur stdin/stdout. Une demande de contrôle
// (initialisation, mode, modèle…) reçoit un succès vide ; chaque message reçu
// ouvre un tour, qui finit par un résultat. Le premier tour appelle
// `vibecoder status` avec l'environnement reçu (la porte robot : port et jeton
// de l'appli) et note dans CONTRACT_NOTE sa sortie, ce port et ce jeton ; un tour « forme » dure
// HOLD_MS (ou jusqu'à une interruption), pour qu'une seconde course attende ;
// un tour « ponytail » simule un refus d'outil (un tool_use Bash, son
// tool_result en erreur au texte d'un refus de Claude Code), puis finit par un
// succès ; tout autre tour (la conversation : vibe, guide, new-request,
// propose-run) répond « ok ».
// Ne connaît pas : l'appli, le contrat vérifié (le banc relit la note).
// Utilisé par : tests/contract/bench.mjs (agentCommand de config.json).
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
    const { VIBECODER_PORT: port, VIBECODER_TOKEN: token } = process.env;
    fs.writeFileSync(process.env.CONTRACT_NOTE, JSON.stringify({ code: error ? error.code : 0, stdout, stderr, port, token }));
    done();
  });
});

// Un appel d'outil Bash et son résultat, comme le SDK les émet (un message assistant, un message user).
const bash = (id, command, denied) => {
  send({ type: 'assistant', session_id: 's1', message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
  const content = denied ? `Permission to use Bash with command ${command} has been denied.` : 'ok';
  send({ type: 'user', session_id: 's1', message: { content: [{ type: 'tool_result', tool_use_id: id, content, ...(denied && { is_error: true }) }] } });
};

async function answer(text) {
  if (first) { first = false; await statusAsRobot(); }
  if (text.includes('/vibecoder:forme')) await new Promise((r) => { release = r; setTimeout(r, HOLD_MS); });
  if (text.includes('/vibecoder:ponytail')) { bash('tu1', 'git push', true); bash('tu2', 'git status', false); }
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
