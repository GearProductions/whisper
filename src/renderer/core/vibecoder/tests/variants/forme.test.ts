import { describe, expect, it } from 'vitest';
import { contractParts, moduleLine } from 'core/vibecoder';

describe('moduleLine', () => {
  it('un contrat sur plusieurs lignes : sa première ligne', () => {
    expect(moduleLine('un module en une phrase\nne connaît pas : le DOM\nvariants : a.test.ts\n- un cas')).toBe('un module en une phrase');
  });

  it('un contrat d’une ligne à « · » : ce qui précède le premier « · »', () => {
    expect(moduleLine('gitRun(dir) : git en execFile · ne connaît pas : Electron · utilisé par : app')).toBe('gitRun(dir) : git en execFile');
  });

  it('un contrat qui commence par une rubrique : rien (français, anglais, « variants : »)', () => {
    expect(moduleLine('ne connaît pas : le DOM, React')).toBe('');
    expect(moduleLine('Used by: journey')).toBe('');
    expect(moduleLine('variants : a.test.ts\n- un cas')).toBe('');
  });

  it('un contrat vide ou blanc : rien', () => {
    expect(moduleLine('')).toBe('');
    expect(moduleLine('  \n \n')).toBe('');
  });

  it('le « (repris) » de tête est gardé tel quel', () => {
    expect(moduleLine('(repris) un module en une phrase\nne connaît pas : React')).toBe('(repris) un module en une phrase');
  });

  it('lignes vides de tête ignorées, « · » de tête sans rubrique vide, un « · » collé au texte n’est pas un séparateur', () => {
    expect(moduleLine('\n\n  fait a · utilisé par : b')).toBe('fait a');
    expect(moduleLine('· expose la note · ne connaît pas : React')).toBe('expose la note');
    expect(moduleLine('a·b · c')).toBe('a·b');
  });

  it('un mot de libellé sans « : » reste du texte', () => {
    expect(moduleLine('variants de la forme, listés')).toBe('variants de la forme, listés');
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

  it('un contrat sur plusieurs lignes (Forme aérée) : une rubrique par ligne qui en ouvre une, « variants : » reconnu, un cas « - » en élément', () => {
    expect(contractParts('a(x) → y\nne connaît pas : Electron\nvariants : core/tests/variants/a.test.ts\n- un cas\n- un autre')).toEqual([
      { label: null, text: 'a(x) → y' },
      { label: 'ne connaît pas', text: 'Electron' },
      { label: 'variants', text: 'core/tests/variants/a.test.ts' },
      { label: null, text: 'un cas', item: true },
      { label: null, text: 'un autre', item: true },
    ]);
  });

  it('une ligne qui n’ouvre aucune rubrique continue la phrase d’avant (une Forme ancienne coupe ses phrases) ; un « · » en tête ouvre', () => {
    expect(contractParts('a(x) → y ;\nb() → z\nne connaît pas : Electron,\nle disque\n· utilisé par : app\n- un cas\n  suite du cas')).toEqual([
      { label: null, text: 'a(x) → y ; b() → z' },
      { label: 'ne connaît pas', text: 'Electron, le disque' },
      { label: 'utilisé par', text: 'app' },
      { label: null, text: 'un cas suite du cas', item: true },
    ]);
  });

  it('contrat vide : aucune rubrique', () => {
    expect(contractParts('')).toEqual([]);
  });
});
