// Invariants de la dictée côté principal. Protégés : si un test échoue,
// corriger le code.
//   I-4 : jamais de retour à la ligne dans une transcription (collée dans un
//         terminal, elle EXÉCUTERAIT la commande).
//   I-2 : ce qui est collé est le texte transcrit, tel quel.
//   I-5 : presse-papiers rendu après un collage réussi, pas après un échec ni
//         collage désactivé (le texte doit y rester).
//   I-6 : collage désactivé → aucune touche simulée.
import { describe, expect, it, vi } from 'vitest';
import { cleanTranscript, pasteText, type PasteTools } from 'core/dictation';

describe('transcription sur une ligne (I-4)', () => {
  it.each([
    'ligne un\nligne deux',
    'a\r\nb\rc\td',
    '\n\n  rm -rf /tmp/x\n',
    ' [BLANK_AUDIO]\nbonjour [Musique]\n',
    'x\u2028y',
  ])('%j', (raw) => {
    const out = cleanTranscript(raw);
    expect(out).not.toMatch(/[\r\n\t\u2028\u2029]/);
    expect(out).toBe(out.trim());
  });

  it('marqueurs de non-parole retirés', () => {
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('');
    expect(cleanTranscript(' [Musique] bonjour [Rires] ')).toBe('bonjour');
  });
});

// Un presse-papiers en mémoire : `snapshot` rend ce qu'il contient, `restore` le remet.
function tools(paste: () => Promise<boolean>) {
  const before = { text: 'ancien', html: '<b>ancien</b>' };
  const board = { content: { ...before } as Record<string, string> };
  const t: PasteTools = {
    clipboard: {
      snapshot: () => ({ ...board.content }),
      restore: (snap) => { board.content = { ...snap } as Record<string, string>; },
      writeText: (text) => { board.content = { text }; },
    },
    paste: vi.fn(paste),
    wait: () => Promise.resolve(),
  };
  return { t, board, before };
}

describe('collage et presse-papiers', () => {
  it('collage réussi : le texte transcrit est collé, puis le presse-papiers d’avant revient (I-2, I-5)', async () => {
    let pasted = '';
    const { t, board, before } = tools(async () => { pasted = board.content.text; return true; });
    expect(await pasteText('bonjour', true, t)).toBe(true);
    expect(pasted).toBe('bonjour');
    expect(board.content).toEqual(before);
  });

  it('collage raté : le texte reste dans le presse-papiers (I-5)', async () => {
    const { t, board } = tools(async () => false);
    expect(await pasteText('bonjour', true, t)).toBe(false);
    expect(board.content).toEqual({ text: 'bonjour' });
  });

  it('collage désactivé : aucune touche simulée, le texte reste (I-5, I-6)', async () => {
    const { t, board } = tools(async () => true);
    expect(await pasteText('bonjour', false, t)).toBe(false);
    expect(t.paste).not.toHaveBeenCalled();
    expect(board.content).toEqual({ text: 'bonjour' });
  });
});
