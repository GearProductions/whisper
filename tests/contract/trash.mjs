// La corbeille du banc, vérifiée avant tout cas de trash-artifacts (note,
// « Où ça casse ») : Electron (shell.trashItem) met-il un fichier dans
// <XDG_DATA_HOME>/Trash du banc, et pas dans celle de l'utilisateur ?
// trashLanding(dataHome) lance Electron sur ce fichier même, avec
// XDG_DATA_HOME = dataHome, sur un fichier témoin créé sous dataHome ; rend où
// il a atterri : isolated vrai s'il est sous <dataHome>/Trash ; sinon where dit
// où (le témoin, trouvé dans la corbeille de l'utilisateur, en est retiré).
// Lancé par Electron (process.versions.electron), ce fichier met à la
// corbeille le chemin reçu en argument, puis quitte.
// Ne connaît pas : l'appli, les artefacts, la CLI.
// Utilisé par : tests/contract/run.mjs (avant la famille des artefacts).

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

// Côté Electron : met le témoin à la corbeille, puis quitte (code 1 si elle échoue).
if (process.versions.electron) {
  const { app, shell } = await import('electron');
  // Pas d'await sur whenReady : Electron attend la fin du module principal (ESM) avant « ready ».
  app.whenReady().then(() => shell.trashItem(process.env.TRASH_WITNESS)).then(
    () => app.exit(0),
    (e) => { console.error(e); app.exit(1); },
  );
}

// Les corbeilles où un témoin posé sous dataHome peut atterrir : celle du banc,
// celle de l'utilisateur, celle du volume (<point de montage>/.Trash-<uid>).
function candidates(dataHome) {
  const uid = process.getuid();
  let top = path.resolve(dataHome);
  while (top !== path.dirname(top) && fs.statSync(path.dirname(top)).dev === fs.statSync(top).dev) top = path.dirname(top);
  const userData = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share');
  return [
    path.join(dataHome, 'Trash'),
    path.join(userData, 'Trash'),
    path.join(top, `.Trash-${uid}`),
    path.join(top, '.Trash', String(uid)),
  ];
}

/** @param {string} dataHome @returns {Promise<{ isolated: boolean; where: string }>} */
export async function trashLanding(dataHome) {
  const name = `bench-trash-witness-${process.pid}-${Date.now()}`;
  const witness = path.join(dataHome, name);
  fs.writeFileSync(witness, 'témoin du banc\n');
  const home = path.join(dataHome, 'home');
  const { default: electron } = await import('electron'); // node : le chemin du binaire
  try {
    await promisify(execFile)(electron, [import.meta.filename, `--user-data-dir=${home}`], {
      timeout: 30000,
      env: { ...process.env, XDG_DATA_HOME: dataHome, XDG_CONFIG_HOME: path.join(home, 'config'), XDG_CACHE_HOME: path.join(home, 'cache'), TRASH_WITNESS: witness },
    });
  } catch (e) {
    fs.rmSync(witness, { force: true });
    throw new Error(`trashLanding : Electron a échoué (${e.killed ? 'délai dépassé' : e.message}) ${e.stderr ?? ''}`.trim());
  }
  const [bench, ...others] = candidates(dataHome);
  const landed = [bench, ...others].find((t) => fs.existsSync(path.join(t, 'files', name)));
  if (landed === bench) return { isolated: true, where: bench };
  // Hors du banc : on retire notre témoin (et son .trashinfo) de la corbeille de l'utilisateur.
  if (landed) {
    fs.rmSync(path.join(landed, 'files', name), { force: true });
    fs.rmSync(path.join(landed, 'info', `${name}.trashinfo`), { force: true });
  }
  fs.rmSync(witness, { force: true });
  return { isolated: false, where: landed ?? 'introuvable (ni la corbeille du banc, ni celle de l\'utilisateur)' };
}
