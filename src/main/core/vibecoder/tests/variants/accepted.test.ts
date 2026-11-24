import { describe, expect, it } from 'vitest';
import type { VibeQuestion } from 'shared/bridge';
import { acceptedTexts, onlyAccepted } from 'core/vibecoder';

const T1 = 'Il se tait la nuit.';
const T2 = 'Il ne parle qu’en semaine.';
const ok = (text: string) => `**Accepter** — *Ce que ça fait, puce 2* : « ${text} »`;
const ko = (text: string) => `**Refuser** — *Ce que ça fait, puce 2* : « ${text} »`;
const question = (n: number, ...options: string[]): VibeQuestion => ({ n, text: `Question ${n} ?`, options });

describe('acceptedTexts : les textes d\'un « Accepter » choisi tel quel', () => {
  it('une réponse « Accepter » choisie telle quelle : son texte entre « »', () => {
    expect(acceptedTexts([question(1, ok(T1), ko(T1))], [ok(T1)])).toEqual([T1]);
  });

  it('« Accept », en anglais : de même', () => {
    const accept = `**Accept** — *What it does, bullet 2*: « ${T1} »`;
    expect(acceptedTexts([question(1, accept, '**Refuse**')], [accept])).toEqual([T1]);
  });

  it.each([
    ['« Refuser »', ko(T1)],
    ['« Conseille-moi »', '**Conseille-moi**'],
    ['une réponse libre', 'Oui, pourquoi pas.'],
    ['une réponse libre qui cite le texte', `Mets plutôt : « ${T1} »`],
    ['une réponse vide', ''],
  ])('%s : rien', (_, answer) => {
    expect(acceptedTexts([question(1, ok(T1), ko(T1), '**Conseille-moi**')], [answer])).toEqual([]);
  });

  it('un « Accepter » suivi d\'une précision libre : rien', () => {
    expect(acceptedTexts([question(1, ok(T1))], [`${ok(T1)} Mais seulement en semaine.`])).toEqual([]);
  });

  it('plusieurs questions : les textes dans l\'ordre des questions', () => {
    const questions = [question(1, ok(T1)), question(2, ok(T2)), question(3, ok('Autre.'))];
    expect(acceptedTexts(questions, [ok(T1), ok(T2), 'libre'])).toEqual([T1, T2]);
    expect(acceptedTexts(questions, [ok(T1), 'libre', ok('Autre.')])).toEqual([T1, 'Autre.']);
  });

  it('un « Accepter » qui n\'est pas une option de sa question : rien', () => {
    expect(acceptedTexts([question(1, ok(T1))], [ok(T2)])).toEqual([]);
  });

  it('moins de réponses que de questions : ce qui est répondu seul compte', () => {
    expect(acceptedTexts([question(1, ok(T1)), question(2, ok(T2))], [ok(T1)])).toEqual([T1]);
  });

  it('un texte qui contient lui-même des « » : entier', () => {
    expect(acceptedTexts([question(1, ok('Il dit « bonjour ».'))], [ok('Il dit « bonjour ».')])).toEqual(['Il dit « bonjour ».']);
  });
});

describe('onlyAccepted : la conception n\'est que la validée plus des textes acceptés', () => {
  const VALIDATED = '# Note\n\n## Ce que ça fait\n- Un bouton qui dit bonjour.\n- Il compte les clics.\n\n## Ne doit pas\n- Crier.\n';
  const insert = (after: string, text: string) => VALIDATED.replace(after, `${after}\n${text}`);

  it('la conception inchangée : vrai', () => {
    expect(onlyAccepted(VALIDATED, VALIDATED, [])).toBe(true);
  });

  it('un texte accepté ajouté tel quel, à sa place : vrai', () => {
    expect(onlyAccepted(VALIDATED, insert('- Un bouton qui dit bonjour.', T1), [T1])).toBe(true);
  });

  it('les blancs de fin de ligne et les lignes vides autour d\'un ajout ne comptent pas', () => {
    const now = insert('- Un bouton qui dit bonjour.', `\n${T1}   \n`).replace('Crier.', 'Crier.  ');
    expect(onlyAccepted(VALIDATED, now, [T1])).toBe(true);
  });

  it('un texte accepté ajouté en fin, après une ligne vide : vrai', () => {
    expect(onlyAccepted(VALIDATED, `${VALIDATED}\n${T1}\n`, [T1])).toBe(true);
  });

  it('une ligne vide retirée ou ajoutée loin d\'un ajout : faux', () => {
    expect(onlyAccepted(VALIDATED, insert('- Il compte les clics.', T1).replace('\n\n## Ne doit pas', '\n## Ne doit pas'), [T1])).toBe(false);
    expect(onlyAccepted(VALIDATED, insert('- Il compte les clics.', T1).replace('- Il compte', '\n- Il compte'), [T1])).toBe(false);
  });

  it('deux textes acceptés ajoutés : vrai', () => {
    const now = insert('- Il compte les clics.', T2).replace('- Un bouton qui dit bonjour.', `${T1}\n- Un bouton qui dit bonjour.`);
    expect(onlyAccepted(VALIDATED, now, [T1, T2])).toBe(true);
  });

  it('un texte accepté ajouté avec un mot changé : faux', () => {
    expect(onlyAccepted(VALIDATED, insert('- Un bouton qui dit bonjour.', 'Il se tait le jour.'), [T1])).toBe(false);
  });

  it('un texte accepté, plus une autre ligne ajoutée : faux', () => {
    const now = insert('- Un bouton qui dit bonjour.', `${T1}\nEt il clignote.`);
    expect(onlyAccepted(VALIDATED, now, [T1])).toBe(false);
  });

  it('une ligne de la conception validée retirée : faux', () => {
    expect(onlyAccepted(VALIDATED, insert('- Un bouton qui dit bonjour.', T1).replace('- Il compte les clics.\n', ''), [T1])).toBe(false);
  });

  it('une ligne de la conception validée réécrite : faux', () => {
    expect(onlyAccepted(VALIDATED, insert('- Un bouton qui dit bonjour.', T1).replace('Crier.', 'Chanter.'), [T1])).toBe(false);
  });

  it('un changement sans aucun texte accepté : faux', () => {
    expect(onlyAccepted(VALIDATED, insert('- Un bouton qui dit bonjour.', T1), [])).toBe(false);
  });

  it('un texte ajouté qui n\'est pas dans les acceptés : faux', () => {
    expect(onlyAccepted(VALIDATED, insert('- Un bouton qui dit bonjour.', T1), [T2])).toBe(false);
  });

  it('un texte accepté ajouté deux fois, accepté une fois : faux', () => {
    const now = insert('- Un bouton qui dit bonjour.', `${T1}\n${T1}`);
    expect(onlyAccepted(VALIDATED, now, [T1])).toBe(false);
    expect(onlyAccepted(VALIDATED, now, [T1, T1])).toBe(true);
  });

  it('un texte accepté qui existe déjà dans la validée, ajouté en double : vrai', () => {
    const now = `${VALIDATED}- Crier.\n`;
    expect(onlyAccepted(VALIDATED, now, ['- Crier.'])).toBe(true);
  });

  it('des lignes de la validée dans un autre ordre : faux', () => {
    expect(onlyAccepted('a\nb\n', 'b\na\n', ['a'])).toBe(false);
  });

  it('vides : vrai', () => {
    expect(onlyAccepted('', '', [])).toBe(true);
  });
});
