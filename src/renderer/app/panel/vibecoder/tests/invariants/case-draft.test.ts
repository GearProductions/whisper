// @vitest-environment happy-dom
// Invariant de l'enregistrement du bloc d'un cas par son éditeur (note 0.15.0,
// docs/tickets/feat/0.15.0-ecran-statuts.md, « Ce que ça ne doit pas faire ») :
//   « Modifier, en enregistrant le bloc d'un cas, une autre ligne du fichier de
//   test que celles de ce bloc ».
// Ce que l'éditeur d'un cas (useCaseDraft) envoie à l'enregistrement : le
// fichier entier, dont chaque ligne hors du bloc est celle du disque.
// Les fonctions pures qui recousent le fichier : core/vibecoder/tests/invariants/case-block.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai crochet, monté par React (createRoot) dans une page happy-dom ;
// l'enregistrement (le pont) est un rappel qui relève ce qu'il reçoit.
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { caseRange } from 'core/vibecoder';
import type { VibeTestFile } from 'technicals/bridge';
import { useCaseDraft, type Drafts, type FileDraft } from '../../file-draft';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Le fichier de test sur le disque : deux cas dans un describe, terminé par un saut de ligne.
const DISK = [
  "import { describe, expect, it } from 'vitest';",   // 1
  '',                                                  // 2
  "describe('deux cas', () => {",                      // 3
  "  it('premier cas', () => {",                       // 4
  '    expect(1).toBe(1);',                            // 5
  '  });',                                             // 6
  '',                                                  // 7
  "  it('second cas', () => {",                        // 8
  '    expect(2).toBe(2);',                            // 9
  '  });',                                             // 10
  '});',                                               // 11
  '',
].join('\n');

// Le fichier tel que le relevé le donne, et son texte tel que le disque le pousse.
const FILE: VibeTestFile = {
  id: 'i0', path: 'src/x/tests/invariants/x.test.ts', blob: '0'.repeat(40),
  cases: ['premier cas', 'second cas'], lines: [4, 8], source: DISK, reading: null, marks: {},
};
const CODE = { id: FILE.id, text: DISK, time: 1 };

// L'éditeur du cas de rang i monté ; chaque texte que l'enregistrement reçoit.
async function editor(i: number) {
  const saved: string[] = [];
  let d!: FileDraft;
  const Probe = () => {
    d = useCaseDraft(FILE, FILE.cases[i], caseRange(FILE, i), CODE, null,
      async (_, text) => { saved.push(text); return true; }, useState<Drafts>({}));
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(async () => { root.render(createElement(Probe)); });
  return { saved, get d() { return d; } };
}

// Les lignes du texte.
const lines = (text: string) => text.split('\n');

describe('l’éditeur d’un cas n’enregistre aucune autre ligne du fichier que celles de son bloc', () => {
  it('le premier cas modifié et enregistré : le reste du fichier est celui du disque', async () => {
    const e = await editor(0);
    const block = ["  it('premier cas', () => {", '    const a = 1;', '    expect(a).toBe(1);', '  });'].join('\n');

    await act(async () => e.d.change(block));
    await act(async () => e.d.save());

    // témoin : un fichier a bien été envoyé à l'enregistrement, avec le bloc modifié
    expect(e.saved.at(-1)).toContain(block);
    // les trois lignes avant le bloc sont celles du disque
    expect(lines(e.saved.at(-1) ?? '').slice(0, 3)).toEqual(lines(DISK).slice(0, 3));
    // les lignes après le bloc (de la ligne vide qui le suit jusqu'à la fin) sont celles du disque
    expect(lines(e.saved.at(-1) ?? '').slice(-6)).toEqual(lines(DISK).slice(-6));
  });

  it('le dernier cas modifié et enregistré : le reste du fichier est celui du disque', async () => {
    const e = await editor(1);
    const block = ["  it('second cas', () => {", '    expect(20).toBe(20);', '  });', '});'].join('\n');

    await act(async () => e.d.change(block));
    await act(async () => e.d.save());

    // témoin : un fichier a bien été envoyé à l'enregistrement, avec le bloc modifié
    expect(e.saved.at(-1)).toContain(block);
    // les sept lignes avant le bloc, dont le premier cas, sont celles du disque
    expect(lines(e.saved.at(-1) ?? '').slice(0, 7)).toEqual(lines(DISK).slice(0, 7));
    // le saut de ligne final du fichier est gardé
    expect(e.saved.at(-1)?.endsWith('});\n')).toBe(true);
  });
});
