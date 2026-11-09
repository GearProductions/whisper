import { describe, expect, it } from 'vitest';
import { withDefaults } from 'core/config';
import { isSettingsCommand, settingsPatch, settingsView, type SettingsFacts } from 'core/settings';

const FACTS: SettingsFacts = {
  whisperModel: 'ggml-base.bin', download: null, soundCuts: true, recording: false, tts: 'installable',
  voices: { fr: [{ id: 'estelle', label: 'Estelle' }, { id: 'marie', label: 'Marie' }], en: [{ id: 'jane', label: 'Jane' }] },
  agentFound: true, editor: 'Zed', version: '0.14.0',
  actions: [{ id: 'forme', label: 'Forme', model: 'opus', models: ['sonnet', 'opus', 'fable'], efforts: ['low', 'high'] }],
};
const cfg = (raw = {}) => withDefaults(raw);
const items = (c = cfg(), f = FACTS) => settingsView(c, f).categories.flatMap((x) => x.items);
const keys = (c = cfg(), f = FACTS) => items(c, f).map((i) => ('key' in i ? i.key : i.kind));

describe('settingsView', () => {
  it('les catégories dans l’ordre de la note', () => {
    expect(settingsView(cfg(), FACTS).categories.map((c) => c.id)).toEqual(['dictation', 'speech', 'interface', 'actions', 'agents', 'general']);
  });

  it('tout le menu actuel et les clés de config.json seules', () => {
    expect(keys()).toEqual([
      'whisperModel', 'lang', 'vocabulary', 'mic', 'sound', 'muteOthers', 'discordMute', 'restoreSound',
      'installTts', 'speakLang', 'speakVoice:fr', 'speakVoice:en', 'speakVolume',
      'vibeLang', 'agentLang', 'artifactTextMax',
      'model:forme', 'effort:forme',
      'agentFound', 'agentCommand', 'editor', 'editorCommand', 'terminalCommand', 'vibeCommandPrefix', 'outsideAgents', 'instructions', 'journal', 'vibeDir',
      'whisperDir', 'configFile', 'version', 'releases', 'quit',
    ]);
  });

  it('les agents extérieurs : un toggle de la catégorie agents, désactivé par défaut, activé si la configuration le dit', () => {
    const agents = settingsView(cfg(), FACTS).categories.find((c) => c.id === 'agents')!.items;
    expect(agents).toContainEqual({ kind: 'toggle', key: 'outsideAgents', value: false });
    expect(settingsView(cfg({ outsideAgents: true }), FACTS).categories.find((c) => c.id === 'agents')!.items)
      .toContainEqual({ kind: 'toggle', key: 'outsideAgents', value: true });
  });

  it('sans coupures : ni coupure ni dépannage ; TTS installé : pas d’installation', () => {
    const k = keys(cfg(), { ...FACTS, soundCuts: false, tts: 'installed' });
    for (const gone of ['muteOthers', 'discordMute', 'restoreSound', 'installTts']) expect(k).not.toContain(gone);
  });

  it('le dépannage est grisé pendant l’enregistrement', () => {
    const run = items(cfg(), { ...FACTS, recording: true }).find((i) => i.kind === 'run' && i.key === 'restoreSound');
    expect(run).toEqual({ kind: 'run', key: 'restoreSound', disabled: true });
  });

  it('les infos : modèle, téléchargement, agent, éditeur', () => {
    const v = (f: Partial<SettingsFacts>, c = cfg()) => Object.fromEntries(items(c, { ...FACTS, ...f }).flatMap((i) => (i.kind === 'info' ? [[i.key, i.value]] : [])));
    expect(v({})).toEqual({ whisperModel: 'ggml-base.bin', agentFound: 'claude', editor: 'Zed', version: '0.14.0' });
    expect(v({ download: 42 }).whisperModel).toBe('downloading:42');
    expect(v({ whisperModel: null, agentFound: false, editor: null })).toMatchObject({ whisperModel: '', agentFound: '', editor: '' });
    expect(v({}, cfg({ agentCommand: 'distrobox enter dev -- claude' })).agentFound).toBe('distrobox enter dev -- claude');
  });

  it('le micro, la voix et le volume lus tels que la lecture les garde', () => {
    const c = cfg({ deviceId: 'mic1', speakVoices: { fr: 'marie' }, speakVolume: 7 });
    const all = items(c);
    expect(all).toContainEqual({ kind: 'mic', value: 'mic1' });
    expect(all).toContainEqual(expect.objectContaining({ key: 'speakVoice:fr', value: 'marie' }));
    expect(all).toContainEqual({ kind: 'number', key: 'speakVolume', value: 1 });
  });

  it('les deux langues : l’agent suit l’écran à défaut', () => {
    const lang = (c: ReturnType<typeof cfg>) => items(c).filter((i) => i.kind === 'choice' && /Lang$/.test(i.key)).map((i) => 'value' in i && i.value);
    expect(lang(cfg({ vibeLang: 'en' }))).toEqual(['auto', 'en', 'en']);
    expect(lang(cfg({ vibeLang: 'en', agentLang: 'fr' }))).toEqual(['auto', 'en', 'fr']);
  });

  it('la langue du texte : ses libellés dans la langue de l’interface', () => {
    const speak = (c: ReturnType<typeof cfg>) => items(c).find((i) => 'key' in i && i.key === 'speakLang');
    expect(speak(cfg({ vibeLang: 'en' }))).toMatchObject({ choices: [['auto', 'Automatic detection'], ['fr', 'French'], ['en', 'English']] });
    expect(speak(cfg())).toMatchObject({ choices: [['auto', 'Détection automatique'], ['fr', 'Français'], ['en', 'Anglais']] });
  });

  it('une action : modèle (sans Fable) et effort, le choix ou le conseillé', () => {
    const a = (c: ReturnType<typeof cfg>) => items(c).filter((i) => 'key' in i && /^(model|effort):/.test(i.key));
    expect(a(cfg())).toEqual([
      { kind: 'choice', key: 'model:forme', label: 'Forme', value: 'opus', choices: [['sonnet', 'sonnet'], ['opus', 'opus · conseillé']] },
      { kind: 'choice', key: 'effort:forme', label: 'Forme', value: '', choices: [['', 'effort du skill'], ['low', 'faible'], ['high', 'élevé']] },
    ]);
    // Les libellés suivent la langue de l'interface.
    expect(a(cfg({ vibeLang: 'en' }))[1]).toMatchObject({ choices: [['', 'skill\'s effort'], ['low', 'low'], ['high', 'high']] });
    const picked = a(cfg({ actionModels: { forme: 'sonnet' }, actionEfforts: { forme: 'high' } }));
    expect(picked.map((i) => 'value' in i && i.value)).toEqual(['sonnet', 'high']);
    // Fable écrit à la main : le conseillé.
    expect(a(cfg({ actionModels: { forme: 'fable' } }))[0]).toMatchObject({ value: 'opus' });
  });
});

describe('settingsPatch', () => {
  const p = (key: unknown, value: unknown, c = cfg(), f = FACTS) => settingsPatch(key, value, c, f);

  it('accepte une valeur que la lecture garde', () => {
    expect(p('lang', 'en')).toEqual({ lang: 'en' });
    expect(p('vocabulary', 'a'.repeat(300))).toEqual({ vocabulary: 'a'.repeat(300) });
    expect(p('sound', false)).toEqual({ sound: false });
    expect(p('muteOthers', true)).toEqual({ muteOthers: true });
    expect(p('speakLang', 'fr')).toEqual({ speakLang: 'fr' });
    expect(p('speakVolume', 0.5)).toEqual({ speakVolume: 0.5 });
    expect(p('vibeLang', 'en')).toEqual({ vibeLang: 'en' });
    expect(p('agentLang', 'fr')).toEqual({ agentLang: 'fr' });
    expect(p('artifactTextMax', 1024)).toEqual({ artifactTextMax: 1024 });
    expect(p('agentCommand', 'distrobox enter dev -- "claude"')).toEqual({ agentCommand: 'distrobox enter dev -- "claude"' });
    expect(p('terminalCommand', '')).toEqual({ terminalCommand: '' });
    expect(p('outsideAgents', true)).toEqual({ outsideAgents: true });
    expect(p('outsideAgents', false, cfg({ outsideAgents: true }))).toEqual({ outsideAgents: false });
  });

  it('refuse ce que la lecture refuserait', () => {
    expect(p('lang', 'xx')).toBeNull();
    expect(p('vocabulary', 'a'.repeat(301))).toBeNull();
    expect(p('sound', 'oui')).toBeNull();
    expect(p('speakLang', 'es')).toBeNull();
    expect(p('speakVolume', 1.5)).toBeNull();
    expect(p('speakVolume', '0.5')).toBeNull();
    expect(p('vibeLang', 'auto')).toBeNull();
    expect(p('agentLang', 'de')).toBeNull();
    expect(p('artifactTextMax', 0)).toBeNull();
    expect(p('artifactTextMax', '10')).toBeNull();
    expect(p('editorCommand', 'zed\t--new')).toBeNull();
    expect(p('vibeCommandPrefix', '   ')).toBeNull();
    expect(p('agentCommand', 42)).toBeNull();
    expect(p('outsideAgents', 'true')).toBeNull();
    expect(p('outsideAgents', 1)).toBeNull();
  });

  it('une clé non montrée, une info, une commande, une coupure sans coupures : rien', () => {
    expect(p('agents', [])).toBeNull();
    expect(p('deviceId', 'x')).toBeNull();
    expect(p('version', '1')).toBeNull();
    expect(p('quit', true)).toBeNull();
    expect(p(42, true)).toBeNull();
    expect(p('muteOthers', true, cfg(), { ...FACTS, soundCuts: false })).toBeNull();
    expect(p('model:autre', 'opus')).toBeNull();
  });

  it('une voix de la liste, sans perdre l’autre', () => {
    const c = cfg();
    expect(p('speakVoice:fr', 'marie', c)).toEqual({ speakVoices: { fr: 'marie', en: 'jane' } });
    expect(p('speakVoice:fr', 'inconnue')).toBeNull();
    expect(c.speakVoices).toEqual({ fr: 'estelle', en: 'jane' });
  });

  it('modèle et effort d’une action : le choix, ou retiré', () => {
    expect(p('model:forme', 'sonnet')).toEqual({ actionModels: { forme: 'sonnet' } });
    expect(p('model:forme', 'haiku')).toBeNull();
    expect(p('effort:forme', 'high')).toEqual({ actionEfforts: { forme: 'high' } });
    expect(p('effort:forme', 'max')).toBeNull();
    // Le conseillé et '' retirent le choix, les autres actions restent.
    const c = cfg({ actionModels: { forme: 'sonnet', note: 'opus' }, actionEfforts: { forme: 'high' } });
    expect(p('model:forme', 'opus', c)).toEqual({ actionModels: { note: 'opus' } });
    expect(p('effort:forme', '', c)).toEqual({ actionEfforts: {} });
    expect(c.actionModels).toEqual({ forme: 'sonnet', note: 'opus' });
  });
});

describe('isSettingsCommand', () => {
  it('les commandes de la page, rien d’autre', () => {
    expect(isSettingsCommand('quit')).toBe(true);
    expect(isSettingsCommand('rm')).toBe(false);
    expect(isSettingsCommand(undefined)).toBe(false);
  });
});
