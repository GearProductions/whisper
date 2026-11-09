// Le faux du SDK de Claude Code : chaque message reçu ouvre un tour, relevé, qui dure jusqu'à interrupt()
// (ou, avec { finish: true }, finit aussitôt sur un succès sans rien écrire) ; chaque rewindFiles est relevé.
// Ne connaît pas : le principal, ce que vérifient les tests.
// Utilisé par : le barrel (harness).
import { current } from './profile';

// Un tour reçu : le skill appelé (le premier mot du message), et s'il est fini.
export type Turn = { skill: string; done: boolean };
export type ClaudeFake = {
  module: Record<string, unknown>;
  turns: Turn[];
  rewound: string[];   // pour chaque rewindFiles : le skill du premier message du processus qui l'a reçu
};

export function fakeClaude({ finish = false }: { finish?: boolean } = {}): ClaudeFake {
  const turns: Turn[] = [];
  const rewound: string[] = [];
  const module = {
    launcher: () => ({ executable: 'claude' }),
    loadSdk: async () => ({
      getSessionInfo: async () => null,
      getSessionMessages: async () => [],
      query: ({ prompt }: { prompt: AsyncIterable<{ message: { content: unknown } }> }) => {
        let stop = () => {};
        let first = '';   // le skill du premier message de ce processus
        return Object.assign((async function* run() {
          for await (const m of prompt) {
            const turn = { skill: String(m.message.content).split(' ')[0], done: false };
            first ||= turn.skill;
            turns.push(turn);
            if (!finish) await new Promise<void>((ok) => { stop = ok; });
            turn.done = true;
            yield finish
              ? { type: 'result', subtype: 'success', is_error: false, result: 'ok' }
              : { type: 'result', subtype: 'error_during_execution', is_error: true };
          }
        }()), {
          setPermissionMode: async () => {}, setModel: async () => {},
          interrupt: async () => { stop(); },
          rewindFiles: async () => { rewound.push(first); return { canRewind: true, filesChanged: [] }; },
        });
      },
    }),
  };
  current.resets.push(() => { turns.length = 0; rewound.length = 0; });
  return { module, turns, rewound };
}
