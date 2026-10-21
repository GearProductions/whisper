import { describe, expect, it } from 'vitest';
import {
  agentColor, agentList, agentSlotCount, agentVibe, childRow, favoriteFolders, folderColors, randomColor, selectedAgent, speakMode,
  speakVolume, vibeLang, withDefaults,
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
  it('liste filtrée, boutons, agent sélectionné', () => {
    const cfg = withDefaults({ agentsEnabled: true, agents: [agent('a', '/p'), { id: 'b' }, null], agentSelected: 'a' });
    expect(agentList(cfg).map((a) => a.id)).toEqual(['a']);
    expect(agentSlotCount(cfg)).toBe(2);
    expect(selectedAgent(cfg)?.id).toBe('a');
    expect(selectedAgent({ ...cfg, agentsEnabled: false })).toBeNull();
    expect(agentSlotCount({ ...cfg, agentsEnabled: false })).toBe(0);
  });
  it('familles : un groupe par place (deux enfants par place), plus le « + » ; la rangée d’enfants', () => {
    const child = (id: string, parent: string) => ({ ...agent(id, `/${id}`), parent: { id: parent } });
    const alone = withDefaults({ agentsEnabled: true, agents: [agent('a', '/a'), agent('b', '/b')] });
    expect(agentSlotCount(alone)).toBe(3);
    expect(childRow(alone)).toBe(false);
    const fam = withDefaults({ agentsEnabled: true, agents: [agent('a', '/a'), child('c1', 'a'), child('c2', 'a'), child('c3', 'a'), agent('b', '/b'), child('d', 'b'), child('o', 'absent')] });
    expect(agentSlotCount(fam)).toBe(2 + 1 + 1 + 1); // a : 3 enfants → 2 ; b : 1 ; o (parent absent) : 1 ; « + »
    expect(childRow(fam)).toBe(true);
    expect(childRow(withDefaults({ agentsEnabled: true, agents: [child('o', 'absent')] }))).toBe(false);
    expect(childRow({ ...fam, agentsEnabled: false })).toBe(false);
    expect(agentSlotCount({ ...fam, agentsEnabled: false })).toBe(0);
  });
});

describe('lecture à voix haute', () => {
  it('source', () => {
    expect(speakMode(withDefaults({}), true)).toBe('selection');
    expect(speakMode(withDefaults({}), false)).toBe('clipboard');
    expect(speakMode(withDefaults({ speak: 'off' }), true)).toBe('off');
    expect(speakMode(withDefaults({ speak: 'clipboard' }), true)).toBe('clipboard');
  });
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
  it('réglages d’un agent : défauts (Créer, Guide, aucune PR), retouches à la main tolérées', () => {
    const none = { flow: 'create', autonomy: 'guide', pr: null };
    expect(agentVibe(agent('a', '/p'))).toEqual(none);
    expect(agentVibe({ ...agent('a', '/p'), vibe: { flow: 'review', autonomy: 'vibe', pr: 12 } })).toEqual({ flow: 'review', autonomy: 'vibe', pr: 12 });
    expect(agentVibe({ ...agent('a', '/p'), vibe: { flow: 'x', autonomy: 1, pr: 1.5 } as never })).toEqual(none);
    expect(agentVibe({ ...agent('a', '/p'), vibe: { flow: 'review', autonomy: 'guide', pr: -3 } })).toEqual({ ...none, flow: 'review' });
    expect(agentVibe({ ...agent('a', '/p'), vibe: 'cassé' as never })).toEqual(none);
  });
});
