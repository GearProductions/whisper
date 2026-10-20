// Invariant de l'annulation d'une action qui court à part (note 0.9.0, « Ce
// que ça ne doit pas faire ») : annuler, à l'arrêt d'une action, autre chose
// que ce qu'elle a écrit (le travail du développeur ou d'une autre action).
// Une action court sous l'entrée <agent>~<action> du runtime ; l'annuler
// (rewind) ramène les fichiers que SES outils d'édition ont écrits à leur état
// d'avant son premier message : rewindFiles du SDK, sur SON processus, à SON
// premier message — jamais sur la conversation ni sur une autre action.
// Protégé : si un test échoue, corriger le code.
//
// Faux : le SDK de Claude Code (externe ; chaque query() joue un processus qui
// relève les messages reçus et les demandes de rewindFiles). Ce que les
// fichiers deviennent relève de Claude Code : on vérifie ce que notre code lui
// demande.
import { describe, expect, it, vi } from 'vitest';
import { createAgentRuntime, type AgentConfig } from 'core/agents';

type Msg = Record<string, unknown>;
type Proc = { received: Msg[]; rewound: unknown[][] };
const done = { type: 'result', subtype: 'success', result: 'fini', is_error: false };

// Un SDK factice : chaque query() est un processus qui finit son tour aussitôt
// et vit tant que son entrée est ouverte.
function setup() {
  const procs: Proc[] = [];
  const sdk = {
    query: ({ prompt }: { prompt: AsyncIterable<Msg> }) => {
      const p: Proc = { received: [], rewound: [] };
      procs.push(p);
      async function* proc() {
        yield { type: 'system', subtype: 'init', session_id: `s-${procs.length}` };
        for await (const m of prompt) {
          p.received.push(m);
          yield done;
        }
      }
      return Object.assign(proc(), {
        interrupt: vi.fn(async () => {}),
        setPermissionMode: vi.fn(async () => {}),
        setModel: vi.fn(async () => {}),
        rewindFiles: vi.fn(async (...args: unknown[]) => { p.rewound.push(args); return { canRewind: true, filesChanged: ['x.ts'] }; }),
      });
    },
  };
  const runtime = createAgentRuntime({ loadSdk: async () => sdk as never, launcher: () => ({ executable: '/bin/claude' }), journal: () => {} });
  // Une entrée du runtime : la conversation de l'agent (« a1 ») ou une de ses actions (« a1~forme »), même dossier.
  const entry = (id: string): AgentConfig => ({ id, name: 'a1', dir: '/tmp/a1', mode: 'default', model: '', effort: '', sessionId: null });
  const hooks = (a: AgentConfig) => ({
    command: '', instructions: '', checkpoint: a.id.includes('~'),
    onChange: () => {}, onSession: (s: string) => { a.sessionId = s; }, onPermission: () => {},
  });
  return { runtime, procs, entry, hooks };
}

describe('annuler une action ne ramène que ce qu’elle a écrit', () => {
  it('le processus de l’action, ramené à son premier message', async () => {
    const { runtime, procs, entry, hooks } = setup();
    const forme = entry('a1~forme');
    await runtime.send(forme, { text: '/vibecoder:forme fr /out' }, hooks(forme));
    await runtime.send(forme, { text: 'précise la forme' }, hooks(forme));
    const first = procs[0].received[0].uuid;

    await runtime.rewind('a1~forme');

    // le premier message de l'action porte un identifiant, auquel on peut revenir
    expect(first).toEqual(expect.any(String));
    // ramené une fois, à ce premier message : rien d'avant
    expect(procs[0].rewound.map((args) => args[0])).toEqual([first]);
  });

  it('la conversation de l’agent n’est pas ramenée', async () => {
    const { runtime, procs, entry, hooks } = setup();
    const conversation = entry('a1');
    const forme = entry('a1~forme');
    await runtime.send(conversation, { text: 'où en est la forme ?' }, hooks(conversation));
    await runtime.send(forme, { text: '/vibecoder:forme fr /out' }, hooks(forme));

    await runtime.rewind('a1~forme');

    // aucun retour en arrière demandé au processus de la conversation
    expect(procs[0].rewound).toEqual([]);
    // celui de l'action annulée, oui, à son premier message
    expect(procs[1].rewound.map((args) => args[0])).toEqual([procs[1].received[0].uuid]);
  });

  it('une autre action en cours n’est pas ramenée', async () => {
    const { runtime, procs, entry, hooks } = setup();
    const ponytail = entry('a1~ponytail');
    const forme = entry('a1~forme');
    await runtime.send(ponytail, { text: '/vibecoder:ponytail fr /out' }, hooks(ponytail));
    await runtime.send(forme, { text: '/vibecoder:forme fr /out' }, hooks(forme));

    await runtime.rewind('a1~forme');

    // aucun retour en arrière demandé au processus de l'autre action
    expect(procs[0].rewound).toEqual([]);
    // celui de l'action annulée, oui, à son premier message
    expect(procs[1].rewound.map((args) => args[0])).toEqual([procs[1].received[0].uuid]);
  });

  // Réponses aux questions : une nouvelle course sous la même clé (« note »), qui reprend la session de la note, déjà gardée.
  it('une course qui reprend la session d’une course gardée : seule la nouvelle est ramenée', async () => {
    const { runtime, procs, entry, hooks } = setup();
    const note = entry('a1~note');
    await runtime.send(note, { text: '/vibecoder:note fr /out une demande' }, hooks(note));
    runtime.forget('a1~note');
    await vi.waitFor(() => expect(runtime.active()).toBe(0));
    await runtime.send(note, { text: 'Réponses aux questions ouvertes :\n1. oui' }, hooks(note));
    const answers = procs[1].received[0].uuid;

    await runtime.rewind('a1~note');

    // la note gardée n'est pas ramenée : rien n'est demandé à son processus
    expect(procs[0].rewound).toEqual([]);
    // ramené au premier message de la course en cours : les réponses
    expect(procs[1].rewound.map((args) => args[0])).toEqual([answers]);
  });
});
