// Invariant du coût : VibeCoder ne choisit jamais Fable de lui-même.
// Protégé : si un test échoue, corriger le code (ou le skill, l'action livrés).
//   Note 0.8.0, « Ce que ça ne doit pas faire » : choisir Fable de lui-même —
//   aucune action ni aucun skill livré ne fait travailler Fable ; seul un clic
//   de l'utilisateur (menu du robot, barre d'état, pastille de la note et de
//   la forme) y passe l'agent.
// Sur les fichiers livrés (resources/vibecoder/) : un skill fixe son modèle
// (haiku, sonnet, opus) ou garde celui de l'agent ; une action n'envoie que son
// gabarit, où seul {{text}} (le champ de l'utilisateur) est libre.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../../../../resources/vibecoder');

// Les fichiers d'un dossier livré, sous-dossiers compris : [chemin, contenu] ;
// aucun si le dossier manque.
function files(dir: string): [string, string][] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e): [string, string][] => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : [[p, fs.readFileSync(p, 'utf8')]];
  });
}
const plugin = () => files(path.join(ROOT, 'plugin'));
const skills = () => plugin().filter(([p]) => path.basename(p) === 'SKILL.md');
const actions = () => files(ROOT).filter(([p]) => /^actions\.[a-z]+\.json$/.test(path.basename(p)));

// Le modèle que fixe l'en-tête (frontmatter) d'un skill ; null : celui de l'agent.
function model(md: string): string | null {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? '';
  const m = /^model:[ \t]*(.*?)[ \t]*$/m.exec(head);
  return m ? m[1].replace(/^(['"])(.*)\1$/, '$2') : null;
}

describe('Fable, seulement sur un clic de l’utilisateur', () => {
  it('des skills sont livrés', () => {
    // au moins un : la vérification suivante porte sur quelque chose
    expect(skills().length).toBeGreaterThan(0);
  });

  it('chaque skill livré travaille sur haiku, sonnet, opus, ou le modèle de l’agent', () => {
    const others = skills().filter(([, md]) => { const m = model(md); return m !== null && !['haiku', 'sonnet', 'opus'].includes(m); });
    // aucun skill ne fixe un autre modèle (fable, son identifiant complet, inherit…)
    expect(others.map(([p]) => path.relative(ROOT, p))).toEqual([]);
  });

  it('rien dans le plugin livré ne nomme Fable (ni un skill, ni un sous-agent qu’il lancerait)', () => {
    // aucun fichier du plugin ne mentionne Fable
    expect(plugin().filter(([, s]) => /fable/i.test(s)).map(([p]) => path.relative(ROOT, p))).toEqual([]);
  });

  it('des actions sont livrées, en français et en anglais', () => {
    const found = actions();
    // les deux langues de l'écran ont leur fichier
    expect(found.map(([p]) => path.basename(p)).sort()).toEqual(['actions.en.json', 'actions.fr.json']);
    // chacun avec au moins une action
    expect(found.filter(([, s]) => !(JSON.parse(s).length > 0)).map(([p]) => path.basename(p))).toEqual([]);
  });

  it('aucune action livrée ne nomme Fable ni ne change de modèle (/model)', () => {
    // ni « fable » ni « /model » dans les actions livrées
    expect(actions().filter(([, s]) => /fable|\/model\b/i.test(s)).map(([p]) => path.basename(p))).toEqual([]);
  });
});
