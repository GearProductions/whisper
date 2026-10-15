import { describe, expect, it } from 'vitest';
import { contractParts, groupModules } from 'core/vibecoder';
import type { VibeModule } from 'technicals/bridge';

const mod = (path: string): VibeModule => ({ path, contract: '', file: null, touched: false, commits: [] });

describe('groupModules', () => {
  it('par premier dossier, dans l\'ordre d\'apparition ; un src/ de tête ignoré ; la racine : groupe vide', () => {
    const groups = groupModules(['main/core/vibecoder/', 'shared/bridge/types.ts', 'src/main/app/settings.ts', 'package.json', 'main/technicals/git/']
      .map(mod));
    expect(groups.map((g) => [g.folder, g.modules.map((m) => m.path)])).toEqual([
      ['main/', ['main/core/vibecoder/', 'src/main/app/settings.ts', 'main/technicals/git/']],
      ['shared/', ['shared/bridge/types.ts']],
      ['', ['package.json']],
    ]);
  });

  it('aucun module : aucun groupe', () => {
    expect(groupModules([])).toEqual([]);
  });
});

describe('contractParts', () => {
  it('coupé à ses « · », libellés reconnus (français)', () => {
    expect(contractParts('gitRun(dir) : git en execFile · ne connaît pas : VibeCoder, Electron · utilisé par : app/controllers/vibecoder'))
      .toEqual([
        { label: null, text: 'gitRun(dir) : git en execFile' },
        { label: 'ne connaît pas', text: 'VibeCoder, Electron' },
        { label: 'utilisé par', text: 'app/controllers/vibecoder' },
      ]);
  });

  it('libellés anglais, et « Expose : » en tête (forme en titres ###)', () => {
    expect(contractParts('Exposes: parseNote(md) · Doesn\'t know: Electron · Used by: journey')).toEqual([
      { label: 'Exposes', text: 'parseNote(md)' }, { label: 'Doesn\'t know', text: 'Electron' }, { label: 'Used by', text: 'journey' },
    ]);
  });

  it('un mot de libellé sans « : » reste du texte ; un « · » de tête ne laisse pas de rubrique vide', () => {
    expect(contractParts('· expose la note au panneau')).toEqual([{ label: null, text: 'expose la note au panneau' }]);
  });

  it('contrat vide : aucune rubrique', () => {
    expect(contractParts('')).toEqual([]);
  });
});
