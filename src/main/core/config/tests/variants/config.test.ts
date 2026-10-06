import { describe, expect, it } from 'vitest';
import {
  agentColor, agentList, agentSlotCount, favoriteFolders, folderColors, randomColor, selectedAgent, speakMode, speakVolume, withDefaults,
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
