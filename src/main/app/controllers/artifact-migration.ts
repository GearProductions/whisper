/** artifact-migration — le déplacement des anciens artefacts
 *  (vibecoder-out/<agent>/artifacts/) vers le dossier de leur projet, à chaque
 *  démarrage : ce qui reste part, sans drapeau. Ne rejette jamais ; un échec : au
 *  journal et showBubble(failedLine), le fichier reste et repart au démarrage suivant.
 *  Un id sans dossier : au journal, rien ne bouge. artifacts-left.json est lu ici, et
 *  supprimé quand plus aucune de ses entrées n'a de fichier (illisible, vide : comme sans
 *  entrée, le déplacement va au bout). Les dossiers vidés partent.
 *  Ne connaît pas : la page, les menus, les boutons.
 *  Utilisé par : app/lifecycle. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { agentList, vibeLang } from 'core/config';
import { failedLine, leftEntries, legacyOwner } from 'core/vibecoder';
import { hasFiles, moveContents } from 'technicals/file-tree';
import { loadConfig, vibeOutPath } from 'app/settings';
import { showBubble } from 'app/windows';
import { readFile } from './processes';
import { legacyArtifactsPath, projectArtifactsPath, vibeOutRoot } from './artifacts';

export async function moveLegacyArtifacts(): Promise<void> {
  try {
    const cfg = loadConfig();
    // settings ne garde pas le chemin de artifacts-left.json : reconstruit d'après userData.
    const leftFile = path.join(app.getPath('userData'), 'artifacts-left.json');
    const left = leftEntries(readFile(leftFile));
    const agents = agentList(cfg);
    let failed = 0;
    for (const id of await fsp.readdir(vibeOutRoot()).catch(() => [])) {
      if (!await hasFiles(legacyArtifactsPath(id))) continue;
      const dir = legacyOwner(id, agents, left);
      if (dir === null) { console.error(`artefacts : ${id} n'a pas de dossier, ses artefacts restent`); continue; }
      const report = await moveContents(legacyArtifactsPath(id), projectArtifactsPath(dir));
      for (const f of report.failed) console.error(`artefacts : ${f.path} (${f.error})`);
      failed += report.failed.length;
      // vidés : les dossiers partent, un dossier plein reste (rmdir refuse)
      if (!await hasFiles(legacyArtifactsPath(id))) {
        await fsp.rmdir(legacyArtifactsPath(id)).catch(() => {});
        await fsp.rmdir(vibeOutPath(id)).catch(() => {});
      }
    }
    if (failed) showBubble(failedLine(failed, vibeLang(cfg)), 'notice');
    const kept = await Promise.all(Object.keys(left).map((id) => hasFiles(legacyArtifactsPath(id))));
    if (!kept.some(Boolean)) fs.rmSync(leftFile, { force: true });
  } catch (err) {
    console.error(`artefacts : ${err instanceof Error ? err.message : err}`);
  }
}
