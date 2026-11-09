import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createJournal } from 'technicals/journal';

it('une ligne par évènement ; au-delà de 1 Mo, l’ancien passe en .old', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-'));
  const file = path.join(dir, 'agents.log');
  const journal = createJournal(() => file);
  journal({ id: 'a1', name: 'alpha' }, 'tour commencé', 'mode default');
  expect(fs.readFileSync(file, 'utf8')).toMatch(/^\S+ {2}alpha {2}tour commencé {2}mode default\n$/);
  fs.writeFileSync(file, 'x'.repeat(1024 * 1024 + 1));
  journal({ id: 'a1' }, 'tour fini');
  expect(fs.statSync(`${file}.old`).size).toBe(1024 * 1024 + 1);
  expect(fs.readFileSync(file, 'utf8')).toMatch(/ {2}a1 {2}tour fini\n$/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Un journal impossible à écrire n'arrête jamais un agent (SPEC I-29).
describe('journal des agents', () => {
  it('fichier inaccessible : aucune erreur', () => {
    const journal = createJournal(() => '/proc/interdit/agents.log');
    expect(() => journal({ id: 'a1', name: 'alpha' }, 'tour commencé', 'détail')).not.toThrow();
  });
  it('sans fichier : rien', () => {
    expect(() => createJournal(() => null)({ id: 'a1' }, 'x')).not.toThrow();
  });
});
