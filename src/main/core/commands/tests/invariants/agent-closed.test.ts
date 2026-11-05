// Invariant de la liste d'exceptions du registre des commandes. Protégé : si
// un test échoue, corriger le code (ou la table livrée), pas le test.
//   Note 0.15.0 (docs/tickets/feat/0.15.0-registre-commandes.md), « Ce que ça
//   ne doit pas faire » : ouvrir à un agent une commande de la liste
//   d'exceptions (répondre à une autorisation, accorder des droits, quitter ou
//   redémarrer l'appli). Seule la première est dans la table de cette étape :
//   run.allow, run.always, run.deny (I-13 à I-18) ; un agent ne s'accorde pas
//   de droits. Ouverte par défaut : une commande sans `agent: false` est
//   ouverte.
// Sur la fonction pure (parseCommands, le texte donné) et sur la vraie table
// livrée (resources/vibecoder/commands.json), lue sur le disque.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCommands } from 'core/commands';

const REAL_TABLE = path.resolve(__dirname, '../../../../../../resources/vibecoder/commands.json');

// Une réponse à une demande d'autorisation, sans son champ `agent` : chaque cas
// dit lui-même si elle est fermée, ouverte ou muette.
const answer = (name: string) => ({
  name,
  description: 'Answers a run\'s permission request. Fails when no request is pending.',
  kind: 'write',
  reason: 'An agent never grants itself rights: only the user answers a permission request (I-13 to I-18).',
  args: { type: 'object', properties: {}, additionalProperties: false },
});

// Le texte d'une table, schemaVersion 1, la cible dite une fois.
const table = (commands: object[]) => JSON.stringify({ schemaVersion: 1, target: 'The repository folder, its real path.', commands });

// Les trois réponses fermées, leur raison écrite : la table de référence.
const ALLOW = { ...answer('run.allow'), agent: false };
const ALWAYS = { ...answer('run.always'), agent: false };
const DENY = { ...answer('run.deny'), agent: false };

// La commande de ce nom dans la vraie table, lue par parseCommands.
const real = (name: string) => parseCommands(fs.readFileSync(REAL_TABLE, 'utf8')).commands.find((c) => c.name === name);

describe('parseCommands : une réponse à une autorisation ne s’ouvre pas aux agents', () => {
  it('la table de référence, les trois réponses fermées, est acceptée', () => {
    // témoin : les refus qui suivent tiennent au seul champ agent
    expect(() => parseCommands(table([ALLOW, ALWAYS, DENY]))).not.toThrow();
  });

  it('run.allow ouverte : la table est refusée', () => {
    const text = table([{ ...ALLOW, agent: true }, ALWAYS, DENY]);

    // refusée, et l'erreur nomme la commande
    expect(() => parseCommands(text)).toThrow(/run\.allow/);
  });

  it('run.always ouverte : la table est refusée', () => {
    const text = table([ALLOW, { ...ALWAYS, agent: true }, DENY]);

    // refusée, et l'erreur nomme la commande
    expect(() => parseCommands(text)).toThrow(/run\.always/);
  });

  it('run.deny ouverte : la table est refusée', () => {
    const text = table([ALLOW, ALWAYS, { ...DENY, agent: true }]);

    // refusée, et l'erreur nomme la commande
    expect(() => parseCommands(text)).toThrow(/run\.deny/);
  });

  it('run.allow sans champ agent, donc ouverte par défaut : la table est refusée', () => {
    // le champ manque : ouverte par défaut
    const text = table([answer('run.allow'), ALWAYS, DENY]);

    // refusée, et l'erreur nomme la commande
    expect(() => parseCommands(text)).toThrow(/run\.allow/);
  });

  it('run.allow avec agent: "false" (une chaîne, pas le booléen) : la table est refusée', () => {
    // une chaîne non vide : tout sauf false
    const text = table([{ ...ALLOW, agent: 'false' }, ALWAYS, DENY]);

    // refusée, et l'erreur nomme la commande
    expect(() => parseCommands(text)).toThrow(/run\.allow/);
  });

  it('une seconde run.allow, ouverte, à côté de la fermée : la table est refusée', () => {
    // un doublon ouvert ne contourne pas la fermeture
    const text = table([ALLOW, ALWAYS, DENY, { ...ALLOW, agent: true }]);

    // refusée, et l'erreur nomme la commande
    expect(() => parseCommands(text)).toThrow(/run\.allow/);
  });
});

describe('la table livrée : les réponses à une autorisation y sont, fermées', () => {
  it('run.allow est fermée aux agents', () => {
    // présente et fermée : absente, elle ne serait pas false
    expect(real('run.allow')?.agent).toBe(false);
  });

  it('run.always est fermée aux agents', () => {
    // présente et fermée : absente, elle ne serait pas false
    expect(real('run.always')?.agent).toBe(false);
  });

  it('run.deny est fermée aux agents', () => {
    // présente et fermée : absente, elle ne serait pas false
    expect(real('run.deny')?.agent).toBe(false);
  });
});
