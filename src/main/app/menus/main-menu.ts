/** main-menu — le menu du clic droit sur l'icône (et le bouton de lecture) :
 *  modèle, langue, micro, bip, coupures, collage, premier plan, texte
 *  transcrit, lecture à voix haute, agents, dossiers, configuration, version,
 *  quitter.
 *  Ne connaît pas : les pages. Utilisé par : app/ipc. */
import fs from 'node:fs';
import path from 'node:path';
import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { DICTATION_LANGS, speakVolume } from 'core/config';
import * as tts from 'technicals/pocket-tts';
import { locateWhisper } from 'technicals/whisper-cli';
import { agentInstructions, configFile, instructionsFile, journalFile, loadConfig, ownWhisperDir, saveConfig, whisperDirs } from 'app/settings';
import { state } from 'app/state';
import { agents, currentSpeakMode, installPocket, pollSpeak, pushAgents } from 'app/controllers';
import { applyOnTop, canReadSelection, showBubble } from 'app/windows';

// Langues de lecture (cf. technicals/pocket-tts), dans l'ordre du menu.
const SPEAK_LANGS = {
  fr: { lang: 'Français', voice: 'Voix française' },
  en: { lang: 'Anglais', voice: 'Voix anglaise' },
} as const;
const GENDER = { f: 'femme', m: 'homme' };
const RELEASES_URL = 'https://github.com/GearProductions/whisper/releases';
const soundCuts = process.platform === 'linux' || process.platform === 'win32';

// `devices` = micros énumérés par la page (seule à y avoir accès).
export function openMainMenu(devices: unknown) {
  if (!state.icon) return;
  const cfg = loadConfig();
  const mics = (Array.isArray(devices) ? devices : []).filter((d) => d && typeof d.deviceId === 'string') as { deviceId: string; label?: unknown }[];
  const { cli, model } = locateWhisper(whisperDirs());
  const speak = currentSpeakMode(cfg);
  const setSpeak = (value: string) => { saveConfig({ speak: value }); pollSpeak(); };
  const speakLangs = Object.keys(SPEAK_LANGS) as (keyof typeof SPEAK_LANGS)[];
  const template: MenuItemConstructorOptions[] = [
    { label: state.modelDownload ? `Modèle : téléchargement ${state.modelDownload.percent} %`
      : cli && model ? `Modèle : ${path.basename(model)}` : 'whisper.cpp non installé', enabled: false },
    { type: 'separator' },
    {
      label: 'Langue',
      submenu: Object.entries(DICTATION_LANGS).map(([code, label]) => ({
        label, type: 'radio' as const, checked: cfg.lang === code, click: () => saveConfig({ lang: code }),
      })),
    },
    {
      label: 'Micro',
      submenu: [
        { label: 'Micro par défaut du système', type: 'radio', checked: !cfg.deviceId,
          click: () => saveConfig({ deviceId: '', deviceLabel: '' }) },
        ...mics.map((d) => ({
          label: String(d.label || 'Micro sans nom').slice(0, 100), type: 'radio' as const, checked: cfg.deviceId === d.deviceId,
          click: () => saveConfig({ deviceId: d.deviceId, deviceLabel: String(d.label || '') }),
        })),
      ],
    },
    { label: 'Bip de début / fin', type: 'checkbox', checked: cfg.sound !== false, click: (i) => saveConfig({ sound: i.checked }) },
    ...(soundCuts ? [
      { label: 'Couper le son des autres applications pendant la dictée', type: 'checkbox' as const, checked: cfg.muteOthers === true,
        click: (i: Electron.MenuItem) => saveConfig({ muteOthers: i.checked }) },
    ] : []),
    { label: 'Coller automatiquement là où est le curseur', type: 'checkbox', checked: cfg.autoPaste !== false,
      click: (i) => saveConfig({ autoPaste: i.checked }) },
    { label: 'Toujours au premier plan (icône, bulles, conversations)', type: 'checkbox', checked: cfg.onTop !== false,
      click: (i) => { saveConfig({ onTop: i.checked }); applyOnTop(); } },
    { label: 'Afficher le texte transcrit', type: 'checkbox', checked: cfg.showText !== false,
      click: (i) => saveConfig({ showText: i.checked }) },
    ...(soundCuts ? [
      { label: 'Autoriser la coupure du micro Discord', type: 'checkbox' as const, checked: cfg.discordMute === true,
        click: (i: Electron.MenuItem) => saveConfig({ discordMute: i.checked }) },
    ] : []),
    {
      label: 'Lecture à voix haute',
      submenu: [
        ...(!tts.isInstalled() ? [
          tts.canInstall()
            ? { label: 'Installer Pocket TTS (~400 Mo)', click: () => { installPocket(); } }
            : { label: 'Pocket TTS non installé', enabled: false },
          { type: 'separator' as const },
        ] : []),
        ...(canReadSelection ? [
          { label: 'Texte sélectionné', type: 'radio' as const, checked: speak === 'selection', click: () => setSpeak('selection') },
        ] : []),
        { label: 'Presse-papiers', type: 'radio', checked: speak === 'clipboard', click: () => setSpeak('clipboard') },
        { label: 'Désactivée', type: 'radio', checked: speak === 'off', click: () => setSpeak('off') },
        { type: 'separator' },
        {
          label: 'Langue du texte',
          submenu: (['auto', ...speakLangs] as const).map((l) => ({
            label: l === 'auto' ? 'Détection automatique' : SPEAK_LANGS[l].lang, type: 'radio' as const,
            checked: (cfg.speakLang in SPEAK_LANGS ? cfg.speakLang : 'auto') === l, click: () => saveConfig({ speakLang: l }),
          })),
        },
        // « Estelle · femme »
        ...speakLangs.map((l) => ({
          label: SPEAK_LANGS[l].voice,
          submenu: tts.LANGS[l].voices.map((v) => ({
            label: `${v.label} · ${GENDER[v.gender]}`, type: 'radio' as const, checked: tts.pickVoice(l, cfg.speakVoices) === v,
            click: () => saveConfig({ speakVoices: { ...loadConfig().speakVoices, [l]: v.id } }),
          })),
        })),
        { type: 'separator' },
        { label: `Volume : ${Math.round(speakVolume(cfg) * 100)} %…`, click: () => showBubble(speakVolume(cfg), 'volume') },
      ],
    },
    {
      label: 'Agents Claude Code',
      submenu: [
        { label: 'Afficher les agents', type: 'checkbox', checked: cfg.agentsEnabled === true,
          click: (i) => { saveConfig({ agentsEnabled: i.checked }); pushAgents(); } },
        { label: 'Relire avant d\'envoyer (la dictée va dans le champ du panneau)', type: 'checkbox', checked: cfg.agentReview !== false,
          click: (i) => saveConfig({ agentReview: i.checked }) },
        { label: agents.isAvailable(cfg.agentCommand) ? `Commande : ${cfg.agentCommand || 'claude'}` : 'Claude Code introuvable', enabled: false },
        { label: 'Changer la commande de lancement… (agentCommand)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
        { label: 'Modifier la consigne des agents (résumé audio)…', click: () => { agentInstructions(); shell.openPath(instructionsFile()); } },
        { label: 'Ouvrir le journal des agents (tours, autorisations)', click: () => {
          if (!fs.existsSync(journalFile())) fs.writeFileSync(journalFile(), '');
          shell.openPath(journalFile());
        } },
      ],
    },
    { type: 'separator' },
    { label: 'Ouvrir le dossier whisper', click: () => { fs.mkdirSync(ownWhisperDir(), { recursive: true }); shell.openPath(ownWhisperDir()); } },
    { label: 'Modifier la configuration (vocabulaire…)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
    { type: 'separator' },
    { label: `À propos : version ${app.getVersion()}${app.isPackaged ? '' : ' (développement)'}`,
      click: () => shell.openExternal(`${RELEASES_URL}/tag/v${app.getVersion()}`) },
    { label: 'Quitter', click: () => app.quit() },
  ];
  Menu.buildFromTemplate(template).popup({ window: state.icon });
}
