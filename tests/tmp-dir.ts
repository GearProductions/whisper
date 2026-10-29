// Un dossier temporaire par lancement des tests, effacé à la fin : beaucoup de
// tests créent leur profil et leur dépôt d'essai par mkdtemp(os.tmpdir()) sans
// jamais les effacer. Laissés dans /tmp, des milliers de lancements en ont
// épuisé les inodes (tmpfs), et plus rien ne pouvait y écrire, Whisper et
// Claude Code compris. Ici, os.tmpdir() mène dans ce dossier pour tous les
// tests (TMPDIR, et TMP/TEMP sous Windows), hérité par les processus de vitest.
// Ne connaît pas : les tests eux-mêmes.
// Utilisé par : vitest.config.mts (globalSetup).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-tests-'));
  for (const k of ['TMPDIR', 'TMP', 'TEMP']) process.env[k] = dir;
  return () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}
