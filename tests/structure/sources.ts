// Aide des règles de structure : les fichiers .ts / .tsx d'un dossier, hors
// des dossiers `tests`, avec leur texte. Ne connaît rien du comportement de
// l'appli. Utilisée par no-shell, bridges, no-html et direct.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function sources(dir: string): [string, string][] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'tests' ? [] : sources(p);
    return /\.tsx?$/.test(n) ? [[p, readFileSync(p, 'utf8')] as [string, string]] : [];
  });
}

// Le texte écrit-il du HTML ? Les commentaires ne comptent pas.
// ponytail: un « // » dans une chaîne coupe le reste de sa ligne ; un analyseur
// seulement si la règle laisse passer un vrai cas.
const HTML = /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|createContextualFragment)\b|document\s*\.\s*write\b/;
export const insertsHtml = (text: string) => HTML.test(text.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, ''));
