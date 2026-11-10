import { describe, expect, it } from 'vitest';
import { beforeOf, nextRef, type NoteRef } from 'core/vibecoder';

const a = { path: 'a.md', text: 'A1' };
const b = { path: 'b.md', text: 'B1' };

describe('nextRef : sans référence', () => {
  it('rien qui écrit : null, avec ou sans note', () => {
    expect(nextRef(null, a, false)).toBeNull();
    expect(nextRef(null, null, false)).toBeNull();
  });

  it('qui écrit : la note du moment', () => {
    expect(nextRef(null, a, true)).toEqual({ path: 'a.md', text: 'A1' });
  });

  it("qui écrit sans note : { null, '' }", () => {
    expect(nextRef(null, null, true)).toEqual({ path: null, text: '' });
  });
});

describe('nextRef : une référence', () => {
  it('un relevé qui écrit (2e tour, une course) la garde, la note eût-elle changé', () => {
    const ref: NoteRef = { path: 'a.md', text: 'A1' };
    expect(nextRef(ref, { path: 'a.md', text: 'A2' }, true)).toEqual(ref);
    expect(nextRef(ref, { path: 'a.md', text: 'A3' }, false)).toEqual(ref);
  });

  it('une autre note : null, puis posée au premier relevé qui écrit', () => {
    const ref: NoteRef = { path: 'a.md', text: 'A1' };
    expect(nextRef(ref, b, false)).toBeNull();
    expect(nextRef(ref, b, true)).toEqual({ path: 'b.md', text: 'B1' });
  });

  it('posée sans note : la note qui paraît l\'adopte, son texte gardé ; beforeOf rend \'\'', () => {
    const ref = nextRef(null, null, true)!;
    const adopted = nextRef(ref, a, true);
    expect(adopted).toEqual({ path: 'a.md', text: '' });
    expect(nextRef(ref, a, false)).toEqual({ path: 'a.md', text: '' }); // même sans écrire
    expect(beforeOf(adopted, a)).toBe('');
  });

  it('plus de note, puis la même revenue : la ref gardée, son surlignage', () => {
    const ref: NoteRef = { path: 'a.md', text: 'A1' };
    const gone = nextRef(ref, null, false);
    expect(gone).toEqual(ref);
    const back = nextRef(gone, { path: 'a.md', text: 'A2' }, true);
    expect(back).toEqual(ref);
    expect(beforeOf(back, { path: 'a.md', text: 'A2' })).toBe('A1');
  });

  it('pas de note : la ref gardée, qu\'on écrive ou non', () => {
    const ref: NoteRef = { path: 'a.md', text: 'A1' };
    expect(nextRef(ref, null, true)).toBe(ref);
    expect(nextRef(ref, null, false)).toBe(ref);
  });

  it('une ref sans chemin et une note qui paraît, puis l\'autre fichier : repartie', () => {
    const adopted = nextRef({ path: null, text: '' }, a, false);
    expect(nextRef(adopted, b, false)).toBeNull();
  });
});

describe('beforeOf', () => {
  it('sans ref : null', () => {
    expect(beforeOf(null, a)).toBeNull();
  });

  it('même texte : null', () => {
    expect(beforeOf({ path: 'a.md', text: 'A1' }, a)).toBeNull();
  });

  it('autre fichier : null, même au texte différent', () => {
    expect(beforeOf({ path: 'b.md', text: 'autre' }, a)).toBeNull();
  });

  it('ref sans chemin : null (pas encore adoptée)', () => {
    expect(beforeOf({ path: null, text: '' }, a)).toBeNull();
  });

  it('changée : le texte de la ref', () => {
    expect(beforeOf({ path: 'a.md', text: 'avant' }, a)).toBe('avant');
  });
});
