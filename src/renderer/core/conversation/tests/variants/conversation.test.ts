import { describe, expect, it } from 'vitest';
import {
  appendDictation, createDrafts, cycle, EMPTY, gauge, kindOf, matchCommands, pickCommand, pieceLabel, slashQuery, titleOf, toDraft,
  visibleFrom, withAttached, withFile, type Piece,
} from 'core/conversation';
import { elapsed, kTokens } from 'helpers';
import type { Message } from 'technicals/bridge';

describe('brouillons (S-22)', () => {
  it('un brouillon par conversation, rendu au retour', () => {
    const d = createDrafts();
    const alpha = { text: 'un', pieces: [] };
    expect(d.switchTo('alpha', alpha, 'beta')).toBe(EMPTY);
    expect(d.switchTo('beta', { text: 'deux', pieces: [] }, 'alpha')).toBe(alpha);
    expect(d.switchTo('alpha', alpha, 'beta')).toEqual({ text: 'deux', pieces: [] });
  });

  it('envoyé : oublié', () => {
    const d = createDrafts();
    d.switchTo('alpha', { text: 'un', pieces: [] }, 'beta');
    d.drop('alpha');
    expect(d.switchTo('beta', EMPTY, 'alpha')).toBe(EMPTY);
  });

  it('dictée ajoutée avec une espace', () => {
    expect(appendDictation('', 'deux')).toBe('deux');
    expect(appendDictation('un', 'deux')).toBe('un deux');
    expect(appendDictation('un\n', 'deux')).toBe('un\ndeux');
  });
});

describe('format', () => {
  it('durées et jetons', () => {
    expect(elapsed(12_400)).toBe('12 s');
    expect(elapsed(65_000)).toBe('1 min 05 s');
    expect(kTokens(950)).toBe('950');
    expect(kTokens(45_000)).toBe('45 k');
    expect(kTokens(45_500)).toBe('45.5 k');
    expect(kTokens(200_000)).toBe('200 k');
  });

  it('jauge', () => {
    expect(gauge(undefined)).toMatchObject({ level: 'unknown', label: 'Contexte', pct: 0 });
    expect(gauge({ used: null, max: 200000 })).toMatchObject({ level: 'unknown' });
    expect(gauge({ used: 150000, max: 200000 })).toMatchObject({ level: 'ok', label: 'Contexte 75 %' });
    expect(gauge({ used: 160000, max: 200000 })).toMatchObject({ level: 'warn' });
    expect(gauge({ used: 190000, max: 200000 })).toMatchObject({ level: 'high' });
    expect(gauge({ used: 400000, max: 200000 }).pct).toBe(100);
  });

  it('intitulé', () => {
    expect(titleOf({ title: 'T', live: true })).toBe('T');
    expect(titleOf({ title: '', live: true })).toBe('Nouvelle conversation');
    expect(titleOf({ title: '', live: false })).toBe('Conversation sans titre');
  });

  it('réduit : depuis votre dernier message', () => {
    const m = (role: Message['role']): Message => ({ role, text: '' });
    const list = [m('user'), m('assistant'), m('user'), m('assistant'), m('system')];
    expect(visibleFrom(list, 'compact')).toBe(2);
    expect(visibleFrom(list, 'full')).toBe(0);
    expect(visibleFrom([m('assistant'), m('assistant')], 'compact')).toBe(1);
    expect(visibleFrom([], 'compact')).toBe(0);
  });
});

describe('pièces jointes', () => {
  const sel: Piece = { kind: 'selection', text: 'abc', cut: false };
  it('pictogrammes', () => {
    expect(kindOf('/a/b.png')).toBe('🖼');
    expect(kindOf('/a/dossier')).toBe('📁');
    expect(kindOf('/a/b.xyz')).toBe('📎');
  });

  it('un fichier une fois ; la sélection remplace la précédente', () => {
    let p = withFile([], '/a/b.txt');
    p = withFile(p, '/a/b.txt');
    expect(p).toHaveLength(1);
    p = withAttached([...p, sel], { selection: { text: 'xyz', cut: true }, files: ['/a/b.txt', '/c'] });
    expect(p.map(pieceLabel)).toEqual(['📄 b.txt', '❝ Sélection (3 car., coupée)', '📁 c']);
  });

  it('brouillon envoyé', () => {
    const data = new ArrayBuffer(4);
    const pieces: Piece[] = [{ kind: 'image', name: 'i.png', type: 'image/png', data, url: 'blob:x' }, { kind: 'file', name: 'b', path: '/b' }, sel];
    expect(toDraft('salut', pieces)).toEqual({ text: 'salut', images: [{ name: 'i.png', type: 'image/png', data }], files: ['/b'], selection: 'abc' });
    expect(toDraft('', [])).toEqual({ text: '', images: [], files: [], selection: '' });
  });
});

describe('commandes « / »', () => {
  const list = [{ name: 'compact', description: '' }, { name: 'context', description: '' }, { name: 'recompile', description: '' }];
  it('requête jusqu’au curseur', () => {
    expect(slashQuery('/Co', 3)).toBe('co');
    expect(slashQuery('/co x', 5)).toBe(null);
    expect(slashQuery('bonjour', 3)).toBe(null);
  });
  it('d’abord ce qui commence par la saisie', () => {
    expect(matchCommands(list, 'comp').map((c) => c.name)).toEqual(['compact', 'recompile']);
  });
  it('choix : la commande puis le reste du champ', () => {
    expect(pickCommand('/co  la suite', 3, list[0])).toEqual({ value: '/compact la suite', caret: 9 });
    expect(cycle(0, -1, 3)).toBe(2);
    expect(cycle(2, 1, 3)).toBe(0);
  });
});
