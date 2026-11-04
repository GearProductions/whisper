/** main-menu — le menu de réglages du bouton ⚙ Réglages de la fenêtre
 *  (openSettings : modèle, langue, micro, bip, coupures, lecture à voix haute
 *  avec son volume en 25/50/75/100 %, agents, dossiers, configuration,
 *  version, quitter). Les entrées sont construites par de petites fonctions.
 *  Ne connaît pas : les pages. Utilisé par : app/ipc. */
import fs from 'node:fs';
import path from 'node:path';
import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { DICTATION_LANGS, speakVolume } from 'core/config';
import * as tts from 'technicals/pocket-tts';
import { findEditor } from 'technicals/editor';
import { locateWhisper } from 'technicals/whisper-cli';
import {
  agentInstructions, configFile, ensureVibeFiles, instructionsFile, journalFile, loadConfig, ownWhisperDir, saveConfig, vibeDir, whisperDirs,
} from 'app/settings';
import { state } from 'app/state';
import { agents, forceRestoreSound, installPocket, setVolume } from 'app/controllers';

// Langues de lecture (cf. technicals/pocket-tts), dans l'ordre du menu.
const SPEAK_LANGS = {
  fr: { lang: 'Français', voice: 'Voix française' },
  en: { lang: 'Anglais', voice: 'Voix anglaise' },
} as const;
const GENDER = { f: 'femme', m: 'homme' };
const RELEASES_URL = 'https://github.com/GearProductions/whisper/releases';
const soundCuts = process.platform === 'linux' || process.platform === 'win32';

type Item = MenuItemConstructorOptions;
type Config = ReturnType<typeof loadConfig>;
// `devices` = micros énumérés par la page (seule à y avoir accès).
const micList = (devices: unknown) =>
  (Array.isArray(devices) ? devices : []).filter((d) => d && typeof d.deviceId === 'string') as { deviceId: string; label?: unknown }[];

const modelItem = (): Item => {
  const { cli, model } = locateWhisper(whisperDirs());
  return { label: state.modelDownload ? `Modèle : téléchargement ${state.modelDownload.percent} %`
    : cli && model ? `Modèle : ${path.basename(model)}` : 'whisper.cpp non installé', enabled: false };
};
const langItem = (cfg: Config): Item => ({
  label: 'Langue',
  submenu: Object.entries(DICTATION_LANGS).map(([code, label]) => ({
    label, type: 'radio' as const, checked: cfg.lang === code, click: () => saveConfig({ lang: code }),
  })),
});
const micItem = (cfg: Config, devices: unknown): Item => ({
  label: 'Micro',
  submenu: [
    { label: 'Micro par défaut du système', type: 'radio', checked: !cfg.deviceId,
      click: () => saveConfig({ deviceId: '', deviceLabel: '' }) },
    ...micList(devices).map((d) => ({
      label: String(d.label || 'Micro sans nom').slice(0, 100), type: 'radio' as const, checked: cfg.deviceId === d.deviceId,
      click: () => saveConfig({ deviceId: d.deviceId, deviceLabel: String(d.label || '') }),
    })),
  ],
});
const soundItem = (cfg: Config): Item => (
  { label: 'Bip de début / fin', type: 'checkbox', checked: cfg.sound !== false, click: (i) => saveConfig({ sound: i.checked }) });
const muteOthersItems = (cfg: Config): Item[] => soundCuts ? [
  { label: 'Couper le son des autres applications pendant la dictée', type: 'checkbox', checked: cfg.muteOthers === true,
    click: (i) => saveConfig({ muteOthers: i.checked }) },
] : [];
const discordItems = (cfg: Config): Item[] => soundCuts ? [
  { label: 'Autoriser la coupure du micro Discord', type: 'checkbox', checked: cfg.discordMute === true,
    click: (i) => saveConfig({ discordMute: i.checked }) },
  // Dépannage : un son ou le micro Discord resté coupé après une dictée.
  { label: 'Rétablir le son et le micro Discord (dépannage)', enabled: !state.recording, click: () => { forceRestoreSound(); } },
] : [];
// Lecture à voix haute : l'installation, puis la langue du texte et les voix.
const speakInstallItems = (): Item[] => tts.isInstalled() ? [] : [
  tts.canInstall()
    ? { label: 'Installer Pocket TTS (~400 Mo)', click: () => { installPocket(); } }
    : { label: 'Pocket TTS non installé', enabled: false },
  { type: 'separator' },
];
const speakLangVoiceItems = (cfg: Config): Item[] => {
  const speakLangs = Object.keys(SPEAK_LANGS) as (keyof typeof SPEAK_LANGS)[];
  return [
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
  ];
};
// Agents : commande, éditeur, consigne, journal, dossier de VibeCoder.
const agentFileItems = (cfg: Config): Item[] => {
  const editor = findEditor(cfg.editorCommand);
  return [
    { label: agents.isAvailable(cfg.agentCommand) ? `Commande : ${cfg.agentCommand || 'claude'}` : 'Claude Code introuvable', enabled: false },
    { label: 'Changer la commande de lancement… (agentCommand)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
    { label: editor ? `Éditeur : ${editor.name}` : 'Aucun éditeur trouvé', enabled: false },
    { label: 'Changer d\'éditeur… (editorCommand)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
    { label: 'Modifier la consigne des agents (résumé audio)…', click: () => { agentInstructions(); shell.openPath(instructionsFile()); } },
    { label: 'Ouvrir le journal des agents (tours, autorisations)', click: () => {
      if (!fs.existsSync(journalFile())) fs.writeFileSync(journalFile(), '');
      shell.openPath(journalFile());
    } },
    // Ce que VibeCoder fait dire (actions, skills), à retoucher : les fichiers par défaut d'abord.
    { label: 'Dossier de VibeCoder', click: () => {
      ensureVibeFiles();
      fs.mkdirSync(vibeDir(), { recursive: true });
      shell.openPath(vibeDir());
    } },
  ];
};
// Dossier whisper, configuration, version, quitter.
const footerItems = (): Item[] => [
  { label: 'Ouvrir le dossier whisper', click: () => { fs.mkdirSync(ownWhisperDir(), { recursive: true }); shell.openPath(ownWhisperDir()); } },
  { label: 'Modifier la configuration (vocabulaire…)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
  { type: 'separator' },
  { label: `À propos : version ${app.getVersion()}${app.isPackaged ? '' : ' (développement)'}`,
    click: () => shell.openExternal(`${RELEASES_URL}/tag/v${app.getVersion()}`) },
  { label: 'Quitter', click: () => app.quit() },
];

// Le menu s'ouvre sous le curseur, donc sous le bouton.
export function openSettings(devices: unknown) {
  if (!state.panel) return;
  const cfg = loadConfig();
  const volume = Math.round(speakVolume(cfg) * 100);
  const template: Item[] = [
    modelItem(),
    { type: 'separator' },
    langItem(cfg),
    micItem(cfg, devices),
    soundItem(cfg),
    ...muteOthersItems(cfg),
    ...discordItems(cfg),
    {
      label: 'Lecture à voix haute',
      submenu: [
        ...speakInstallItems(),
        ...speakLangVoiceItems(cfg),
        { type: 'separator' },
        { label: 'Volume', submenu: [25, 50, 75, 100].map((v) => ({
          label: `${v} %`, type: 'radio' as const, checked: volume === v, click: () => setVolume(v / 100),
        })) },
      ],
    },
    { label: 'Agents Claude Code', submenu: agentFileItems(cfg) },
    { type: 'separator' },
    ...footerItems(),
  ];
  Menu.buildFromTemplate(template).popup({ window: state.panel });
}
