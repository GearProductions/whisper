/** artifacts — les artefacts du projet de l'agent (<userData>/vibecoder-artifacts/<clé>/,
 *  partagé par le dépôt, ses worktrees et leurs robots) :
 *  projectArtifactsPath / projectArtifactsDir (le dossier du projet d'un dossier,
 *  d'après projectKey lu sur le disque : sans le créer / créé), vibeOutRoot et
 *  legacyArtifactsPath (le dossier des sorties, et les anciens artefacts d'un agent),
 *  listArtifacts (le relevé de ce dossier, listé tel quel : { artifacts, dirs } —
 *  les fichiers, et les dossiers même vides —, sous-dossiers compris, ni lien ni
 *  dossier caché — un fichier caché, oui —, la racine pas un lien ; au plus LIST_MAX
 *  fichiers, les dossiers ne comptent pas),
 *  artifactFile (l'agent affiché en VibeCoder, un artefact de son dernier relevé —
 *  artifactOf —, safePath sous le dossier de son projet, ni la racine ni le fichier
 *  un lien — I-37), resolveArtifact (pour serveFiles, le schéma vibe-artifact :
 *  <agent>/a<i>, une page ou un media seulement), copyArtifact (au clic, la sélection
 *  — des ids a<i> ou d<i> du dernier relevé, sans lien sur leur chemin —, dans le
 *  dossier choisi dans la boîte de dialogue ; un fichier du même nom remplacé
 *  seulement après Remplacer, Annuler par défaut, fichier par fichier ; un dossier
 *  copié par copyInto, numéroté, jamais remplacé — I-39), addArtifacts (les chemins
 *  reçus, droppedFiles, copiés un à un par copyInto, les contenus reçus en base64 écrits
 *  par writeInto, dans le dossier visé — l'id d<i> du dernier relevé, absent : la
 *  racine ; inconnu : refusé, unknown-artifact, rien d'écrit —, sans rien écraser ni
 *  suivre de lien, noLinkPath ; un contenu refusé par droppedFiles est un échec,
 *  refused ; le rapport cumulé en addedLine), artifactFiles (les chemins des ids du
 *  dernier relevé, pour le refus de copy-artifact avant sa boîte de dialogue ; une liste
 *  vide ou un id inconnu : null, copyArtifact rend alors unknown-artifact) et
 *  readArtifact (le contenu d'un id a<i> du dernier relevé, par itemFile — l'agent
 *  affiché, sans lien —, texte ou base64, au plus READ_MAX octets lus :
 *  truncated au-delà ; null sinon). Ses réponses (la forme de
 *  DirectResult) sont en anglais, comme celles de technicals/direct (F-108), qu'il
 *  n'importe pas, un refus ou un échec avec sa clé (reason : ArtifactRefusal, aussi
 *  celle d'artifact-ops) ; ses boîtes de dialogue dans la langue de VibeCoder (vibeLang).
 *  Ne connaît pas : la page (ses canaux), les libellés de l'écran.
 *  Utilisé par : controllers/vibecoder (survey, openVibeItem, runDirect, dropOnArtifacts), commands
 *  (readArtifact), artifact-ops (ArtifactRefusal), agents,
 *  artifact-migration, module-code, app/lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import type { VibeArtifact, VibeArtifactDir } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { vibeLang } from 'core/config';
import { ARTIFACTS, ARTIFACTS_ROOT, addedLine, artifactDirs, artifactItem, artifactList, artifactOf, artifactType, droppedFiles, folderOf, noLinkPath, projectFolder, projectKey, safePath } from 'core/vibecoder';
import type { ArtifactsReport } from 'core/vibecoder';
import { copyInto, writeInto } from 'technicals/file-tree';
import type { Served } from 'technicals/file-scheme';
import { loadConfig, vibeOutPath } from 'app/settings';
import { READ_MAX, readFile } from './processes';
import { viewAgent } from './agents';
import { lastView } from './vibecoder';

// La forme de DirectResult (technicals/direct, que seul controllers/vibecoder importe) : il la passe telle quelle ;
// reason : la clé d'un refus ou d'un échec (aussi celle d'artifact-ops), que runDirect rend à la commande.
type DirectResult = { ok: boolean; line: string; detail: string; reason?: ArtifactRefusal };
export type ArtifactRefusal = 'unknown-artifact' | 'name' | 'refused' | 'failed';

// Les chemins des ids (a<i> ou d<i>) du dernier relevé, par itemFile ; null si la liste est vide ou un id inconnu.
// copy-artifact : runDirect refuse un id inconnu avant la boîte de dialogue.
export function artifactFiles(agent: AgentConfig, ids: unknown): string[] | null {
  if (!Array.isArray(ids) || !ids.length) return null;
  const files = ids.map((id) => itemFile(agent, id));
  return files.includes(null) ? null : (files as string[]);
}

const LIST_MAX = 1000;   // les premiers fichiers trouvés seulement
const lstat = (p: string) => fs.lstatSync(p, { throwIfNoEntry: false });

const LABELS = {
  fr: { title: 'Copier dans le projet', exists: (n: string) => `« ${n} » existe déjà dans ce dossier. Le remplacer ?`, cancel: 'Annuler', replace: 'Remplacer' },
  en: { title: 'Copy to project', exists: (n: string) => `"${n}" already exists in this folder. Replace it?`, cancel: 'Cancel', replace: 'Replace' },
};

// Le dossier des sorties de tous les agents, et les anciens artefacts de l'un d'eux (avant le dossier du
// projet) : sans les créer, celui d'un agent retiré ne doit pas renaître. Lus par worktrees et artifact-migration.
export const vibeOutRoot = () => vibeOutPath('');
export const legacyArtifactsPath = (agentId: string) => path.join(vibeOutPath(agentId), ARTIFACTS);

// Le dossier d'artefacts du projet de ce dossier, sans le créer : <userData>/vibecoder-artifacts/<clé>.
export function projectArtifactsPath(dir: string): string {
  return path.join(app.getPath('userData'), ARTIFACTS_ROOT, projectFolder(projectKey(dir, readFile, fs.realpathSync.native)));
}

// Le même, créé au besoin : Claude Code le reçoit en dossier de travail. Un échec ne bloque pas l'agent (I-29).
export function projectArtifactsDir(dir: string): string {
  const folder = projectArtifactsPath(dir);
  try { fs.mkdirSync(folder, { recursive: true }); } catch { /* l'agent part sans */ }
  return folder;
}

// Les fichiers et les dossiers de `root` et de ses sous-dossiers, relatifs à root ; ni lien (ni fichier ni
// dossier pour son Dirent) ni dossier caché (un fichier caché, oui) ; root un dossier, pas un lien ; au plus
// LIST_MAX fichiers (les dossiers ne comptent pas).
function listFiles(root: string): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs: string[] = [];
  const walk = (r: string) => {
    try {
      for (const e of fs.readdirSync(path.join(root, r), { withFileTypes: true })) {
        const rel = path.posix.join(r, e.name);
        if (e.isFile()) { if (files.length < LIST_MAX) files.push(rel); }
        // la limite atteinte : plus de descente (ses dossiers seulement, pas tout un arbre relu à chaque relevé)
        else if (e.isDirectory() && !e.name.startsWith('.')) { dirs.push(rel); if (files.length < LIST_MAX) walk(rel); }
      }
    } catch { /* illisible : sans lui */ }
  };
  if (lstat(root)?.isDirectory()) walk('');
  return { files, dirs };
}

// Les artefacts de `root`, le dossier du projet (leur nom, taille, date ; pas leur texte), `max` : la limite du texte ;
// et ses dossiers, même vides.
export function listArtifacts(agentId: string, root: string, max: number): { artifacts: VibeArtifact[]; dirs: VibeArtifactDir[] } {
  const found = listFiles(root);
  const files = found.files.flatMap((name) => {
    const st = lstat(path.join(root, name));
    return st ? [{ name, size: st.size, time: Math.floor(st.mtimeMs) }] : [];
  });
  return { artifacts: artifactList(agentId, files, max), dirs: artifactDirs(found.dirs) };
}

// Le fichier de l'artefact `a` (artifactOf du dernier relevé) de l'agent affiché en VibeCoder, dans le dossier de son projet ;
// null pour un autre agent, aucun artefact, un lien (la racine ou le fichier), ou un chemin qui sort du dossier.
export function artifactFile(agentId: string, a: VibeArtifact | null): string | null {
  const agent = viewAgent();
  if (!a || agent?.id !== agentId) return null;
  const root = projectArtifactsPath(agent.dir);
  try { if (!fs.lstatSync(root).isDirectory() || !fs.lstatSync(path.join(root, a.name)).isFile()) return null; } catch { return null; }
  return safePath(root, a.name, fs.realpathSync.native);
}

// vibe-artifact://<agent>/a<i> → l'artefact, une page (en bac à sable) ou un media ; sinon null (404).
export function resolveArtifact(url: URL): Served | null {
  const id = /^\/(a\d+)$/.exec(url.pathname)?.[1];
  const a = id ? artifactOf(lastView(url.hostname), id) : null;
  if (!a || (a.kind !== 'page' && a.kind !== 'media')) return null;
  const file = artifactFile(url.hostname, a);
  return file ? { file, type: artifactType(a.name), sandbox: a.kind === 'page' } : null;
}

// Le chemin d'un élément du relevé (a<i> ou d<i>) sous le dossier du projet de l'agent affiché, du bon genre
// (fichier ou dossier) et sans lien sur son chemin ; null sinon.
function itemFile(agent: AgentConfig, id: unknown): string | null {
  const item = artifactItem(lastView(agent.id), id);
  if (!item || viewAgent()?.id !== agent.id) return null;
  const file = noLinkPath(projectArtifactsPath(agent.dir), item.name, lstat);
  const st = file && lstat(file);
  return st && (item.folder ? st.isDirectory() : st.isFile()) ? file : null;
}

// Copier dans le projet (au clic) : la sélection (ids du dernier relevé) dans le dossier choisi, sous son nom de
// base ; un fichier du même nom remplacé seulement après Remplacer (et s'il n'est qu'un fichier, pas un lien) ;
// un dossier numéroté s'il existe déjà, jamais mêlé ni remplacé.
export async function copyArtifact(agent: AgentConfig, ids: string[]): Promise<DirectResult> {
  const done = (ok: boolean, line: string): DirectResult => ({ ok, line, detail: '' });
  const files = artifactFiles(agent, ids);
  if (!files) return { ok: false, line: 'Refused: unknown artifact.', detail: '', reason: 'unknown-artifact' };
  const l = LABELS[vibeLang(loadConfig())];
  const pick = await dialog.showOpenDialog({ title: l.title, defaultPath: agent.dir, properties: ['openDirectory', 'createDirectory'] });
  const chosen = pick.canceled ? undefined : pick.filePaths[0];
  if (!chosen) return done(true, 'Cancelled: nothing copied.');
  const lines: string[] = [];
  let ok = true;
  for (const file of files) {
    const base = path.basename(file);
    const dest = path.join(chosen, base);
    if (lstat(file)?.isDirectory()) {
      const r = await copyInto(file, chosen);
      if (r.failed.length) ok = false;
      lines.push(r.failed.length ? `Failed: ${base}: ${r.failed[0].error}` : `Copied folder ${base} to ${chosen}.`);
      continue;
    }
    try {
      await fs.promises.copyFile(file, dest, fs.constants.COPYFILE_EXCL);
      lines.push(`Copied to ${dest}.`);
      continue;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
    const { response } = await dialog.showMessageBox({
      type: 'question', buttons: [l.cancel, l.replace], defaultId: 0, cancelId: 0, title: l.title, message: l.exists(base),
    });
    if (response !== 1) lines.push(`Not replaced: ${base} left as is.`);
    else if (!lstat(dest)?.isFile()) { ok = false; lines.push(`Refused: ${dest} is not a regular file.`); }
    else { await fs.promises.copyFile(file, dest); lines.push(`Replaced ${dest}.`); }
  }
  return done(ok, lines.join(' '));
}

// Ajouter : copie les chemins reçus (droppedFiles : un chemin ou { path }) un à un par copyInto, et écrit les
// contenus ({ name, content en base64 }) par writeInto, dans le dossier visé (folderOf du dernier relevé : absent, la
// racine ; inconnu : refusé, unknown-artifact, rien d'écrit) du dossier du projet de l'agent ; un contenu refusé
// (droppedFiles) est un échec ; ok s'il n'y a aucun échec et au moins un copié, sinon reason refused.
// Un dossier visé disparu ou devenu un lien, ou la racine devenue un lien : rien n'est copié, chaque chemin en échec.
export async function addArtifacts(agent: AgentConfig, files: unknown, folder?: unknown): Promise<DirectResult> {
  const target = folderOf(lastView(agent.id), folder);
  if (target === null) return { ok: false, line: 'Refused: unknown folder.', detail: '', reason: 'unknown-artifact' };
  const { paths, contents, noPath, refused } = droppedFiles(files);
  // projectArtifactsDir crée le dossier : pas pour un envoi sans chemin ni contenu valide
  const some = paths.length > 0 || contents.length > 0;
  const root = some ? projectArtifactsDir(agent.dir) : '';
  const to = some ? noLinkPath(root, target, lstat) : '';
  const report: ArtifactsReport = { copied: [], links: [], hidden: [], failed: [], noPath };
  report.failed.push(...refused);
  const gone = 'the target folder is gone or is a link';
  for (const p of paths) {
    if (to === null) report.failed.push({ path: p, error: gone });
    else await copyInto(p, to, report);
  }
  for (const c of contents) {
    if (to === null) report.failed.push({ path: c.name, error: gone });
    else await writeInto(to, c.name, c.bytes, report);
  }
  const ok = !report.failed.length && report.copied.length > 0;
  return { ok, line: addedLine(report, vibeLang(loadConfig())), detail: '', ...(ok ? {} : { reason: 'refused' as const }) };
}

// Le contenu de l'artefact a<i> du dernier relevé (itemFile : l'agent affiché, aucun lien sur le chemin, un fichier) :
// le texte d'un markdown, d'un texte ou d'une page, le base64 d'un media ; au plus READ_MAX octets lus,
// truncated s'il y en avait plus. Un id inconnu (un d<i> ou un chemin compris), un lien : null.
export async function readArtifact(agent: AgentConfig, id: unknown): Promise<{ name: string; kind: VibeArtifact['kind']; text?: string; base64?: string; truncated: boolean } | null> {
  const a = typeof id === 'string' ? artifactOf(lastView(agent.id), id) : null;
  const file = a && itemFile(agent, id);
  if (!a || !file) return null;
  let fh: fs.promises.FileHandle | undefined;
  try {
    fh = await fs.promises.open(file, 'r');
    const buf = Buffer.alloc(READ_MAX + 1);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const bytes = buf.subarray(0, Math.min(bytesRead, READ_MAX));
    const out = { name: a.name, kind: a.kind, truncated: bytesRead > READ_MAX };
    return a.kind === 'media' ? { ...out, base64: bytes.toString('base64') } : { ...out, text: bytes.toString('utf8') };
  } catch { return null; } finally { await fh?.close(); }
}
