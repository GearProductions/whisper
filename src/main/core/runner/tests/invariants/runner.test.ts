// Invariants des commandes du projet (onglet Processus de VibeCoder).
// Protégés : si un test échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : lancer autre chose que les
//   commandes du fichier du projet — une page désigne une commande par son
//   rang, jamais par un texte ; le fichier n'est écrit par l'appli que s'il
//   n'existe pas. Exception à I-27, limitée à ces commandes : `bash -ic`.
//   Et : les demandes de l'agent (<out>/run/<nom>.stop, .restart) n'agissent
//   que sur les noms du fichier.
import { describe, expect, it } from 'vitest';
import { commandAt, parseProject, requestsOf, type Project } from 'core/runner';

const project = parseProject(JSON.stringify({
  commands: [{ name: 'serveur', run: 'npm run dev' }, { name: 'front', run: 'gear front', cwd: 'web' }],
})) as Project;

describe('une commande se désigne par son rang dans le fichier du projet', () => {
  it('un rang du fichier : sa commande, dans bash -ic, rien d’autre', () => {
    expect(commandAt(project, 0, '')).toEqual({ name: 'serveur', argv: ['bash', '-ic', 'npm run dev'], cwd: undefined });
  });

  it('un texte n’est pas un rang', () => {
    expect(commandAt(project, 'npm run dev', '')).toBeNull();
  });

  it('un rang en texte n’est pas un rang', () => {
    expect(commandAt(project, '0', '')).toBeNull();
  });

  it('un rang hors du fichier : rien', () => {
    expect(commandAt(project, 2, '')).toBeNull();
  });

  it('un rang négatif : rien', () => {
    expect(commandAt(project, -1, '')).toBeNull();
  });

  it('un rang non entier : rien', () => {
    expect(commandAt(project, 0.5, '')).toBeNull();
  });

  it('un objet qui porte une commande : rien', () => {
    expect(commandAt(project, { run: 'rm -rf ~' }, '')).toBeNull();
  });

  it('sans fichier du projet : rien', () => {
    expect(commandAt(null, 0, '')).toBeNull();
  });
});

describe('les demandes de l’agent', () => {
  it('<nom>.stop et <nom>.restart d’un nom du fichier : la demande', () => {
    expect(requestsOf(['serveur.stop', 'front.restart'], project)).toEqual([
      { name: 'serveur', op: 'stop', file: 'serveur.stop' },
      { name: 'front', op: 'restart', file: 'front.restart' },
    ]);
  });

  it('un nom absent du fichier : ignoré', () => {
    expect(requestsOf(['inconnu.stop', 'inconnu.restart'], project)).toEqual([]);
  });

  it('un autre suffixe : ignoré', () => {
    expect(requestsOf(['serveur.start', 'serveur.log', 'serveur.kill'], project)).toEqual([]);
  });

  it('un chemin : ignoré', () => {
    expect(requestsOf(['../serveur.stop', 'x/serveur.stop'], project)).toEqual([]);
  });

  it('sans fichier du projet : aucune demande', () => {
    expect(requestsOf(['serveur.stop'], null)).toEqual([]);
  });
});
