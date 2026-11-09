// Le profil d'essai : un dossier temporaire par cas (le userData de l'Electron factice), ce qu'on y écrit
// (fichier, config.json), et la remise à zéro des faux d'un cas à l'autre.
// Ne connaît pas : Electron, Claude Code, git ni ce que vérifient les tests.
// Utilisé par : le barrel (harness), electron.ts et claude.ts (reset), git.ts (write).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AgentConfig } from 'core/agents';

// Le dossier du profil courant, et ce que chaque faux remet à zéro quand un nouveau profil commence.
export const current = { dir: '', resets: [] as (() => void)[] };

// Le dossier du profil, temporaire (os.tmpdir() : effacé à la fin des tests par tests/tmp-dir.ts). À appeler
// à chaque cas (beforeEach) : il remet aussi à zéro les faux (fenêtres, tours, boîtes de dialogue).
export function profile(prefix: string): string {
  for (const reset of current.resets) reset();
  return (current.dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix))));
}

export function write(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

// Le config.json d'essai : les agents, plus ce que le cas ajoute (vibeCommandPrefix…).
export function writeConfig(profileDir: string, agents: AgentConfig[], extra: object = {}): void {
  write(path.join(profileDir, 'config.json'), JSON.stringify({ ...extra, agents }));
}
