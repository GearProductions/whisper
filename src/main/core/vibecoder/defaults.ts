/** defaults — les fichiers de VibeCoder chez l'utilisateur (actions, skills,
 *  README de userData/vibecoder/), écrits par défaut sans jamais écraser une
 *  retouche. Un manifeste, <dir>/.defaults.json ({ chemin: sha1 de ce que nous
 *  avons écrit }), dit si un fichier est encore le nôtre : absent, il est
 *  écrit ; inchangé depuis notre écriture, il suit le nouveau défaut ; modifié
 *  par l'utilisateur, jamais écrit par nous, ou illisible, il est gardé tel
 *  quel. Manifeste illisible : rien n'est plus à nous (seul l'absent est écrit).
 *  Et les variantes des skills qui fixent leur modèle, un autre modèle chacune
 *  (skillVariants) : générées, pas des défauts — hors manifeste, réécrites à
 *  chaque démarrage.
 *  Ne connaît pas : Electron, node:fs (le disque est passé).
 *  Utilisé par : app/settings (ensureVibeFiles). */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { SKILL_MODELS, skillModel } from './actions';

// read : null si le fichier manque, une erreur s'il est illisible (EACCES…) ; write crée ses dossiers.
export type Disk = { read(path: string): string | null; write(path: string, content: string): void };
export type DefaultFile = { path: string; content: string };   // chemin relatif au dossier

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

// written : écrits (absents, ou encore les nôtres) ; kept : gardés tels quels (retouchés, ou pas de nous).
export function syncDefaults(dir: string, defaults: DefaultFile[], disk: Disk): { written: string[]; kept: string[] } {
  const manifestPath = path.join(dir, '.defaults.json');
  let manifest: Record<string, string> = {};
  try {
    const parsed = JSON.parse(disk.read(manifestPath) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manifest = parsed;
  } catch { /* illisible : rien n'est plus à nous */ }
  const written: string[] = [];
  const kept: string[] = [];
  for (const d of defaults) {
    const file = path.join(dir, d.path);
    let current: string | null;
    try { current = disk.read(file); } catch { kept.push(d.path); continue; }   // illisible n'est pas absent
    if (current === d.content) manifest[d.path] = sha1(d.content);      // déjà le défaut : le nôtre
    else if (current === null || (Object.hasOwn(manifest, d.path) && manifest[d.path] === sha1(current))) {
      disk.write(file, d.content);
      manifest[d.path] = sha1(d.content);
      written.push(d.path);
    } else kept.push(d.path);
  }
  disk.write(manifestPath, JSON.stringify(manifest, null, 2));
  return { written, kept };
}

const DEFAULT_EFFORT: Record<string, string> = { haiku: 'low', sonnet: 'medium', opus: 'high' };
const COPIED = ['description', 'argument-hint', 'disable-model-invocation', 'allowed-tools', 'context'];

// Les variantes du skill `name` s'il fixe son modèle parmi SKILL_MODELS
// (skillModel), une par autre modèle m : plugin/skills/<name>--<m>/SKILL.md,
// le même en-tête (description, argument-hint, disable-model-invocation,
// allowed-tools ; context: fork seulement s'il l'a), model: m et son effort par défaut (haiku
// low, sonnet medium, opus high), un corps qui renvoie au skill. Aucune pour
// un autre skill, ni pour une variante.
export function skillVariants(name: string, skillMd: string): DefaultFile[] {
  const model = skillModel(skillMd);
  if (!model || new RegExp(`--(${SKILL_MODELS.join('|')})$`).test(name)) return [];
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)![1].split(/\r?\n/);
  const copied = head.filter((line) => COPIED.some((key) => line.startsWith(`${key}:`)));
  return SKILL_MODELS.filter((m) => m !== model).map((m) => ({
    path: `plugin/skills/${name}--${m}/SKILL.md`,
    content: ['---', `name: ${name}--${m}`, ...copied, `model: ${m}`, `effort: ${DEFAULT_EFFORT[m]}`, '---', '',
      `Follow exactly the instructions of \`\${CLAUDE_SKILL_DIR}/../${name}/SKILL.md\` with these arguments: $ARGUMENTS`, ''].join('\n'),
  }));
}

// Les fichiers du manifeste qui ne sont plus livrés et n'ont pas été retouchés : supprimés,
// avec les variantes d'un SKILL.md. Rend les chemins supprimés.
export function removeRetired(_dir: string, _defaults: DefaultFile[], _disk: Disk & { remove(path: string): void }): string[] {
  throw new Error('not implemented');
}
