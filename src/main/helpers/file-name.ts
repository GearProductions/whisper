/** file-name — le nom d'un fichier ou dossier d'artefact, tel que le principal l'accepte :
 *  1 à 255 octets UTF-8, ni `.` ni `..`, sans `/`, `\` ni NUL ; un dossier ne commence pas
 *  par `.` (caché, il disparaîtrait du relevé, F-95). Noms portables, un artefact peut être copié
 *  dans le dépôt : ni `: * ? " < > |` ni caractère de contrôle, pas d'espace ou de point final, pas
 *  de nom réservé de Windows (CON, PRN, AUX, NUL, COM1-9, LPT1-9, avec ou sans extension, casse
 *  quelconque). Rend le nom, ou null.
 *  Ne connaît pas : le disque, les artefacts, la page (ses règles sont répétées dans nameProblem).
 *  Utilisé par : controllers/artifact-ops, core/vibecoder/artifacts (droppedFiles), technicals/file-tree (writeInto). */

const WINDOWS = /[:*?"<>|\x00-\x1f]|[ .]$|^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export const plainName = (name: unknown, folder: boolean): string | null => {
  if (typeof name !== 'string' || /[/\\\0]/.test(name)) return null;
  if (name === '.' || name === '..' || (folder && name.startsWith('.')) || WINDOWS.test(name)) return null;
  const bytes = Buffer.byteLength(name);
  return bytes >= 1 && bytes <= 255 ? name : null;
};
