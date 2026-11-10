/** settings — les réglages de la page et ce qu'elle peut écrire : la liste
 *  des réglages par catégorie (SETTINGS), la page (settingsView) et le
 *  contrôle d'une écriture (settingsPatch : une clé que la page montre, une
 *  valeur que la lecture garde telle quelle, sinon rien ; jamais Fable pour
 *  une action, I-36).
 *  Valeurs des infos (à faire correspondre à ses libellés par la page) :
 *  whisperModel = le nom du modèle, '' (non installé) ou `downloading:<pourcent>` ;
 *  agentFound = la commande lancée ('claude' par défaut), '' si introuvable ;
 *  editor = son nom, '' si aucun ; version = la version.
 *  Les libellés des choix suivent la langue de l'interface (vibeLang) ; ceux des efforts sont ceux de core/vibecoder.
 *  Les micros ne passent pas ici (la page les énumère) ; Pocket TTS absent
 *  et non installable : rien n'est montré.
 *  Ne connaît pas : Electron, le disque, whisper, Pocket TTS (faits passés).
 *  Utilisé par : app/controllers (settings). */
import { DICTATION_LANGS, actionPicks, agentLang, speakVolume, vibeLang, type Config } from 'core/config';
import { EFFORT } from 'core/vibecoder';
import { splitCommand } from 'helpers/command-line';
import type { SettingItem, SettingKey, SettingsCategory, SettingsCommand, SettingsInfo, SettingsView } from 'shared/bridge';

// Ce que la page montre et qui ne se lit pas dans la configuration : lu par
// app/controllers, passé ici.
export type SettingsFacts = {
  whisperModel: string | null;
  download: number | null;
  soundCuts: boolean;
  recording: boolean;
  tts: 'installed' | 'installable' | 'missing';
  voices: Record<'fr' | 'en', { id: string; label: string }[]>;
  agentFound: boolean;
  editor: string | null;
  version: string;
  // Les actions dont le skill fixe le modèle.
  actions: { id: string; label: string; model: string; models: string[]; efforts: string[] }[];
};

type Kind = SettingItem['kind'];
// Les réglages par catégorie, dans l'ordre de la page : [sorte, clé]. Les
// actions (model:<id>, effort:<id>) viennent de facts.actions.
export const SETTINGS: { id: SettingsCategory; items: [Kind, string][] }[] = [
  { id: 'dictation', items: [['info', 'whisperModel'], ['choice', 'lang'], ['text', 'vocabulary'], ['mic', ''], ['toggle', 'sound'],
    ['toggle', 'muteOthers'], ['toggle', 'discordMute'], ['run', 'restoreSound']] },
  { id: 'speech', items: [['run', 'installTts'], ['choice', 'speakLang'], ['choice', 'speakVoice:fr'], ['choice', 'speakVoice:en'],
    ['number', 'speakVolume']] },
  { id: 'interface', items: [['choice', 'vibeLang'], ['choice', 'agentLang'], ['number', 'artifactTextMax']] },
  { id: 'actions', items: [] },
  { id: 'agents', items: [['info', 'agentFound'], ['command', 'agentCommand'], ['info', 'editor'], ['command', 'editorCommand'],
    ['command', 'terminalCommand'], ['command', 'vibeCommandPrefix'], ['toggle', 'outsideAgents'], ['run', 'instructions'], ['run', 'journal'], ['run', 'vibeDir']] },
  { id: 'general', items: [['run', 'whisperDir'], ['run', 'configFile'], ['info', 'version'], ['run', 'releases'], ['run', 'quit']] },
];

const COMMANDS: SettingsCommand[] = ['installTts', 'restoreSound', 'whisperDir', 'configFile', 'instructions', 'journal', 'vibeDir', 'releases', 'quit'];
export const isSettingsCommand = (x: unknown): x is SettingsCommand => COMMANDS.includes(x as SettingsCommand);

const VOCABULARY_MAX = 300, COMMAND_MAX = 500;
const FR_EN: [string, string][] = [['fr', 'Français'], ['en', 'English']];
// Les libellés des choix, dans la langue de l'interface (vibeLang).
const WORDS = {
  fr: { auto: 'Détection automatique', fr: 'Français', en: 'Anglais', recommended: 'conseillé', skill: 'effort du skill' },
  en: { auto: 'Automatic detection', fr: 'French', en: 'English', recommended: 'recommended', skill: 'skill\'s effort' },
};
const SPEAK_LANGS = ['auto', 'fr', 'en'] as const;
const noFable = (models: string[]) => models.filter((m) => !/fable/i.test(m));

// Le réglage d'une clé, ou null (pas montré : coupures sans coupures, installation inutile).
function item(kind: Kind, key: string, cfg: Config, f: SettingsFacts): SettingItem | null {
  const k = key as SettingKey, w = WORDS[vibeLang(cfg)];
  switch (kind) {
    case 'mic': return { kind, value: cfg.deviceId };
    case 'toggle':
      if ((key === 'muteOthers' || key === 'discordMute') && !f.soundCuts) return null;
      return { kind, key: k, value: key === 'sound' ? cfg.sound !== false : cfg[key] === true };
    case 'text': return { kind, key: k, value: String(cfg[key] ?? ''), max: VOCABULARY_MAX };
    case 'command': return { kind, key: k, value: String(cfg[key] ?? ''), max: COMMAND_MAX };
    case 'number': return { kind, key: k, value: key === 'speakVolume' ? speakVolume(cfg) : cfg.artifactTextMax };
    case 'choice': {
      if (key === 'lang') {
        return { kind, key: k, value: cfg.lang, choices: Object.entries(DICTATION_LANGS).map(([v, l]) => [v, v === 'auto' ? w.auto : l]) };
      }
      if (key === 'speakLang') {
        return { kind, key: k, value: (SPEAK_LANGS as readonly string[]).includes(cfg.speakLang) ? cfg.speakLang : 'auto',
          choices: SPEAK_LANGS.map((v) => [v, w[v]]) };
      }
      if (key === 'vibeLang') return { kind, key: k, value: vibeLang(cfg), choices: FR_EN };
      if (key === 'agentLang') return { kind, key: k, value: agentLang(cfg), choices: FR_EN };
      const l = key === 'speakVoice:en' ? 'en' : 'fr', voices = f.voices[l];
      const chosen = cfg.speakVoices?.[l];
      return { kind, key: k, value: (voices.find((v) => v.id === chosen) || voices[0])?.id ?? '', choices: voices.map((v) => [v.id, v.label]) };
    }
    case 'info': {
      const v: Record<SettingsInfo, string> = {
        whisperModel: f.download !== null ? `downloading:${f.download}` : f.whisperModel ?? '',
        agentFound: f.agentFound ? cfg.agentCommand || 'claude' : '', editor: f.editor ?? '', version: f.version,
      };
      return { kind, key: key as SettingsInfo, value: v[key as SettingsInfo] };
    }
    case 'run':
      if (key === 'installTts') return f.tts === 'installable' ? { kind, key, disabled: false } : null;
      if (key === 'restoreSound') return f.soundCuts ? { kind, key, disabled: f.recording } : null;
      return { kind, key: key as SettingsCommand, disabled: false };
  }
}

// Le modèle et l'effort d'une action : le choix de la configuration, sinon le conseillé / celui du skill.
function actionItems(cfg: Config, f: SettingsFacts): SettingItem[] {
  const lang = vibeLang(cfg), w = WORDS[lang];
  return f.actions.flatMap((a) => {
    const models = noFable(a.models), pick = actionPicks(cfg, a.id);
    return [
      { kind: 'choice', key: `model:${a.id}`, label: a.label, value: pick.model && models.includes(pick.model) ? pick.model : a.model,
        choices: models.map((m) => [m, m === a.model ? `${m} · ${w.recommended}` : m] as [string, string]) },
      { kind: 'choice', key: `effort:${a.id}`, label: a.label, value: pick.effort && a.efforts.includes(pick.effort) ? pick.effort : '',
        choices: [['', w.skill], ...a.efforts.map((e) => [e, EFFORT[lang][e] ?? e] as [string, string])] },
    ] satisfies SettingItem[];
  });
}

export function settingsView(cfg: Config, facts: SettingsFacts): SettingsView {
  return {
    categories: SETTINGS.map(({ id, items }) => ({
      id,
      items: id === 'actions' ? actionItems(cfg, facts) : items.map(([kind, key]) => item(kind, key, cfg, facts)).filter((i) => i !== null),
    })),
  };
}

// Une écriture demandée par la page → ce qu'elle change dans la configuration,
// ou null : rien d'écrit. La clé doit être un réglage que la page montre ; la
// valeur, une que la lecture garde telle quelle.
export function settingsPatch(key: unknown, value: unknown, cfg: Config, facts: SettingsFacts): Partial<Config> | null {
  const shown = settingsView(cfg, facts).categories.flatMap((c) => c.items).find((i) => 'key' in i && i.key === key);
  if (!shown || typeof key !== 'string') return null;
  const [name, id] = key.split(/:(.*)/s);
  // Le modèle conseillé et l'effort '' retirent le choix de l'action.
  if (name === 'model' || name === 'effort') {
    const map = name === 'model' ? 'actionModels' : 'actionEfforts';
    const recommended = name === 'model' ? facts.actions.find((a) => a.id === id)?.model : '';
    if (shown.kind !== 'choice' || typeof value !== 'string') return null;
    if (value !== recommended && !shown.choices.some(([v]) => v === value)) return null;
    const { [id]: _removed, ...rest } = (cfg[map] && typeof cfg[map] === 'object' ? cfg[map] : {}) as Record<string, string>;
    return { [map]: value === recommended || value === '' ? rest : { ...rest, [id]: value } };
  }
  switch (shown.kind) {
    case 'toggle': return typeof value === 'boolean' ? { [key]: value } : null;
    case 'choice':
      if (typeof value !== 'string' || !shown.choices.some(([v]) => v === value)) return null;
      return name === 'speakVoice' ? { speakVoices: { ...cfg.speakVoices, [id]: value } } : { [key]: value };
    case 'text': return typeof value === 'string' && value.length <= shown.max ? { [key]: value } : null;
    case 'command':
      // Un programme que l'appli lance : pas de caractère de contrôle, au moins un mot ou rien.
      return typeof value === 'string' && value.length <= shown.max && !/[\x00-\x1f\x7f]/.test(value)
        && (value === '' || splitCommand(value).length > 0) ? { [key]: value } : null;
    case 'number':
      if (typeof value !== 'number') return null;
      if (key === 'speakVolume') return value >= 0 && value <= 1 ? { speakVolume: value } : null;
      return Number.isInteger(value) && value > 0 ? { [key]: value } : null;
    default: return null;
  }
}
