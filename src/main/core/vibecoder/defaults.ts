/** defaults — les fichiers de VibeCoder chez l'utilisateur (actions, skills,
 *  README de userData/vibecoder/), écrits par défaut sans jamais écraser une
 *  retouche, et retirés (removeRetired) quand l'appli ne les livre plus, s'ils
 *  n'ont pas été retouchés. Un manifeste, <dir>/.defaults.json ({ chemin: sha1 de ce que nous
 *  avons écrit }), dit si un fichier est encore le nôtre : absent, il est
 *  écrit ; inchangé depuis notre écriture, il suit le nouveau défaut ; modifié
 *  par l'utilisateur, jamais écrit par nous, ou illisible, il est gardé tel
 *  quel. Manifeste illisible : rien n'est plus à nous (seul l'absent est écrit).
 *  Et les variantes des skills qui fixent leur modèle, un autre modèle
 *  ou un autre effort chacune (skillVariants) : générées, pas des défauts — hors
 *  manifeste, réécrites à chaque démarrage.
 *  Ne connaît pas : Electron, node:fs (le disque est passé).
 *  Utilisé par : app/settings (ensureVibeFiles). */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { EFFORT_LEVELS, SKILL_MODELS, skillModel } from './actions';

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
// (skillModel) : plugin/skills/<name>--<m>/SKILL.md pour chaque autre modèle m
// (son effort par défaut : haiku low, sonnet medium, opus high), et
// <name>--<m>--<e> pour chaque modèle et chaque effort de EFFORT_LEVELS, tous : buildMessage
// nomme le couple choisi sans connaître l'effort du skill. Le même
// en-tête (description, argument-hint, disable-model-invocation, allowed-tools ;
// context: fork seulement s'il l'a), model: m, effort: e, un corps qui renvoie
// au skill. Aucune pour un autre skill, ni pour une variante.
export function skillVariants(name: string, skillMd: string): DefaultFile[] {
  const model = skillModel(skillMd);
  if (!model || new RegExp(`--(${SKILL_MODELS.join('|')})(--(${EFFORT_LEVELS.join('|')}))?$`).test(name)) return [];
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)![1].split(/\r?\n/);
  const copied = head.filter((line) => COPIED.some((key) => line.startsWith(`${key}:`)));
  const variant = (m: string, e: string, suffix: string): DefaultFile => ({
    path: `plugin/skills/${name}${suffix}/SKILL.md`,
    content: ['---', `name: ${name}${suffix}`, ...copied, `model: ${m}`, `effort: ${e}`, '---', '',
      `Follow exactly the instructions of \`\${CLAUDE_SKILL_DIR}/../${name}/SKILL.md\` with these arguments: $ARGUMENTS`, ''].join('\n'),
  });
  const others = SKILL_MODELS.filter((m) => m !== model);
  return [
    ...others.map((m) => variant(m, DEFAULT_EFFORT[m], `--${m}`)),
    ...SKILL_MODELS.flatMap((m) => EFFORT_LEVELS.map((e) => variant(m, e, `--${m}--${e}`))),
  ];
}

// Les fichiers du manifeste qui ne sont plus livrés : jamais retouchés (sha1 identique), ils
// sont supprimés, avec les variantes d'un SKILL.md, et leur entrée retirée ; retouchés, gardés,
// entrée retirée (ils ne sont plus à nous) ; illisibles, entrée gardée. Manifeste illisible ou
// chemin hors de dir : rien.
export function removeRetired(dir: string, defaults: DefaultFile[], disk: Disk & { remove(path: string): void }) {
  const manifestPath = path.join(dir, '.defaults.json');
  let manifest: Record<string, string>;
  try {
    manifest = JSON.parse(disk.read(manifestPath) ?? '');
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return;
  } catch { return; }
  const shipped = new Set(defaults.map((d) => d.path));
  let changed = false;
  for (const [rel, hash] of Object.entries(manifest)) {
    const file = path.resolve(dir, rel);
    const outside = path.relative(dir, file);
    if (shipped.has(rel) || outside === '' || outside.startsWith('..') || path.isAbsolute(outside)) continue;
    let ours: boolean;
    try {
      const current = disk.read(file);
      ours = current !== null && sha1(current) === hash;
      if (ours) disk.remove(file);
    } catch { continue; }   // illisible ou pas supprimé : ni oublié, il repassera au démarrage suivant
    delete manifest[rel];   // supprimé, retouché ou absent : plus à nous
    changed = true;
    if (!ours || path.posix.basename(rel) !== 'SKILL.md') continue;
    for (const m of SKILL_MODELS) for (const suffix of ['', ...EFFORT_LEVELS.map((e) => `--${e}`)]) {
      const variant = path.join(dir, `${path.posix.dirname(rel)}--${m}${suffix}`, 'SKILL.md');
      try { if (disk.read(variant) !== null) disk.remove(variant); } catch { /* générée : elle ne bloque pas les autres */ }
    }
  }
  if (changed) disk.write(manifestPath, JSON.stringify(manifest, null, 2));
}
