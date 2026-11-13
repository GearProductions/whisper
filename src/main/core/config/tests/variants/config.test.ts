import { describe, expect, it } from 'vitest';
import {
  actionPicks, agentColor, agentLang, agentList, agentVibe, favoriteFolders, folderColors, randomColor,
  speakVolume, vibeLang, vibeModulesView, withDefaults,
} from 'core/config';

const agent = (id: string, dir: string) => ({ id, dir, name: id, model: '', effort: '', mode: 'default', sessionId: null });

describe('dossiers favoris', () => {
  it('anciens formats tolérés, sans doublon', () => {
    const cfg = withDefaults({ agentFolders: ['/a', { dir: '/b', color: '#3b82f6' }, { dir: '/a' }, { dir: '/c', color: 'pas une couleur' }], agents: [{ ...agent('x', '/d'), color: '#22c55e' }] });
    expect(favoriteFolders(cfg)).toEqual([
      { dir: '/a', color: null }, { dir: '/b', color: '#3b82f6' }, { dir: '/c', color: null }, { dir: '/d', color: '#22c55e' },
    ]);
  });

  it('chaque dossier reçoit une couleur, de préférence libre ; rien à faire si toutes sont là', () => {
    const cfg = withDefaults({ agentFolders: [{ dir: '/a', color: '#8b5cf6' }, '/b'] });
    const { folders, changed } = folderColors(cfg, () => 0);
    expect(changed).toBe(true);
    expect(folders[1].color).toBe('#3b82f6'); // la première libre
    expect(folderColors(withDefaults({ agentFolders: folders }), () => 0).changed).toBe(false);
  });

  it('randomColor : une couleur prise seulement si toutes le sont', () => {
    const all = ['#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899'].map((color, i) => ({ dir: `/${i}`, color }));
    expect(randomColor(all.slice(0, 7), () => 0)).toBe('#ec4899');
    expect(randomColor(all, () => 0)).toBe('#8b5cf6');
  });

  it('un agent porte la couleur de son dossier ; à défaut, la première', () => {
    const cfg = withDefaults({ agentFolders: [{ dir: '/p', color: '#ef4444' }] });
    expect(agentColor(agent('a', '/p'), cfg)).toBe('#ef4444');
    expect(agentColor(agent('a', '/autre'), cfg)).toBe('#8b5cf6');
  });
});

describe('agents', () => {
  it('liste filtrée', () => {
    const cfg = withDefaults({ agents: [agent('a', '/p'), { id: 'b' }, null] });
    expect(agentList(cfg).map((a) => a.id)).toEqual(['a']);
  });
});

describe('lecture à voix haute', () => {
  it('volume borné', () => {
    expect(speakVolume(withDefaults({ speakVolume: 2 }))).toBe(1);
    expect(speakVolume(withDefaults({ speakVolume: -1 }))).toBe(0);
    expect(speakVolume(withDefaults({ speakVolume: 'x' }))).toBe(1);
    expect(speakVolume(withDefaults({ speakVolume: '0.4' }))).toBe(0.4);
  });
});

describe('VibeCoder', () => {
  it('langue : fr par défaut, en si demandé, rien d’autre', () => {
    expect(vibeLang(withDefaults({}))).toBe('fr');
    expect(vibeLang(withDefaults({ vibeLang: 'en' }))).toBe('en');
    expect(vibeLang(withDefaults({ vibeLang: 'de' }))).toBe('fr');
  });
  it('langue des agents : celle de l’écran à défaut ; les deux langues ne se mélangent pas', () => {
    expect(agentLang(withDefaults({}))).toBe('fr');
    expect(agentLang(withDefaults({ vibeLang: 'en' }))).toBe('en');
    expect(agentLang(withDefaults({ vibeLang: 'en', agentLang: 'fr' }))).toBe('fr');
    expect(vibeLang(withDefaults({ vibeLang: 'en', agentLang: 'fr' }))).toBe('en');
    expect(agentLang(withDefaults({ vibeLang: 'en', agentLang: 'de' }))).toBe('en');
  });
  it('choix d’une action : rien par défaut, une chaîne gardée, ni Fable ni autre chose', () => {
    expect(actionPicks(withDefaults({}), 'forme')).toEqual({});
    const cfg = withDefaults({ actionModels: { forme: 'sonnet', a: 'Fable', b: 3, c: '' }, actionEfforts: { forme: 'high', a: 'low', b: null } });
    expect(actionPicks(cfg, 'forme')).toEqual({ model: 'sonnet', effort: 'high' });
    expect(actionPicks(cfg, 'a')).toEqual({ effort: 'low' });
    expect(actionPicks(cfg, 'b')).toEqual({});
    expect(actionPicks(cfg, 'c')).toEqual({});
    expect(actionPicks(withDefaults({ actionModels: 'cassé', actionEfforts: null }), 'forme')).toEqual({});
  });
  it('vue des modules : liste par défaut, ide si demandé, une valeur inconnue prend le défaut', () => {
    expect(vibeModulesView(withDefaults({}))).toBe('list');
    expect(vibeModulesView(withDefaults({ vibeModulesView: 'ide' }))).toBe('ide');
    expect(vibeModulesView(withDefaults({ vibeModulesView: 'grid' }))).toBe('list');
  });
  it('réglages d’un agent : défauts (Créer, aucune PR), retouches à la main tolérées, autonomy d’avant ignorée', () => {
    const none = { flow: 'create', pr: null };
    expect(agentVibe(agent('a', '/p'))).toEqual(none);
    expect(agentVibe({ ...agent('a', '/p'), vibe: { flow: 'review', autonomy: 'vibe', pr: 12 } })).toEqual({ flow: 'review', pr: 12 });
    expect(agentVibe({ ...agent('a', '/p'), vibe: { flow: 'x', autonomy: 1, pr: 1.5 } as never })).toEqual(none);
    expect(agentVibe({ ...agent('a', '/p'), vibe: { flow: 'review', autonomy: 'guide', pr: -3 } })).toEqual({ ...none, flow: 'review' });
    expect(agentVibe({ ...agent('a', '/p'), vibe: 'cassé' as never })).toEqual(none);
  });
});

describe('artefacts', () => {
  it('limite du texte : 10 Mo par défaut, un entier positif sinon le défaut', () => {
    const max = 10 * 1024 * 1024;
    expect(withDefaults({}).artifactTextMax).toBe(max);
    expect(withDefaults({ artifactTextMax: 1000 }).artifactTextMax).toBe(1000);
    for (const v of [0, -5, 1.5, '1000', null, NaN]) expect(withDefaults({ artifactTextMax: v }).artifactTextMax).toBe(max);
  });
});

describe('dossier temporaire d’une course', () => {
  it('borne : 1 Go par défaut, un entier positif gardé', () => {
    expect(withDefaults({}).runTmpMax).toBe(1024 ** 3);
    expect(withDefaults({ runTmpMax: 2048 }).runTmpMax).toBe(2048);
  });
  it('0, -1, 1.5, "1G" et autres valeurs qui ne sont pas un entier positif : 1 Go', () => {
    for (const v of [0, -1, 1.5, '1G', '2048', null, NaN, Infinity, true, {}]) expect(withDefaults({ runTmpMax: v }).runTmpMax).toBe(1024 ** 3);
  });
  it('la borne des artefacts n’est pas touchée', () => {
    expect(withDefaults({ runTmpMax: 0 }).artifactTextMax).toBe(10 * 1024 * 1024);
  });
});
