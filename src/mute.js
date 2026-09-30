/* =========================================================================
   Whisper — couper du son pendant la dictée

   Deux cibles, coupées le temps de l'enregistrement puis rétablies :

   - 'discord' : le FLUX DE CAPTURE de Discord. En appel, dicter enverrait sa
     voix à tout le salon. Pas le micro du système (whisper enregistre sur le
     même), ni le bouton « muet » de Discord (un micro déjà coupé dans Discord
     le reste).
   - 'others' : les FLUX DE LECTURE des autres applications. Sur haut-parleurs,
     une vidéo ou un appel seraient captés par le micro et transcrits avec la
     dictée. Pas la sortie entière : les bips de l'appli restent audibles (ses
     propres flux sont écartés par leur processus).

   Dans les deux cas, on ne rétablit que ce qu'on a coupé : un flux déjà muet
   avant la dictée le reste après.

   - Linux : au niveau de PipeWire (via `wpctl`, livré avec WirePlumber) ;
   - Windows : les sessions audio des applications, par l'API Core Audio de
     l'assistant PowerShell (cf. windows.js, windows-helper.ps1).
   ========================================================================= */

const { execFile } = require('child_process');
const windows = require('./windows');

const DISCORD_RE = /discord/i;

/* ---- Linux (PipeWire) ---------------------------------------------------- */

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

// Propriétés d'un objet PipeWire, ou null.
async function inspect(id) {
  const out = await wpctl(['inspect', id]);
  if (!out) return null;
  const props = {};
  for (const m of out.matchAll(/^\s*\*?\s*([\w.-]+) = "(.*)"$/gm)) props[m[1]] = m[2];
  return props;
}

// Ce qu'on coupe, par cible. `own` : les processus de l'appli (Set de pid).
const WANTED = {
  // Flux de capture AUDIO de Discord (il n'en a qu'en appel ; son partage
  // d'écran est un flux vidéo, écarté). Reconnu à son binaire (« Discord ») ou
  // à son identifiant Flatpak (com.discordapp.Discord) : son nom de flux,
  // « WEBRTC VoiceEngine », ne le désigne pas.
  discord: (p) => p['media.class'] === 'Stream/Input/Audio'
    && [p['application.process.binary'], p['pipewire.access.portal.app_id']].some((v) => DISCORD_RE.test(v || '')),
  // Flux de lecture AUDIO de toutes les applications, sauf les nôtres.
  others: (p, own) => p['media.class'] === 'Stream/Output/Audio' && !own.has(Number(p['application.process.id'])),
};

async function wantedStreams(target, own) {
  const ids = streamIds(await wpctl(['status']));
  const props = await Promise.all(ids.map(inspect));
  return ids.filter((_id, i) => props[i] && WANTED[target](props[i], own));
}

const muted = { discord: [], others: [] }; // flux que NOUS avons coupés

// Résout le nombre de flux dont PipeWire CONFIRME la coupure (relu après coup).
async function muteLinux(target, own) {
  let confirmed = 0;
  for (const id of await wantedStreams(target, own)) {
    const volume = await wpctl(['get-volume', id]);
    if (volume === null || volume.includes('[MUTED]')) continue; // déjà muet : on n'y touche pas
    if (await wpctl(['set-mute', id, '1']) === null) continue;
    muted[target].push(id);
    if (String(await wpctl(['get-volume', id])).includes('[MUTED]')) confirmed++;
  }
  return confirmed;
}

async function restoreLinux(target) {
  const ids = muted[target];
  muted[target] = [];
  // Un flux disparu entre-temps (appel quitté, vidéo fermée) fait échouer
  // wpctl : sans importance.
  for (const id of ids) await wpctl(['set-mute', id, '0']);
}

/* ---- Windows ------------------------------------------------------------ */

// L'assistant tient lui-même la liste des sessions qu'il a coupées.
async function muteWindows(target, own) {
  const command = target === 'others' ? `others-mute ${[...own].join(',')}` : 'discord-mute';
  const n = Number(await windows.request(command));
  return Number.isFinite(n) ? n : 0;
}
const restoreWindows = (target) => windows.request(`${target}-restore`);

/* ---- API ---------------------------------------------------------------- */

const platform = {
  linux: { mute: muteLinux, restore: restoreLinux },
  win32: { mute: muteWindows, restore: restoreWindows },
}[process.platform];

let queue = Promise.resolve(); // dans l'ordre : un relâché rapide attend la coupure
const run = (fn) => (queue = queue.then(fn, fn));

// `target` : 'discord' ou 'others' ; `ownPids` : les processus de l'appli, à
// ne pas couper. Résout le nombre de flux dont la coupure est confirmée (0 :
// rien à couper, ou système non pris en charge).
function mute(target, ownPids = []) {
  const own = new Set(ownPids);
  return platform ? run(() => platform.mute(target, own)) : Promise.resolve(0);
}
function restore(target) { return platform ? run(() => platform.restore(target)) : Promise.resolve(); }

module.exports = { mute, restore, wantedStreams };
