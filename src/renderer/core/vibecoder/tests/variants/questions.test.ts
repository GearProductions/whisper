import { describe, expect, it } from 'vitest';
import { answersOf, answerText } from 'core/vibecoder';

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
