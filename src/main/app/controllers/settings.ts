/** settings — l'orchestration de la page des réglages (canal `settings`) : lit
 *  les faits que la page montre (whisper, Pocket TTS, éditeur, Claude Code,
 *  version, actions dont le skill fixe le modèle), écrit ce que
 *  core/settings accepte (settingsPatch), lance une commande (installer Pocket
 *  TTS, rétablir le son, ouvrir un dossier ou un fichier, quitter), et rend
 *  toujours la page relue. Un réglage de la langue ou d'une action refait le
 *  relevé de VibeCoder (l'écran et `who` suivent). Une commande que la page
 *  ne montre pas (ou grisée : rétablir le son pendant une dictée) ne fait rien.
 *  Ne connaît pas : les pages (leurs arguments sont vérifiés par core/settings),
 *  l'écoute (app/ipc).
 *  Utilisé par : app/ipc. */
import fs from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { vibeLang } from 'core/config';
import { settingsPatch, settingsView, isSettingsCommand, type SettingsFacts } from 'core/settings';
import { EFFORT_LEVELS, headField, ownRun, SKILL_MODELS, skillModel } from 'core/vibecoder';
import type { SettingsCommand, SettingsView } from 'shared/bridge';
import { findEditor } from 'technicals/editor';
import * as tts from 'technicals/pocket-tts';
import { locateWhisper } from 'technicals/whisper-cli';
import {
  agentInstructions, configFile, ensureVibeFiles, instructionsFile, journalFile, loadConfig, ownWhisperDir, saveConfig, vibeActions, vibeDir, whisperDirs,
} from 'app/settings';
import { state } from 'app/state';
import { agents } from './agents';
import { forceRestoreSound } from './dictation';
import { skillMd } from './runs';
import { installPocket } from './speech';
import { refreshVibe } from './vibecoder';

const RELEASES_URL = 'https://github.com/GearProductions/whisper/releases';
const GENDER = { fr: { f: 'femme', m: 'homme' }, en: { f: 'female', m: 'male' } };

// Ce que la page montre et qui ne se lit pas dans la configuration.
function facts(): SettingsFacts {
  const cfg = loadConfig(), lang = vibeLang(cfg);
  const { cli, model } = locateWhisper(whisperDirs());
  const voices = (l: 'fr' | 'en') => tts.LANGS[l].voices.map((v) => ({ id: v.id, label: `${v.label} · ${GENDER[lang][v.gender]}` }));
  return {
    whisperModel: cli && model ? path.basename(model) : null,
    download: state.modelDownload ? state.modelDownload.percent : null,
    soundCuts: process.platform === 'linux' || process.platform === 'win32',
    recording: state.recording,
    tts: tts.isInstalled() ? 'installed' : tts.canInstall() ? 'installable' : 'missing',
    voices: { fr: voices('fr'), en: voices('en') },
    agentFound: agents.isAvailable(cfg.agentCommand),
    editor: findEditor(cfg.editorCommand)?.name ?? null,
    version: `${app.getVersion()}${app.isPackaged ? '' : ' (développement)'}`,
    // Comme VibeCoder : seul un skill qui fixe son modèle (et s'exécute à part) se règle.
    actions: vibeActions(lang).flatMap((a) => {
      const md = skillMd(a.text), model = skillModel(md);
      return model && (ownRun(a) || headField(md, 'context') === 'fork')
        ? [{ id: a.id, label: a.label, model, models: SKILL_MODELS, efforts: EFFORT_LEVELS }] : [];
    }),
  };
}

const open = (file: string) => { shell.openPath(file); };
const COMMANDS: Record<SettingsCommand, () => unknown> = {
  installTts: installPocket,
  restoreSound: forceRestoreSound,
  whisperDir: () => { fs.mkdirSync(ownWhisperDir(), { recursive: true }); open(ownWhisperDir()); },
  configFile: () => { saveConfig({}); open(configFile()); },   // saveConfig({}) crée le fichier s'il manque
  instructions: () => { agentInstructions(); open(instructionsFile()); },
  journal: () => { if (!fs.existsSync(journalFile())) fs.writeFileSync(journalFile(), ''); open(journalFile()); },
  vibeDir: () => { ensureVibeFiles(); fs.mkdirSync(vibeDir(), { recursive: true }); open(vibeDir()); },
  releases: () => shell.openExternal(`${RELEASES_URL}/tag/v${app.getVersion()}`),
  quit: () => app.quit(),
};

// null → la page ; { set, value } → écrit si la page peut l'écrire ; { run } → la commande si la page la montre
// et ne la grise pas ; le reste ne fait rien. Rend toujours la page relue.
export async function settingsOp(op: unknown): Promise<SettingsView> {
  const o = (op && typeof op === 'object' ? op : {}) as { set?: unknown; value?: unknown; run?: unknown };
  if ('set' in o) {
    const patch = settingsPatch(o.set, o.value, loadConfig(), facts());
    if (patch) { saveConfig(patch); refreshVibe({ now: true }); }
  } else if (isSettingsCommand(o.run)) {
    const run = o.run;
    const active = settingsView(loadConfig(), facts()).categories.some((c) => c.items.some((i) => i.kind === 'run' && i.key === run && !i.disabled));
    if (active) try { await COMMANDS[run](); } catch { /* la page est relue, rien d'autre à faire */ }
  }
  return settingsView(loadConfig(), facts());
}
