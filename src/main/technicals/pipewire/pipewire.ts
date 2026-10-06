/** pipewire — les flux audio de PipeWire, par `wpctl` (livré avec
 *  WirePlumber) : les lister avec leurs propriétés, lire et changer leur
 *  coupure. Ce qu'on coupe et ce qu'on rétablit se décide dans core/sound.
 *  Ne connaît pas : Discord, la dictée. Utilisé par : app (coupures, Linux). */
import { execFile } from 'node:child_process';

// stdout, ou null si wpctl est absent ou échoue.
function wpctl(args: string[]) {
  return new Promise<string | null>((resolve) => {
    execFile('wpctl', args, { timeout: 2000 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

// Identifiants listés sous les rubriques « Streams: » de `wpctl status` (flux
// et leurs ports) ; l'inspection fait le tri.
export function streamIds(status: string | null) {
  const ids: string[] = [];
  let inStreams = false;
  for (const line of String(status || '').split('\n')) {
    const bare = line.replace(/[\s│├└─]/g, '');
    if (/Streams:$/.test(bare)) { inStreams = true; continue; }
    if (!bare || bare.endsWith(':')) { inStreams = false; continue; }
    const m = inStreams && line.match(/^[\s│├└─]*(\d+)\.\s/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

// Propriétés d'un objet PipeWire, ou null.
async function inspect(id: string) {
  const out = await wpctl(['inspect', id]);
  if (!out) return null;
  const props: Record<string, string> = {};
  for (const m of out.matchAll(/^\s*\*?\s*([\w.-]+) = "(.*)"$/gm)) props[m[1]] = m[2];
  return props;
}

// Les flux et leurs propriétés.
export async function streams() {
  const ids = streamIds(await wpctl(['status']));
  const props = await Promise.all(ids.map(inspect));
  return ids.flatMap((id, i) => (props[i] ? [{ id, props: props[i]! }] : []));
}

// true / false, ou null si le flux est illisible (disparu…).
export async function isMuted(id: string) {
  const volume = await wpctl(['get-volume', id]);
  return volume === null ? null : volume.includes('[MUTED]');
}

// true si wpctl a accepté.
export async function setMute(id: string, on: boolean) {
  return (await wpctl(['set-mute', id, on ? '1' : '0'])) !== null;
}
