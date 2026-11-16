/** case-marks — la validation d'un cas de test d'invariant, cas par cas (note 0.15.0-invariants-par-cas) : sa cible
 *  (caseTarget : « case:<chemin>:<clé> », la clé de caseKeys), son état d'après l'empreinte de son bloc et celle du code
 *  commun du fichier (caseMarkState : 'common' quand seul le code commun a changé), le geste (setCaseMark : la marque
 *  retient les deux), les empreintes d'une cible dans le relevé (caseHashes) et la conversion, sans bruit, des
 *  validations d'avant cette version, posées sur le fichier entier (convertCaseMarks).
 *  Rend un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque, git (textes et empreintes passés), la lecture en pseudo-code, les étapes.
 *  Utilisé par : core/vibecoder (marks : vibeMarks ; step-checks ; journey), app/controllers/vibecoder (markVibe, le
 *  relevé : la conversion). */
import type { VibeTestFile } from 'shared/bridge';
import { caseKeys } from 'shared/test-cases';
import type { Marks } from './marks';
import { caseBlocks, caseTitles } from './test-files';

// Ce que retient la marque d'un cas : l'empreinte de son bloc (hash) et celle du code commun de son fichier (common).
export type CaseHashes = { hash: string; common: string };

// L'état d'un cas : le verdict s'il porte sur ce bloc et ce code commun ; 'changed', son bloc a changé (ou une marque
// d'avant cette version, sans common) ; 'common', seul le code commun a changé ; null, sans validation.
export type CaseMarkState = 'ok' | 'ko' | 'changed' | 'common' | null;

// « case:<chemin>:<clé> ».
export function caseTarget(path: string, key: string): string {
  return `case:${path}:${key}`;
}

export function caseMarkState(marks: Marks, target: string, hashes: CaseHashes): CaseMarkState {
  const mark = Object.hasOwn(marks, target) ? marks[target] : undefined;
  if (!mark) return null;
  if (mark.hash !== hashes.hash || mark.common === undefined) return 'changed';
  return mark.common === hashes.common ? mark.verdict : 'common';
}

// null : oublie la validation ; sinon la marque { hash, verdict, common }.
export function setCaseMark(marks: Marks, target: string, hashes: CaseHashes, verdict: 'ok' | 'ko' | null): Marks {
  const { [target]: _, ...rest } = marks;
  return verdict ? { ...rest, [target]: { hash: hashes.hash, verdict, common: hashes.common } } : rest;
}

// Les empreintes du cas que vise `target` parmi les tests du relevé (leur hashes, la clé d'après caseKeys de leurs
// cases) ; null : pas un « case: », fichier ou clé inconnus, ou fichier sans hashes.
export function caseHashes(invariants: VibeTestFile[], target: string): CaseHashes | null {
  for (const f of invariants) {
    const prefix = `case:${f.path}:`;
    if (!f.hashes || !target.startsWith(prefix)) continue;
    const i = caseKeys(f.cases).indexOf(target.slice(prefix.length));   // une clé peut contenir « : », un chemin en préfixer un autre
    if (i >= 0) return { hash: f.hashes.blocks[i], common: f.hashes.common };
  }
  return null;
}

// Une marque de cas d'avant cette version (sans common, rangée sous le titre : elle valait pour chaque cas de ce
// titre) dont l'empreinte est encore celle du fichier : reprise sur le bloc de chaque cas de ce titre (sa clé, ses
// empreintes de caseBlocks), même verdict ; une autre, laissée telle quelle (elle reste « changed »). Rend marks tel
// quel sans rien à convertir.
export function convertCaseMarks(marks: Marks, tests: { path: string; blob: string; text: string }[]): Marks {
  let next = marks;
  for (const [target, mark] of Object.entries(marks)) {
    if (mark.common !== undefined) continue;
    for (const t of tests) {
      const prefix = `case:${t.path}:`;
      if (!target.startsWith(prefix) || mark.hash !== t.blob) continue;
      const title = target.slice(prefix.length);
      const titles = caseTitles(t.text);
      if (!titles.includes(title)) continue;
      const { keys, blocks, common } = caseBlocks(t.text);
      const { [target]: _, ...rest } = next;
      next = { ...rest };
      titles.forEach((c, i) => {
        if (c === title) next[prefix + keys[i]] = { hash: blocks[i], verdict: mark.verdict, common };
      });
      break;
    }
  }
  return next;
}
