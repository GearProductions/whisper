/* =========================================================================
   Whisper — lecture à voix haute par Chatterbox (GPU), via son service local

   Le service (dossier chatterbox/ : conteneur podman lancé par systemd)
   écoute sur 127.0.0.1:8004. Il répond par des trames [longueur u32 LE][PCM
   16 bits mono], une par morceau de texte, au fil de la génération ; la
   fréquence est dans l'en-tête X-Sample-Rate. Interrompre la requête arrête
   la génération.
   ========================================================================= */

const BASE = 'http://127.0.0.1:8004';

const running = new Map(); // id -> AbortController

// État du service, pour le menu : true (répond), false (injoignable).
async function isUp(timeoutMs = 300) {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch { return false; }
}

// Charge modèle et voix d'avance. Résout false si le service est injoignable.
function warmUp(lang, voice) {
  return fetch(`${BASE}/warm`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang, voice }),
  }).then(() => true, () => false);
}

// `onEnd(code)` une fois : null (fini ou annulé), 'unreachable' (service
// arrêté, ou en erreur avant toute lecture — modèle impossible à charger… :
// rien n'a été lu, l'appelant peut passer à un autre moteur) ou 'failed'.
async function speak(id, text, lang, voice, onChunk, onEnd) {
  const ctrl = new AbortController();
  running.set(id, ctrl);
  let res;
  try {
    res = await fetch(`${BASE}/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, lang, voice }), signal: ctrl.signal,
    });
  } catch (err) {
    running.delete(id);
    onEnd(ctrl.signal.aborted ? null : 'unreachable');
    return;
  }
  if (!res.ok) {
    running.delete(id);
    console.error(`chatterbox : HTTP ${res.status} ${await res.text().catch(() => '')}`);
    onEnd('unreachable');
    return;
  }
  const rate = Number(res.headers.get('x-sample-rate')) || 24000;
  let buf = Buffer.alloc(0);
  try {
    for await (const data of res.body) {
      buf = Buffer.concat([buf, data]);
      while (buf.length >= 4 && buf.length >= 4 + buf.readUInt32LE(0)) {
        const size = buf.readUInt32LE(0);
        onChunk(Buffer.from(buf.subarray(4, 4 + size)), rate);
        buf = buf.subarray(4 + size);
      }
    }
    onEnd(null);
  } catch (err) {
    onEnd(ctrl.signal.aborted ? null : 'failed');
  } finally {
    running.delete(id);
  }
}

function cancel(id) {
  const ctrl = running.get(id);
  if (ctrl) ctrl.abort();
}

module.exports = { isUp, warmUp, speak, cancel };
