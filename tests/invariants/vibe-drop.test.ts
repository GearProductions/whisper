// Invariant du pont du dépôt (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorer-artefacts.md, « Ce que ça ne doit pas
// faire » : « Lire un fichier désigné par un chemin venu de la page (I-37) »).
// Le pont lit le chemin dans le File (webUtils.getPathForFile), jamais dans ce
// que la page lui donne : un File construit par la page rend un chemin vide, et
// aucun texte de la page ne part vers le principal. La revérification du
// principal : src/main/core/vibecoder/tests/invariants/dropped-paths.test.ts.
// Le dossier d'arrivée (note docs/tickets/feat/0.13.0-gestion-artefacts.md, accord de
// l'utilisateur) : vibeDrop(files, folder) passe en plus l'id d'un dossier du relevé, une
// chaîne seule, que le principal ne lit jamais comme un chemin (artifact-ops.test.ts) ; le
// cas « un chemin en deuxième argument » devient : rien d'autre qu'une chaîne, ni un
// troisième argument.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai pont (src/preload/panel.ts) ; faux : Electron, dont getPathForFile
// fait comme le vrai : le chemin d'un File donné par l'utilisateur, '' sinon.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  conv: {} as Record<string, (...a: unknown[]) => unknown>,
  used: [] as [string, unknown[]][],
  // Les File que l'utilisateur a déposés, et leur chemin.
  given: new WeakMap<object, string>(),
}));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: (_name: string, api: Record<string, (...a: unknown[]) => unknown>) => { fake.conv = api; } },
  ipcRenderer: {
    send: (ch: string, ...a: unknown[]) => { fake.used.push([ch, a]); },
    invoke: (ch: string, ...a: unknown[]) => { fake.used.push([ch, a]); return Promise.resolve({ ok: true }); },
    on: () => {},
  },
  webUtils: { getPathForFile: (file: unknown) => (file && typeof file === 'object' && fake.given.get(file)) || '' },
}));

const SECRET = '/etc/secret';
// Ce que le principal reçoit, tout canal confondu.
const sent = () => JSON.stringify(fake.used);
// Un File déposé par l'utilisateur.
function dropped(file: string) {
  const f = new File(['x'], file.split('/').at(-1)!);
  fake.given.set(f, file);
  return f;
}
// Le pont appelé comme une page l'appellerait ; ce qu'il lève ne compte pas, seul compte ce qui part.
async function pageCalls(...args: unknown[]) {
  try { await fake.conv.vibeDrop(...args); } catch { /* refusé : rien de plus à observer */ }
}

beforeEach(async () => {
  vi.resetModules();
  fake.conv = {};
  fake.used = [];
  await import('../../src/preload/panel');
});

describe('vibeDrop : le chemin vient du File, jamais de la page (I-37)', () => {
  it('témoin : les File déposés sur un dossier, le principal reçoit leurs chemins et l’id du dossier sur conv:vibeDrop', async () => {
    await fake.conv.vibeDrop([dropped('/home/moi/a.md'), dropped('/home/moi/b.md')], 'd0');

    // leurs chemins, dans l'ordre, l'id du dossier, et rien d'autre
    expect(fake.used).toEqual([['conv:vibeDrop', [['/home/moi/a.md', '/home/moi/b.md'], 'd0']]]);
  });

  // La page construit un File du nom qu'elle veut : ce nom ne devient pas un chemin.
  it('un File construit par la page, nommé comme un chemin : le nom ne part pas', async () => {
    await fake.conv.vibeDrop([new File(['x'], SECRET)]);

    // témoin : le canal est bien emprunté
    expect(fake.used.map(([ch]) => ch)).toEqual(['conv:vibeDrop']);
    // le chemin choisi par la page n'y est pas
    expect(sent()).not.toContain(SECRET);
  });

  // L'ancienne propriété File.path : un objet de la page peut la porter.
  it('un File construit par la page, avec sa propre propriété path : elle ne part pas', async () => {
    await fake.conv.vibeDrop([Object.assign(new File(['x'], 'a.md'), { path: SECRET })]);

    // témoin : le canal est bien emprunté
    expect(fake.used.map(([ch]) => ch)).toEqual(['conv:vibeDrop']);
    // le chemin choisi par la page n'y est pas
    expect(sent()).not.toContain(SECRET);
  });

  it('une chaîne à la place d’un File : elle ne part pas', async () => {
    await pageCalls([SECRET]);

    // témoin : le pont existe
    expect(fake.conv.vibeDrop).toBeTypeOf('function');
    // le chemin choisi par la page n'y est pas
    expect(sent()).not.toContain(SECRET);
  });

  it('un objet qui imite un File, avec un path : il ne part pas', async () => {
    await pageCalls([{ name: 'a.md', path: SECRET }]);

    // témoin : le pont existe
    expect(fake.conv.vibeDrop).toBeTypeOf('function');
    // le chemin choisi par la page n'y est pas
    expect(sent()).not.toContain(SECRET);
  });

  // Le dossier n'est qu'une chaîne : un objet qui porte un chemin n'est pas un dossier.
  it('un objet en deuxième argument, qui porte un chemin : il ne part pas', async () => {
    await fake.conv.vibeDrop([dropped('/home/moi/a.md')], { path: SECRET });

    // témoin : le chemin du File déposé part
    expect(sent()).toContain('/home/moi/a.md');
    // le chemin choisi par la page n'y est pas
    expect(sent()).not.toContain(SECRET);
  });

  it('un chemin en plus, en troisième argument : il ne part pas', async () => {
    await pageCalls([dropped('/home/moi/a.md')], 'd0', SECRET);

    // témoin : le chemin du File déposé part
    expect(sent()).toContain('/home/moi/a.md');
    // le chemin choisi par la page n'y est pas
    expect(sent()).not.toContain(SECRET);
  });
});
