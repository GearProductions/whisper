/** whisper-cli — transcription locale par whisper.cpp : `whisper-cli` (ou
 *  `whisper-cli.exe`) et un modèle `ggml-*.bin`, rien ne sort de la machine.
 *  Chacun est cherché dans une liste de dossiers (le nôtre, le binaire livré
 *  avec le paquet, puis l'installation de Cockpit pour ne pas retélécharger un
 *  modèle de plusieurs centaines de Mo). Rend la sortie brute de whisper.
 *  Ne connaît pas : le nettoyage du texte (core/dictation), la destination.
 *  Utilisé par : app/controllers/dictation, app/menus. */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SAMPLE_RATE = 16000; // ce que whisper attend, et ce que la page capture
const PROMPT_MAX = 300;
const LANG_RE = /^(auto|[a-z]{2,3})$/;
const CLI_RE = /^whisper-cli(\.exe)?$/i;
const TIMEOUT_MS = 120000;

// Cherche jusqu'à deux niveaux sous `dir` : une release Windows se dézippe en
// `bin/Release/…`, un build Linux sort en `build/bin/…`.
function findFile(dir: string, test: (name: string) => boolean, depth = 2): string | null {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  // Un lien symbolique vers un fichier compte (modèle ou exécutable liés).
  const isFile = (e: fs.Dirent) => {
    if (!e.isSymbolicLink()) return e.isFile();
    try { return fs.statSync(path.join(dir, e.name)).isFile(); } catch { return false; }
  };
  for (const e of entries) if (test(e.name) && isFile(e)) return path.join(dir, e.name);
  if (depth <= 0) return null;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const found = findFile(path.join(dir, e.name), test, depth - 1);
    if (found) return found;
  }
  return null;
}

// { cli, model } : le premier trouvé de chacun, dans l'ordre de `dirs` (le
// paquet livre whisper-cli, le modèle est téléchargé dans nos données) ; l'un
// ou l'autre à null s'il manque.
export function locateWhisper(dirs: string[]) {
  let cli: string | null = null;
  let model: string | null = null;
  for (const dir of dirs) {
    cli = cli || findFile(dir, (n) => CLI_RE.test(n));
    model = model || findFile(dir, (n) => /^ggml-.+\.bin$/i.test(n), 0);
  }
  return { cli, model };
}

// En-tête WAV PCM 16 bits mono : whisper-cli ne lit que des fichiers.
export function wavFile(pcm: Buffer) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// `pcm` = PCM 16 bits LE mono 16 kHz, déjà vérifié. Rend la sortie de whisper ;
// rejette avec un code ('notInstalled', 'failed', 'timeout').
export async function runWhisper(dirs: string[], pcm: Buffer, { lang = 'fr', prompt = '' }: { lang?: string; prompt?: string } = {}) {
  const { cli, model } = locateWhisper(dirs);
  if (!cli || !model) throw new Error('notInstalled');

  // 4 threads par défaut : trop peu sur un processeur récent, sans GPU.
  const threads = Math.max(1, Math.min(8, os.cpus().length));
  const args = ['-m', model, '-l', LANG_RE.test(lang) ? lang : 'fr', '-t', String(threads), '-nt', '-np', '-sns'];
  const vocab = String(prompt || '').replace(/[\x00-\x1f]+/g, ' ').trim().slice(0, PROMPT_MAX);
  if (vocab) args.push('--prompt', vocab);

  const tmpDir = path.join(os.tmpdir(), 'whisper-dictation');
  fs.mkdirSync(tmpDir, { recursive: true });
  const file = path.join(tmpDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`);
  fs.writeFileSync(file, wavFile(pcm));
  try {
    // Pas de shell : chemins et arguments ne passent jamais par une ligne de
    // commande interprétée.
    return await new Promise<string>((resolve, reject) => {
      execFile(cli, [...args, '-f', file],
        { cwd: path.dirname(cli), timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        (err, out) => {
          if (err) reject(new Error(err.killed ? 'timeout' : 'failed'));
          else resolve(out);
        });
    });
  } finally {
    fs.unlink(file, () => {});
  }
}
