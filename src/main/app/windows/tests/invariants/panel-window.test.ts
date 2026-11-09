// Invariant de la frontière de la page (note 0.15.0,
// docs/tickets/refactor/0.15.0-assainir-invariants.md, point 8 « Une protection
// ajoutée : la frontière de la page », et « Ce que ça ne doit pas faire » :
// « Affaiblir une garde de sécurité »). La page n'a pas accès à Node
// (contextIsolation, sandbox), ne peut ni naviguer ailleurs (will-navigate) ni
// ouvrir de fenêtre (setWindowOpenHandler) : c'est ce qui empêche un texte piégé
// (une réponse d'agent, une note, une PR) d'atteindre le disque (SPEC I-20 :
// la page ne parle au principal que par son pont ; I-21 : le panneau ne
// navigue jamais).
// Le variant app/windows/tests/variants/panel-window.test.ts ne regarde que le
// cadre, la taille et la fermeture ; il reste tel quel.
// Protégé : si un test échoue, corriger le code.
// Ne connaît pas : le contenu de la page. Utilisé par : npm run test:invariants.
//
// Sur le vrai createWindow (app/windows) ; faux : Electron, le même que le
// variant, dont la fenêtre relève ses options et les gestionnaires posés sur
// sa page ; les réglages et les contrôleurs, qui ne décident rien ici.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  // Les options de chaque fenêtre créée.
  const opts: Record<string, unknown>[] = [];
  // Les gestionnaires posés sur la page (webContents.on), par évènement.
  const page = new Map<string, (...a: unknown[]) => unknown>();
  // Le gestionnaire des nouvelles fenêtres (setWindowOpenHandler).
  const open: { handler?: (d: { url: string }) => unknown } = {};
  class Win {
    webContents = {
      on: (ev: string, fn: (...a: unknown[]) => unknown) => { page.set(ev, fn); return this.webContents; },
      setWindowOpenHandler: (fn: (d: { url: string }) => unknown) => { open.handler = fn; },
      send() {},
    };
    constructor(o: Record<string, unknown>) { opts.push(o); }
    on() { return this; }
    once() { return this; }
    loadFile() {}
    setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {}
  }
  return { Win, opts, page, open };
});

vi.mock('electron', () => ({
  BrowserWindow: fake.Win,
  app: { quit() {} },
  shell: { openExternal: async () => {}, openPath: async () => '' },
}));
vi.mock('app/controllers', () => ({ pushAgents() {}, runsTab() {}, selectAgent() {} }));
vi.mock('app/settings', () => ({ loadConfig: () => ({}), page: (p: string) => p, preload: (p: string) => p, saveConfig() {} }));

const { createWindow } = await import('app/windows');

// Les préférences de la page de la fenêtre créée.
const prefs = () => (fake.opts[0]?.webPreferences ?? {}) as Record<string, unknown>;
// Une adresse hors de l'appli, où un texte piégé voudrait mener la page.
const ELSEWHERE = 'https://evil.example/steal';

beforeEach(() => {
  fake.opts.length = 0;
  fake.page.clear();
  fake.open.handler = undefined;
});

describe('createWindow : la frontière de la page (I-20, I-21)', () => {
  it('témoin : la fenêtre est créée, avec le preload du panneau', () => {
    createWindow();

    // une fenêtre, une seule
    expect(fake.opts).toHaveLength(1);
    // sa page charge le pont du panneau
    expect(String(prefs().preload)).toContain('panel');
  });

  it('la page n’a pas accès à Node : contextIsolation et sandbox vrais, nodeIntegration jamais vrai', () => {
    createWindow();

    // le monde de la page est séparé de celui du pont
    expect(prefs().contextIsolation).toBe(true);
    // la page tourne dans le bac à sable
    expect(prefs().sandbox).toBe(true);
    // Node n'est jamais ouvert à la page
    expect(prefs().nodeIntegration).not.toBe(true);
  });

  it('une navigation de la page (will-navigate) est empêchée', () => {
    createWindow();
    const preventDefault = vi.fn();

    fake.page.get('will-navigate')?.({ preventDefault }, ELSEWHERE);

    // la page ne quitte pas l'appli
    expect(preventDefault).toHaveBeenCalled();
  });

  it('une nouvelle fenêtre (setWindowOpenHandler) est refusée', () => {
    createWindow();

    const answer = fake.open.handler?.({ url: ELSEWHERE });

    // aucune fenêtre ne s'ouvre depuis la page
    expect(answer).toEqual({ action: 'deny' });
  });
});
