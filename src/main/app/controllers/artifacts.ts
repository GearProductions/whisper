/** artifacts — les artefacts du projet de l'agent (<userData>/vibecoder-artifacts/<clé>/,
 *  partagé par le dépôt, ses worktrees et leurs robots) :
 *  projectArtifactsPath / projectArtifactsDir (le dossier du projet d'un dossier,
 *  d'après projectKey lu sur le disque : sans le créer / créé), vibeOutRoot et
 *  legacyArtifactsPath (le dossier des sorties, et les anciens artefacts d'un agent),
 *  listArtifacts (le relevé de ce dossier, listé tel quel : sous-dossiers compris,
 *  ni lien ni dossier caché — un fichier caché, oui —, la racine pas un lien, au
 *  plus LIST_MAX),
 *  artifactFile (l'agent affiché en VibeCoder, un artefact de son dernier relevé —
 *  artifactOf —, safePath sous le dossier de son projet, ni la racine ni le fichier
 *  un lien — I-37), resolveArtifact (pour serveFiles, le schéma vibe-artifact :
 *  <agent>/a<i>, une page ou un media seulement), copyArtifact (au clic, dans le
 *  dossier choisi dans la boîte de dialogue, sous le nom de base de l'artefact ; un
 *  fichier du même nom remplacé seulement après Remplacer, Annuler par défaut — I-39),
 *  addArtifacts (les chemins reçus, droppedPaths, copiés un à un par copyInto dans le
 *  dossier du projet, sans rien écraser ni suivre de lien ; le rapport cumulé en
 *  addedLine) et pickArtifacts (les mêmes, choisis dans la boîte de dialogue du
 *  principal, des fichiers). Ses réponses (la forme de DirectResult) sont en anglais,
 *  comme celles de technicals/direct (F-108), qu'il n'importe pas ; ses boîtes de
 *  dialogue dans la langue de VibeCoder (vibeLang).
 *  Ne connaît pas : la page (ses canaux), les libellés de l'écran.
 *  Utilisé par : controllers/vibecoder (survey, openVibeItem, runDirect), agents,
 *  artifact-migration, module-code, app/lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import type { VibeArtifact } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { vibeLang } from 'core/config';
import { ARTIFACTS, ARTIFACTS_ROOT, addedLine, artifactList, artifactOf, artifactType, droppedPaths, projectFolder, projectKey, safePath } from 'core/vibecoder';
import type { ArtifactsReport } from 'core/vibecoder';
import { copyInto } from 'technicals/file-tree';
import type { Served } from 'technicals/file-scheme';
import { loadConfig, vibeOutPath } from 'app/settings';
import { readFile } from './processes';
import { lastView, vibeAgent } from './vibecoder';

// La forme de DirectResult (technicals/direct, que seul controllers/vibecoder importe) : il la passe telle quelle.
type DirectResult = { ok: boolean; line: string; detail: string };

const LIST_MAX = 1000;   // les premiers trouvés seulement

const LABELS = {
  fr: { title: 'Copier dans le projet', add: 'Ajouter aux artefacts', exists: (n: string) => `« ${n} » existe déjà dans ce dossier. Le remplacer ?`, cancel: 'Annuler', replace: 'Remplacer' },
  en: { title: 'Copy to project', add: 'Add to artifacts', exists: (n: string) => `"${n}" already exists in this folder. Replace it?`, cancel: 'Cancel', replace: 'Replace' },
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

// Les fichiers de `root` et de ses sous-dossiers, relatifs à root ; ni lien (ni fichier ni dossier pour
// son Dirent) ni dossier caché (un fichier caché, oui) ; root un dossier, pas un lien ; au plus LIST_MAX.
function listFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (r: string) => {
    try {
      for (const e of fs.readdirSync(path.join(root, r), { withFileTypes: true })) {
        if (files.length >= LIST_MAX) continue;
        if (e.isFile()) files.push(path.posix.join(r, e.name));
        else if (e.isDirectory() && !e.name.startsWith('.')) walk(path.posix.join(r, e.name));
      }
    } catch { /* illisible : sans lui */ }
  };
  if (fs.lstatSync(root, { throwIfNoEntry: false })?.isDirectory()) walk('');
  return files;
}

// Les artefacts de `root`, le dossier du projet (leur nom, taille, date ; pas leur texte), `max` : la limite du texte.
export function listArtifacts(agentId: string, root: string, max: number): VibeArtifact[] {
  const files = listFiles(root).flatMap((name) => {
    const st = fs.lstatSync(path.join(root, name), { throwIfNoEntry: false });
    return st ? [{ name, size: st.size, time: Math.floor(st.mtimeMs) }] : [];
  });
  return artifactList(agentId, files, max);
}

// Le fichier de l'artefact `a` (artifactOf du dernier relevé) de l'agent affiché en VibeCoder, dans le dossier de son projet ;
// null pour un autre agent, aucun artefact, un lien (la racine ou le fichier), ou un chemin qui sort du dossier.
export function artifactFile(agentId: string, a: VibeArtifact | null): string | null {
  const agent = vibeAgent();
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

// Copier dans le projet (au clic) : le dossier choisi, l'artefact sous son nom de base ;
// un fichier du même nom remplacé seulement après Remplacer (et s'il n'est qu'un fichier, pas un lien).
export async function copyArtifact(agent: AgentConfig, id: string): Promise<DirectResult> {
  const done = (ok: boolean, line: string): DirectResult => ({ ok, line, detail: '' });
  const file = artifactFile(agent.id, artifactOf(lastView(agent.id), id));
  if (!file) return done(false, 'Refused: unknown artifact.');
  const l = LABELS[vibeLang(loadConfig())];
  const pick = await dialog.showOpenDialog({ title: l.title, defaultPath: agent.dir, properties: ['openDirectory', 'createDirectory'] });
  const chosen = pick.canceled ? undefined : pick.filePaths[0];
  if (!chosen) return done(true, 'Cancelled: nothing copied.');
  const base = path.basename(file);
  const dest = path.join(chosen, base);
  try {
    await fs.promises.copyFile(file, dest, fs.constants.COPYFILE_EXCL);
    return done(true, `Copied to ${dest}.`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
  const { response } = await dialog.showMessageBox({
    type: 'question', buttons: [l.cancel, l.replace], defaultId: 0, cancelId: 0, title: l.title, message: l.exists(base),
  });
  if (response !== 1) return done(true, 'Not replaced: nothing copied.');
  if (!fs.lstatSync(dest).isFile()) return done(false, `Refused: ${dest} is not a regular file.`);
  await fs.promises.copyFile(file, dest);
  return done(true, `Replaced ${dest}.`);
}

// Ajouter : copie les chemins reçus (droppedPaths) un à un dans le dossier du projet de l'agent ; ok s'il n'y a
// aucun échec et au moins un copié.
export async function addArtifacts(agent: AgentConfig, paths: unknown): Promise<DirectResult> {
  const { paths: list, noPath } = droppedPaths(paths);
  // projectArtifactsDir crée le dossier : pas pour un envoi sans chemin valide
  const root = list.length ? projectArtifactsDir(agent.dir) : '';
  const report: ArtifactsReport = { copied: [], links: [], hidden: [], failed: [], noPath };
  for (const p of list) await copyInto(p, root, report);
  return { ok: !report.failed.length && report.copied.length > 0, line: addedLine(report, vibeLang(loadConfig())), detail: '' };
}

// Ajouter, par la boîte de dialogue du principal (des fichiers) ; annulée : rien, sans message.
export async function pickArtifacts(agent: AgentConfig): Promise<DirectResult> {
  const pick = await dialog.showOpenDialog({
    title: LABELS[vibeLang(loadConfig())].add, defaultPath: agent.dir, properties: ['openFile', 'multiSelections'],
  });
  if (pick.canceled || !pick.filePaths.length) return { ok: true, line: '', detail: '' };
  return addArtifacts(agent, pick.filePaths);
}
