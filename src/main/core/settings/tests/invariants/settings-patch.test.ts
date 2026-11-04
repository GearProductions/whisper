// Invariant de la page des réglages (note 0.14.0,
// docs/tickets/feat/0.14.0-allegement-interface-settings.md, « Ce que ça ne
// doit pas faire ») : écrire dans la configuration, depuis la page, une clé
// que la page ne montre pas, ou une valeur que la lecture refuserait (§ 9) —
// la commande des agents, de l'éditeur et du terminal sont des programmes que
// l'appli lance. Jamais Fable pour une action (I-36).
// Protégé : si un test échoue, corriger le code.
//
// Sur la vraie fonction (settingsPatch, pure) : null, c'est rien d'écrit.
import { describe, expect, it } from 'vitest';
import { withDefaults } from 'core/config';
import { settingsPatch, type SettingsFacts } from 'core/settings';

// Ce que le principal a lu : une action dont le skill fixe le modèle, qui
// liste même Fable parmi ses modèles (le refus ne doit pas dépendre de la liste).
const FACTS: SettingsFacts = {
  whisperModel: 'ggml-base.bin', download: null, soundCuts: true, recording: false,
  tts: 'installed', voices: { fr: [{ id: 'estelle', label: 'Estelle' }], en: [{ id: 'jane', label: 'Jane' }] },
  agentFound: true, editor: null, version: '0.14.0',
  actions: [{ id: 'forme', label: 'Forme', model: 'opus', models: ['sonnet', 'opus', 'fable'], efforts: ['low', 'high'] }],
};

describe('la page n’écrit que ses réglages, et des valeurs que la lecture garde', () => {
  it('une clé que la page ne montre pas n’est pas écrite', () => {
    const cfg = withDefaults({});
    const before = structuredClone(cfg);

    // `agents` : la liste des agents et de leurs dossiers, jamais montrée par la page.
    const patch = settingsPatch('agents', [{ id: 'x', dir: '/' }], cfg, FACTS);

    // Rien à écrire.
    expect(patch).toBeNull();
    // La configuration passée n'a pas changé.
    expect(cfg).toEqual(before);
  });

  it('une valeur que la lecture refuserait n’est pas écrite', () => {
    const cfg = withDefaults({});
    const before = structuredClone(cfg);
    // Une limite d'artefact qui n'est pas un entier.
    const refused = 1.5;
    // La lecture de config.json la refuse : elle prend le défaut.
    expect(withDefaults({ artifactTextMax: refused }).artifactTextMax).not.toBe(refused);

    const patch = settingsPatch('artifactTextMax', refused, cfg, FACTS);

    // Rien à écrire.
    expect(patch).toBeNull();
    // La configuration passée n'a pas changé.
    expect(cfg).toEqual(before);
  });

  it('Fable n’est jamais écrit comme modèle d’une action (I-36)', () => {
    const cfg = withDefaults({});
    const before = structuredClone(cfg);

    // Fable, même listé parmi les modèles de l'action.
    const patch = settingsPatch('model:forme', 'fable', cfg, FACTS);

    // Rien à écrire.
    expect(patch).toBeNull();
    // La configuration passée n'a pas changé.
    expect(cfg).toEqual(before);
  });

  it('une commande avec un caractère de contrôle n’est pas écrite', () => {
    const cfg = withDefaults({});
    const before = structuredClone(cfg);

    // Un retour à la ligne glissé dans la commande qui lance les agents.
    const patch = settingsPatch('agentCommand', 'claude\nrm -rf ~', cfg, FACTS);

    // Rien à écrire.
    expect(patch).toBeNull();
    // La configuration passée n'a pas changé.
    expect(cfg).toEqual(before);
  });
});
