/** config-file — le fichier de réglages (config.json) : lu à chaque usage, une
 *  retouche à la main prend effet sans relancer. Les défauts et le sens des
 *  réglages : core/config.
 *  Ne connaît pas : le contenu des réglages. Utilisé par : app/settings. */
import fs from 'node:fs';
import path from 'node:path';

// Le contenu du fichier, ou {} s'il manque ou est illisible.
export function readJson(file: string): Record<string, unknown> {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
