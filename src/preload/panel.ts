/** panel — le pont du panneau des conversations (window.conv) : il reçoit la
 *  conversation affichée (ou le contexte « Dictée »), demande l'historique, la
 *  lecture d'une réponse par son rang (et son flux audio : speak, onSpeakChunk,
 *  onSpeakEnd, cancelSpeak), prend le micro (réglages, enregistrement : le son
 *  part par transcribe, le texte rendu par whisper revient à la page ; aucun
 *  canal ne colle ni ne lit un texte donné par la page), et envoie à l'agent affiché ce qu'on
 *  écrit dans son champ (le principal vérifie à qui). Répondre à une demande
 *  d'autorisation ne vaut que pour celle affichée. Copier ne transporte aucun
 *  texte : le principal copie le sien. VibeCoder : le relevé de l'agent
 *  affiché, ses actions désignées par leur id, ses fichiers par leur id dans
 *  le relevé, ses courses par l'id de leur action — aucun pont ne transporte
 *  un chemin, sauf vibeDrop : les chemins des File déposés, lus par
 *  webUtils.getPathForFile, jamais donnés par la page (le principal les
 *  revérifie) ; le dossier d'arrivée y est l'id d'un dossier du relevé, une
 *  chaîne ou rien (absent ou inconnu : la racine), jamais un chemin (accord
 *  de l'utilisateur, note 0.13.0-gestion-artefacts). Voir le code : un
 *  fichier d'un module par son id ; seul texte
 *  envoyé, celui du fichier affiché, à enregistrer (le principal vérifie
 *  qu'il est suivi, dans le relevé, et pas grisé).
 *  Ne connaît pas : le principal (seulement ses canaux). Chargé par le panneau. */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { ConvApi } from 'shared/bridge';

const conv: ConvApi = {
  onThread: (fn) => { ipcRenderer.on('conv:thread', (_e, data) => fn(data)); },
  ready: () => ipcRenderer.send('conv:ready'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setDevice: (id, label) => ipcRenderer.send('config:setDevice', id, label),
  setRecording: (on) => ipcRenderer.send('dictation:recording', !!on),
  transcribe: (pcm) => ipcRenderer.invoke('dictation:transcribe', pcm),
  speak: (index) => ipcRenderer.invoke('conv:speak', index),   // la réponse de ce rang : le principal lit son résumé
  cancelSpeak: (id) => ipcRenderer.send('tts:cancel', id),
  onSpeakChunk: (fn) => { ipcRenderer.on('tts:chunk', (_e, id, pcm, rate) => fn(id, pcm, rate)); },
  onSpeakEnd: (fn) => { ipcRenderer.on('tts:end', (_e, id, error) => fn(id, error)); },
  history: () => ipcRenderer.invoke('conv:history'),
  // Détail du contexte et commandes de l'agent : { context, commands } ou { error }.
  probe: () => ipcRenderer.invoke('conv:probe'),
  open: (sessionId) => ipcRenderer.send('conv:open', sessionId),
  resume: () => ipcRenderer.send('conv:resume'),
  current: () => ipcRenderer.send('conv:current'),            // ancienne conversation → celle en cours
  setMode: (mode) => ipcRenderer.send('conv:mode', mode),     // 'compact' (⤡) ou 'full' (⤢)
  height: (h) => ipcRenderer.send('conv:height', h),          // réduit : la hauteur de son contenu
  // Message de l'appli, à la place de la bulle.
  onNotice: (fn) => { ipcRenderer.on('conv:notice', (_e, notice) => fn(notice)); },
  // Contexte « Dictée » : copie le dernier texte dicté, connu du principal.
  copy: () => ipcRenderer.invoke('conv:copy'),
  // Champ de saisie : un message à l'agent affiché, avec ses pièces jointes →
  // { ok, error }. Trombone : menu (fichiers, sélection), le choix revient par
  // onAttached. La dictée : la page envoie le son (transcribe) et reçoit ce
  // que whisper rend, qu'elle insère elle-même.
  send: (draft) => ipcRenderer.invoke('conv:send', draft),
  attach: () => ipcRenderer.send('conv:attach'),
  onAttached: (fn) => { ipcRenderer.on('conv:attached', (_e, what) => fn(what)); },
  onFocusInput: (fn) => { ipcRenderer.on('conv:focusInput', () => fn()); },
  hide: () => ipcRenderer.send('conv:hide'),                  // la croix du panneau
  pathFor: (file) => webUtils.getPathForFile(file),          // chemin d'un fichier déposé ('' : collé)
  // Demande d'autorisation affichée dans le fil : 'allow', 'always' ou 'deny',
  // pour la demande `key` (celle que l'utilisateur a sous les yeux).
  answer: (decision, key) => ipcRenderer.send('conv:answer', decision, key),
  openLink: (url) => ipcRenderer.send('conv:openLink', url),    // dans le navigateur
  showFile: (file) => ipcRenderer.send('conv:showFile', file),  // dans le gestionnaire de fichiers
  // VibeCoder : le relevé de l'agent affiché (null : il est en conversation).
  onVibe: (fn) => { ipcRenderer.on('conv:vibe', (_e, view) => fn(view)); },
  // Une action par son id dans le relevé, avec ses arguments (le texte du
  // champ, un rang, un hash…) : le principal vérifie chacun, construit le
  // message et l'envoie à l'agent affiché → { ok, error }.
  vibeRun: (action, args) => ipcRenderer.invoke('conv:vibeRun', action, args),
  vibeSet: (patch) => ipcRenderer.send('conv:vibeSet', patch),               // Créer / Relire, Guide / Vibe, langue, modèle…
  vibeMark: (target, verdict) => ipcRenderer.send('conv:vibeMark', target, verdict),  // ✓, ✗, ou oublier
  vibeDraft: (op) => ipcRenderer.send('conv:vibeDraft', op),                 // brouillon de revue : ajouter, modifier, retirer
  vibeOpen: (id, line) => ipcRenderer.send('conv:vibeOpen', id, line),       // un fichier ou un commit du relevé, par son id (et une ligne) : jamais un chemin
  vibeRefresh: () => ipcRenderer.send('conv:vibeRefresh'),                   // relever maintenant
  vibeProcess: (op, index) => ipcRenderer.send('conv:vibeProcess', op, index), // une commande du projet par son rang : jamais un texte
  vibeRunOp: (id, op) => ipcRenderer.send('conv:vibeRunOp', id, op),         // une course par l'id de son action : jamais un chemin ni un texte
  // Voir le code : le fichier suivi, par son id (null : plus aucun) ; son texte revient par onVibeCode.
  vibeFollow: (id) => ipcRenderer.send('conv:vibeFollow', id),
  onVibeCode: (fn) => { ipcRenderer.on('conv:vibeCode', (_e, code) => fn(code)); },
  vibeSave: (id, text) => ipcRenderer.invoke('conv:vibeSave', id, text),     // le texte du seul fichier affiché → { ok, error }
  // Dépôt sur les artefacts : les chemins lus des File (jamais donnés par la page), l'id du dossier s'il est une chaîne.
  vibeDrop: (files, folder) => ipcRenderer.invoke('conv:vibeDrop', Array.from(files, (f) => webUtils.getPathForFile(f)),
    typeof folder === 'string' ? folder : undefined),
};

contextBridge.exposeInMainWorld('conv', conv);
