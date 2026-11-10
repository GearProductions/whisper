import { describe, expect, it } from 'vitest';
import { answersOf, answerText, optionParts } from 'core/vibecoder';

const q = { n: 1, text: 'Quelle taille par défaut ?', options: ['1280 × 820', '1440 × 900'] };

describe('answerText', () => {
  it('une réponse proposée : son texte', () => {
    expect(answerText(q, { choice: 1, free: '' }, 'fr')).toBe('1440 × 900');
  });

  it('réponse proposée et précision : jointes par « — », sur une ligne', () => {
    expect(answerText(q, { choice: 0, free: ' redimensionnable\n  et retenue ' }, 'fr')).toBe('1280 × 820 — redimensionnable et retenue');
  });

  it('Conseille-moi, Je te laisse trancher : dans la langue de l\'écran', () => {
    expect(answerText(q, { choice: 'advise', free: '' }, 'fr')).toBe('Conseille-moi : que recommandes-tu, et pourquoi ?');
    expect(answerText(q, { choice: 'decide', free: '' }, 'en')).toBe('Your call.');
    expect(answerText(q, { choice: 'decide', free: 'mais pas plus de 1440' }, 'fr')).toBe('Je te laisse trancher. — mais pas plus de 1440');
  });

  it('précision seule : elle', () => {
    expect(answerText(q, { choice: null, free: 'plein écran' }, 'fr')).toBe('plein écran');
  });

  it('rien, ou un rang hors des réponses : vide (le principal écrit « (pas de réponse) »)', () => {
    expect(answerText(q, undefined, 'fr')).toBe('');
    expect(answerText(q, { choice: null, free: '  ' }, 'fr')).toBe('');
    expect(answerText(q, { choice: 7, free: '' }, 'fr')).toBe('');
  });
});

describe('answersOf', () => {
  it('une réponse par question, dans leur ordre, par texte de question', () => {
    const q2 = { n: 2, text: 'constructor', options: [] };
    expect(answersOf([q, q2], { [q.text]: { choice: 0, free: '' } }, 'fr')).toEqual(['1280 × 820', '']);
  });
});

describe('optionParts', () => {
  const line = '**Accepter** — *« Ce que ça fait », puce 2* : « ajouter X »';

  it('trois parties : le choix, l\'où, le texte cité', () => {
    expect(optionParts(line)).toEqual({ choice: 'Accepter', where: '« Ce que ça fait », puce 2', quote: '« ajouter X »' });
  });

  it('séparateur « · », « : », ou aucun, blancs en trop', () => {
    const want = { choice: 'Refuser', where: 'Rubrique, puce 1', quote: '« x »' };
    expect(optionParts('**Refuser** · *Rubrique, puce 1* · « x »')).toEqual(want);
    expect(optionParts('**Refuser**: *Rubrique, puce 1*: « x »')).toEqual(want);
    expect(optionParts('**Refuser** *Rubrique, puce 1* « x »')).toEqual(want);
    expect(optionParts('  **Refuser**   —   *Rubrique, puce 1*   «\u00a0x »  ')).toEqual({ ...want, quote: '«\u00a0x »' });
  });

  it('une citation avec du code, du gras, une * : gardée telle quelle', () => {
    expect(optionParts('**Accepter** — *R, puce 1* : « appeler `f(*args)` et **vite** »')?.quote).toBe('« appeler `f(*args)` et **vite** »');
    expect(optionParts('**Accepter** *R* a * b')?.quote).toBe('a * b');
  });

  it('pas de gras en tête, pas d\'italique ensuite, rien après : null', () => {
    expect(optionParts('Accepter — *R, puce 1* : « x »')).toBeNull();
    expect(optionParts('un **Accepter** — *R* : « x »')).toBeNull();
    expect(optionParts('**Accepter** — R, puce 1 : « x »')).toBeNull();
    expect(optionParts('**Accepter** — *R, puce 1*')).toBeNull();
    expect(optionParts('**Accepter** — *R, puce 1* :  ')).toBeNull();
    expect(optionParts('1280 × 820')).toBeNull();
    expect(optionParts('')).toBeNull();
  });

  it('parties vides, ***, deux séparateurs : null', () => {
    expect(optionParts('**** — *R* : « x »')).toBeNull();
    expect(optionParts('** ** — *R* : « x »')).toBeNull();
    expect(optionParts('**A** — ** : « x »')).toBeNull();
    expect(optionParts('**A** — * * : « x »')).toBeNull();
    expect(optionParts('***A*** — *R* : « x »')).toBeNull();
    expect(optionParts('**A** — : *R* : « x »')).toBeNull();
    expect(optionParts('**A** — *R* : — « x »')).toBeNull();
  });

  it('pas de HTML rendu : le texte reste du texte', () => {
    expect(optionParts('**A** — *<b>R</b>* : <i>x</i>')).toEqual({ choice: 'A', where: '<b>R</b>', quote: '<i>x</i>' });
  });

  it('answerText d\'une réponse en trois parties : la ligne telle qu\'écrite', () => {
    const q3 = { n: 1, text: 'Cette puce ?', options: [line] };
    expect(answerText(q3, { choice: 0, free: '' }, 'fr')).toBe(line);
    expect(answerText(q3, { choice: 0, free: 'mais plus court' }, 'fr')).toBe(`${line} — mais plus court`);
  });
});
