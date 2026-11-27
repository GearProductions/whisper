// Un dossier temporaire par lancement des tests, effacé à la fin : beaucoup de
// tests créent leur profil et leur dépôt d'essai par mkdtemp(os.tmpdir()) sans
// jamais les effacer. Laissés dans /tmp, des milliers de lancements en ont
// épuisé les inodes (tmpfs), et plus rien ne pouvait y écrire, Whisper et
// Claude Code compris. Ici, os.tmpdir() mène dans ce dossier pour tous les
// tests (TMPDIR, et TMP/TEMP sous Windows), hérité par les processus de vitest.
// Une suite interrompue (tuée, la machine éteinte) n'efface pas le sien : son
// nom porte le pid du lancement (whisper-tests-<pid>-XXXXXX), et le lancement
// suivant balaie ceux dont le processus est mort (sweep ; T-49 : 468 000
// fichiers laissés, la suite suivante échouait faute d'inodes). Un dossier
// d'avant le pid (whisper-tests-XXXXXX) : effacé passé six heures.
// Ne connaît pas : les tests eux-mêmes.
// Utilisé par : vitest.config.mts (globalSetup).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFIX = 'whisper-tests-';
const OLD_MS = 6 * 3_600_000;

// Le processus vit-il ? (kill 0 ne tue rien : il dit seulement s'il existe ; EPERM : il existe, à un autre.)
const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
};

// Les dossiers whisper-tests-* de root laissés par un lancement mort (son pid ne vit plus), ou d'avant le pid et vieux
// de plus de six heures : effacés. Le reste n'est pas touché ; une erreur sur un dossier n'arrête pas les autres.
export function sweep(root: string, isAlive: (pid: number) => boolean = alive): void {
  let names: string[] = [];
  try { names = fs.readdirSync(root); } catch { return; }
  for (const name of names) {
    if (!name.startsWith(PREFIX)) continue;
    const dir = path.join(root, name);
    const pid = /^whisper-tests-(\d+)-[^-]+$/.exec(name)?.[1];
    try {
      const stale = pid ? !isAlive(Number(pid)) : Date.now() - fs.statSync(dir).mtimeMs > OLD_MS;
      if (stale) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch { /* un autre lancement l'efface au même moment, ou un droit manque : on passe */ }
  }
}

export default function setup() {
  sweep(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${PREFIX}${process.pid}-`));
  for (const k of ['TMPDIR', 'TMP', 'TEMP']) process.env[k] = dir;
  return () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
