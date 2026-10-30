/** artifact-moves — le sort des artefacts d'un agent retiré : transférés à son
 *  parent, ou laissés sur le disque (artifacts-left.json) et rendus à l'agent
 *  rouvert sur ce dossier. Tout à la suite, une chaîne de promesses ; ne rejette
 *  jamais ; un échec : showBubble(failedLine), le fichier reste. L'entrée est
 *  posée d'un seul tenant au retrait, avant tout transfert, et relue à chaque
 *  écriture (aucun `await` entre la lecture et l'écriture).
 *  Ne connaît pas : la page, les libellés de l'écran, les menus.
 *  Utilisé par : controllers (agents, worktrees, artifacts : l'ajout passe par la même file). */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AgentConfig } from 'core/agents';
import { vibeLang } from 'core/config';
import { ARTIFACTS, failedLine, folderKey } from 'core/vibecoder';
import { hasFiles, moveContents, type TreeReport } from 'technicals/file-tree';
import { leftArtifacts, loadConfig, saveLeftArtifacts, vibeOutPath } from 'app/settings';
import { showBubble } from 'app/windows';

let chain: Promise<void> = Promise.resolve();   // les transferts, à la suite
export const queued = (job: () => Promise<void>): Promise<void> =>
  (chain = chain.then(job).catch((err) => console.error(`artefacts : ${err instanceof Error ? err.message : err}`)));

// Pas vibeOutDir : il crée le dossier, et celui d'un agent retiré ne doit pas renaître.
const artifactsOf = (agentId: string) => path.join(vibeOutPath(agentId), ARTIFACTS);

const drop = (agentId: string) => {
  const { [agentId]: _gone, ...rest } = leftArtifacts();
  saveLeftArtifacts(rest);
};

// Un échec se dit ; l'entrée part quand il ne reste aucun artefact. true : elle est partie.
async function settle(agentId: string, report: TreeReport): Promise<boolean> {
  for (const f of report.failed) console.error(`artefacts : ${f.path} (${f.error})`);
  if (report.failed.length) showBubble(failedLine(report.failed.length, vibeLang(loadConfig())), 'notice');
  if (report.failed.length && await hasFiles(artifactsOf(agentId))) return false;
  drop(agentId);
  return true;
}

export function retireArtifacts(agent: AgentConfig, parent: AgentConfig | null): Promise<void> {
  try { saveLeftArtifacts({ ...leftArtifacts(), [agent.id]: folderKey(agent.dir, fs.realpathSync.native) }); } catch (err) {
    console.error(`artefacts : entrée de ${agent.id} (${err instanceof Error ? err.message : err})`);
  }
  return queued(async () => {
    const from = artifactsOf(agent.id);
    if (!parent) { if (!await hasFiles(from)) drop(agent.id); return; }
    await settle(agent.id, await moveContents(from, artifactsOf(parent.id)));
  });
}

export function returnArtifacts(agent: AgentConfig): Promise<void> {
  const key = folderKey(agent.dir, fs.realpathSync.native);
  return queued(async () => {
    const mine = Object.entries(leftArtifacts()).filter(([id, dir]) => dir === key && id !== agent.id);
    for (const [id] of mine) {
      if (!await settle(id, await moveContents(artifactsOf(id), artifactsOf(agent.id)))) continue;
      // rien n'est resté : les dossiers vides partent, un dossier plein reste
      await fsp.rmdir(artifactsOf(id)).catch(() => {});
      await fsp.rmdir(vibeOutPath(id)).catch(() => {});
    }
  });
}

export function eraseOutputs(agentId: string): Promise<void> {
  return queued(async () => {
    const dir = vibeOutPath(agentId);
    // Sur le disque, jamais d'après l'entrée : sa sauvegarde ou sa lecture a pu échouer.
    if (!await hasFiles(artifactsOf(agentId))) { await fsp.rm(dir, { recursive: true, force: true }); return; }
    // des artefacts restent : tout part sauf artifacts/ (rm ne suit pas un lien)
    for (const name of await fsp.readdir(dir).catch(() => [])) {
      if (name !== ARTIFACTS) await fsp.rm(path.join(dir, name), { recursive: true, force: true });
    }
  });
}
