// Invariant des messages que VibeCoder envoie à l'agent. Protégé : si un test
// échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : laisser une page mettre ce
//   qu'elle veut dans un message — seul {{text}} (le champ, écrit ou relu par
//   l'utilisateur, I-2) est libre ; un commit, un module, une PR ne sont pris
//   que dans le dernier relevé, un numéro de PR est un entier ; une variable
//   inconnue fait refuser l'action (l'agent lance des commandes avec ces
//   valeurs). Et : faire travailler l'agent sans que le fil le montre — le
//   message est le gabarit, ses variables remplies, rien d'autre.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { buildMessage, type ActionDef, type MessageContext } from 'core/vibecoder';

// Le dernier relevé : deux commits, deux modules (le premier pas encore touché), pas de PR.
const C1 = '9fceb02d0ae598e95dc970b74767f19372d61af8';
const C2 = 'e83c5163316f89bfbde7d9ab23ca2e25604af290';
const view: VibeView = {
  agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide',
  agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'main', changed: 1 }, error: null, steps: [],
  note: null, questions: [],
  modules: [
    { path: 'src/main/core/x', contract: 'expose x', file: null, touched: false, commits: [] },
    { path: 'src/main/core/y', contract: 'expose y', file: null, touched: true, commits: ['e83c516'] },
  ],
  invariants: [], variants: [],
  commits: [{ hash: C1, subject: 'Note, forme, invariants', fixup: false }, { hash: C2, subject: 'core/y', fixup: false }],
  outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0,
};
const ctx: MessageContext = { view, out: '/home/u/.config/whisper-dictation/vibecoder-out/a1', lang: 'fr' };

// Une action : ici, seuls son gabarit et ce dont elle a besoin comptent.
const action = (text: string, needs: ActionDef['needs'] = 'none'): ActionDef => (
  { id: 'essai', flow: 'create', step: 'modules', kind: 'send', needs, label: 'Essai', hint: '', text });
const RELIRE = action('/vibecoder:relire {{lang}} {{out}} {{commit}}', 'commit');
const MODULE = action('/vibecoder:module {{lang}} {{out}} {{module}}', 'module');
const CHARGER = action('/vibecoder:charger-pr {{lang}} {{out}} {{pr}}');
const NOTE = action('/vibecoder:note {{lang}} {{out}} {{text}}', 'text');

describe('un commit est pris dans le dernier relevé', () => {
  it('« "; rm -rf ~ » : refusé', () => {
    // pas un commit du relevé : l'action est refusée
    expect(buildMessage(RELIRE, { commit: '"; rm -rf ~' }, ctx)).toEqual({ error: 'commit' });
  });

  it('« --upload-pack=x » : refusé', () => {
    // une option déguisée en commit : refusée
    expect(buildMessage(RELIRE, { commit: '--upload-pack=x' }, ctx)).toEqual({ error: 'commit' });
  });

  it('un hash bien formé mais absent du relevé : refusé', () => {
    // bien formé ne suffit pas : il doit être un commit du relevé
    expect(buildMessage(RELIRE, { commit: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3' }, ctx)).toEqual({ error: 'commit' });
  });
});

describe('un module est pris dans le dernier relevé, par son rang', () => {
  it('rang hors limites : refusé', () => {
    // au-delà du dernier module
    expect(buildMessage(MODULE, { module: view.modules.length }, ctx)).toEqual({ error: 'module' });
  });

  it('rang négatif : refusé', () => {
    // avant le premier module
    expect(buildMessage(MODULE, { module: -1 }, ctx)).toEqual({ error: 'module' });
  });

  it('rang non entier : refusé', () => {
    // entre deux modules
    expect(buildMessage(MODULE, { module: 0.5 }, ctx)).toEqual({ error: 'module' });
  });
});

describe('un numéro de PR est un entier positif', () => {
  it('0 : refusé', () => {
    // pas de PR numéro 0
    expect(buildMessage(CHARGER, { pr: 0 }, ctx)).toEqual({ error: 'pr' });
  });

  it('un négatif : refusé', () => {
    // pas de PR négative
    expect(buildMessage(CHARGER, { pr: -3 }, ctx)).toEqual({ error: 'pr' });
  });

  it('un non entier : refusé', () => {
    // pas de PR 1,5
    expect(buildMessage(CHARGER, { pr: 1.5 }, ctx)).toEqual({ error: 'pr' });
  });

  it('un texte qu’une page ferait passer pour un numéro : refusé', () => {
    // les arguments viennent d'une page : leur type n'est pas garanti
    expect(buildMessage(CHARGER, { pr: '12; rm -rf ~' as unknown as number }, ctx)).toEqual({ error: 'pr' });
  });
});

describe('une variable inconnue fait refuser l’action', () => {
  it('{{x}} : refusé', () => {
    // hors de la liste fermée des variables
    expect(buildMessage(action('/vibecoder:verifier {{lang}} {{out}} {{x}}'), {}, ctx)).toEqual({ error: 'variable' });
  });
});

describe('le message est le gabarit, ses variables remplies, rien d’autre', () => {
  it('chaque variable remplacée par sa valeur, sans instruction ajoutée', () => {
    // exactement le gabarit, le commit du relevé à sa place
    expect(buildMessage(RELIRE, { commit: C1 }, ctx)).toEqual({ text: `/vibecoder:relire fr ${ctx.out} ${C1}` });
  });

  it('le texte du champ n’apparaît qu’à la place de {{text}}', () => {
    // le champ à sa place, et nulle part ailleurs
    expect(buildMessage(NOTE, { text: 'une demande' }, ctx)).toEqual({ text: `/vibecoder:note fr ${ctx.out} une demande` });
  });

  it('un gabarit sans {{text}} n’emporte pas le texte du champ', () => {
    // le gabarit seul : le champ n'y est pas
    expect(buildMessage(action('/vibecoder:verifier {{lang}} {{out}}'), { text: 'texte du champ' }, ctx)).toEqual({ text: `/vibecoder:verifier fr ${ctx.out}` });
  });

  it('le texte du champ part tel quel, même s’il ressemble à une variable', () => {
    const text = 'voir {{commit}} et {{x}}, à $& près, $$';
    // inséré une fois, tel quel : jamais relu comme un gabarit
    expect(buildMessage(NOTE, { text }, ctx)).toEqual({ text: `/vibecoder:note fr ${ctx.out} ${text}` });
  });
});
