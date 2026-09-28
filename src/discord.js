/* =========================================================================
   Whisper — couper le micro Discord pendant la dictée (Linux)

   En appel Discord, dicter enverrait sa voix à tout le salon. Le temps de
   l'enregistrement, on coupe le FLUX de capture de Discord au niveau de
   PipeWire (via `wpctl`, livré avec WirePlumber), puis on le rétablit.

   Pas le micro du système : whisper enregistre sur le même, il n'entendrait
   plus rien. Pas non plus le bouton « muet » de Discord : un micro déjà coupé
   dans Discord le reste. Et on ne rétablit que les flux qu'on a nous-mêmes
   coupés : un flux déjà muet avant la dictée reste muet après.
   ========================================================================= */

const { execFile } = require('child_process');

const DISCORD_RE = /discord/i;

// stdout, ou null si wpctl est absent ou échoue.
function wpctl(args) {
  return new Promise((resolve) => {
    execFile('wpctl', args, { timeout: 2000 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

// Identifiants listés sous les rubriques « Streams: » de `wpctl status` (flux
// et leurs ports) ; l'inspection fait le tri.
function streamIds(status) {
  const ids = [];
  let inStreams = false;
  for (const line of String(status || '').split('\n')) {
    const bare = line.replace(/[\s│├└─]/g, '');
    if (/Streams:$/.test(bare)) { inStreams = true; continue; }
    if (!bare || bare.endsWith(':')) { inStreams = false; continue; }
    const m = inStreams && line.match(/^[\s│├└─]*(\d+)\.\s/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

// Flux de capture AUDIO ouverts par Discord (il n'en a qu'en appel ; son
// partage d'écran est un flux vidéo, écarté). Reconnu à son binaire
// (« Discord ») ou à son identifiant Flatpak (com.discordapp.Discord) : son
// nom de flux, « WEBRTC VoiceEngine », ne le désigne pas.
async function isDiscordInput(id) {
  const out = await wpctl(['inspect', id]);
  if (!out) return false;
  const props = {};
  for (const m of out.matchAll(/^\s*\*?\s*([\w.-]+) = "(.*)"$/gm)) props[m[1]] = m[2];
  return props['media.class'] === 'Stream/Input/Audio'
    && [props['application.process.binary'], props['pipewire.access.portal.app_id']]
      .some((v) => DISCORD_RE.test(v || ''));
}

async function discordInputs() {
  const ids = streamIds(await wpctl(['status']));
  const keep = await Promise.all(ids.map(isDiscordInput));
  return ids.filter((_id, i) => keep[i]);
}

let muted = [];                  // flux que NOUS avons coupés
let queue = Promise.resolve();   // dans l'ordre : un relâché rapide attend la coupure

// Résout le nombre de flux dont PipeWire CONFIRME la coupure (relu après coup) :
// c'est ce qui décide d'afficher « Micro Discord coupé ».
async function doMute() {
  let confirmed = 0;
  for (const id of await discordInputs()) {
    const volume = await wpctl(['get-volume', id]);
    if (volume === null || volume.includes('[MUTED]')) continue; // déjà muet : on n'y touche pas
    if (await wpctl(['set-mute', id, '1']) === null) continue;
    muted.push(id);
    if (String(await wpctl(['get-volume', id])).includes('[MUTED]')) confirmed++;
  }
  return confirmed;
}

async function doRestore() {
  const ids = muted;
  muted = [];
  // Un flux disparu entre-temps (appel quitté) fait échouer wpctl : sans importance.
  for (const id of ids) await wpctl(['set-mute', id, '0']);
}

const run = (fn) => (queue = queue.then(fn, fn));

function mute() { return process.platform === 'linux' ? run(doMute) : Promise.resolve(0); }
function restore() { return run(doRestore); }

module.exports = { mute, restore };
