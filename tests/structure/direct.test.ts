// Règles de structure des actions directes de VibeCoder (SPEC I-39) : qui
// importe technicals/direct, et par où le contrôleur lance le lanceur. Elles
// lisent le code du principal au lieu d'observer un comportement ; une
// retouche se signale dans la PR. Ne connaissent pas le comportement de
// l'appli. Utilisées par npm test.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sources } from './sources';

const SRC = path.resolve(__dirname, '../../src/main');

describe('rien sans un clic', () => {
  it('seul app/controllers/vibecoder importe technicals/direct', () => {
    const importers = sources(SRC).filter(([, text]) => /from ['"](technicals\/direct|\.\/direct)['"]/.test(text))
      .map(([f]) => path.relative(SRC, f)).filter((f) => !f.startsWith(path.join('technicals', 'direct')));
    expect(importers).toEqual([path.join('app', 'controllers', 'vibecoder.ts')]);
  });

  // Note 0.15.0-socket-interface (décidé) : les boutons passent par le socket ; une action directe n'est lancée que
  // par l'exécuteur, une commande de la table (controllers/commands : runCommand), jamais au relevé.
  it('le contrôleur ne lance le lanceur que par l\'exécuteur, une commande de la table (jamais au relevé)', () => {
    // les fonctions de premier niveau d'un fichier du contrôleur, par nom
    const fnsOf = (file: string) => Object.fromEntries(fs.readFileSync(path.join(SRC, 'app', 'controllers', file), 'utf8')
      .split(/\n(?=(?:export )?(?:async )?function )/).map((chunk) => [/function (\w+)/.exec(chunk)?.[1] ?? '', chunk]));
    const using = (fns: Record<string, string>, needle: string) => Object.keys(fns).filter((name) => name && fns[name].includes(needle));
    const vibecoder = fnsOf('vibecoder.ts');
    const commands = fnsOf('commands.ts');
    expect(using(vibecoder, 'directRunner(')).toEqual(['runDirect']);
    expect(using(vibecoder, 'runDirect(').filter((n) => n !== 'runDirect')).toEqual([]);
    expect(using(commands, 'runDirect(')).toEqual(['runCommand']);
  });
});

describe('les modules en lecture restent en lecture', () => {
  it('technicals/git et technicals/github n’importent pas technicals/direct', () => {
    for (const m of ['git', 'github']) {
      const dir = path.join(SRC, 'technicals', m);
      for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/technicals\/direct/);
      }
    }
  });
});
