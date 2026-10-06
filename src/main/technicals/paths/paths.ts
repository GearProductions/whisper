/** paths — où trouver un programme, un script ou un binaire livré avec l'appli.
 *  Ne connaît pas : Electron, le métier.
 *  Utilisé par : technicals (claude, selection, pocket-tts, windows-helper), app. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Chemin d'un programme : dans PATH, dans ~/.local/bin (uv, pipx, l'installeur
// de Claude Code : absent du PATH d'une appli lancée hors d'un terminal), puis
// dans `extraDirs`. null s'il est introuvable.
export function which(name: string, extraDirs: string[] = []): string | null {
  const names = process.platform === 'win32' && !path.extname(name) ? [`${name}.exe`, `${name}.cmd`, name] : [name];
  const dirs = [...String(process.env.PATH || '').split(path.delimiter), path.join(os.homedir(), '.local', 'bin'), ...extraDirs];
  for (const dir of dirs.filter(Boolean)) {
    for (const n of names) {
      const file = path.join(dir, n);
      try { if (fs.statSync(file).isFile()) return file; } catch { /* pas là */ }
    }
  }
  return null;
}

// Ce que le paquet livre hors de l'archive (extraResources) : process.resourcesPath ;
// en développement, resources/ du projet (le code construit vit dans out/main).
const resources = () => (__dirname.includes('app.asar') ? process.resourcesPath : path.join(__dirname, '..', '..', 'resources'));

// whisper-cli, uv : ceux du paquet, ou ceux que scripts/ a compilés ou téléchargés.
export const binDir = () => path.join(resources(), 'bin');

// Un script lancé par un autre programme (PowerShell, Python) : hors de
// l'archive, que ces programmes ne savent pas lire.
export const scriptPath = (name: string) => path.join(resources(), 'scripts', name);
