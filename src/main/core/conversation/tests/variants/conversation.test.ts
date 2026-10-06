import { describe, expect, it } from 'vitest';
import { composeMessage, permissionView, prepareDraft, relativeTo, splitComposed, toolSummary } from 'core/conversation';

describe('actions de l’agent', () => {
  it('chemins raccourcis, /home et /var/home', () => {
    expect(relativeTo('/home/u/p', 'cat /var/home/u/p/src/a.ts /home/u/p/b')).toBe('cat src/a.ts b');
    expect(relativeTo('/var/home/u/p/', 'x /home/u/p/c')).toBe('x c');
  });
  it('une ligne courte', () => {
    expect(toolSummary('/home/u/p', 'Write', { file_path: '/home/u/p/src/note.txt' })).toBe('Écrire le fichier : src/note.txt');
    expect(toolSummary('/p', 'Bash', { command: 'npm test\n&& echo fini' })).toBe('Exécuter la commande : npm test');
    expect(toolSummary('/p', 'TodoWrite', { todos: [] })).toBe('TodoWrite');
  });
  it('titre d’une demande, avec celles qui attendent', () => {
    const p = { key: 3, tool: 'Bash', input: { command: 'ls' }, always: [], waiting: 2 };
    expect(permissionView('alpha', p).title).toBe('alpha demande l\'autorisation (2 autres en attente)');
    expect(permissionView('alpha', { ...p, waiting: 0 }).title).toBe('alpha demande l\'autorisation');
  });
});

describe('message composé', () => {
  it('aller et retour', () => {
    const m = composeMessage('regarde', 'ligne 1\nligne 2', ['/a/b.md', '/c']);
    expect(splitComposed(m)).toEqual({ text: 'regarde', selection: 'ligne 1\nligne 2', files: ['/a/b.md', '/c'] });
    expect(splitComposed('juste du texte')).toEqual({ text: 'juste du texte', selection: '', files: [] });
  });
  it('un bloc n’est reconnu qu’à sa place', () => {
    const text = 'Fichiers joints (chemins sur cette machine) :\n- pas en fin\nsuite';
    expect(splitComposed(text).files).toEqual([]);
  });
});

describe('brouillon envoyé', () => {
  const tools = {
    prepareImage: (img: { name?: string }) => (img.name === 'abimee.png' ? null : { mediaType: 'image/png', data: 'AAAA' }),
    files: { size: () => 10, read: () => Buffer.from('x') },
  };
  it('texte, sélection, fichiers ; une image désignée par son chemin part en image', () => {
    const r = prepareDraft({ text: ' salut ', selection: 'sel', files: ['/a/b.txt', '/a/i.png', 'relatif.txt'], images: [] }, tools);
    expect(r.error).toBeUndefined();
    expect(r).toMatchObject({ message: { images: [{ mediaType: 'image/png' }] } });
    expect('message' in r && splitComposed(r.message.text)).toEqual({ text: 'salut', selection: 'sel', files: ['/a/b.txt'] });
  });
  it('erreurs', () => {
    expect(prepareDraft({ text: '' }, tools)).toEqual({ error: 'Message vide.' });
    expect(prepareDraft({ images: [{ name: 'abimee.png' }] }, tools)).toEqual({ error: 'Image illisible ou trop lourde : abimee.png.' });
    expect(prepareDraft({ files: Array.from({ length: 51 }, (_v, i) => `/f${i}`) }, tools).error).toMatch(/Trop de pièces jointes/);
    expect(prepareDraft({ files: ['/a/i.png'] }, { ...tools, files: { size: () => 60 * 1024 * 1024, read: () => Buffer.alloc(0) } }))
      .toEqual({ error: 'Image trop lourde : i.png.' });
    expect(prepareDraft(null, tools)).toEqual({ error: 'Message vide.' });
  });
});
