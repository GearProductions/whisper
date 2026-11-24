// Le faux du SDK de Claude Code : chaque message reçu ouvre un tour, relevé, qui dure jusqu'à interrupt() ou end()
// (ou, avec { finish: true }, finit aussitôt sur un succès sans rien écrire ; avec { finish: (skill) => … }, aussitôt
// pour les skills que le prédicat accepte, les autres durent : le moteur vibe qui reste au travail pendant que ses
// courses finissent) ; chaque rewindFiles est relevé.
// Ne connaît pas : le principal, ce que vérifient les tests.
// Utilisé par : le barrel (harness).
import { current } from './profile';

// Un tour reçu : le skill appelé (le premier mot du message), s'il est fini, les options du processus qui l'a reçu
// (ses droits : crochets, règles de refus) et end(ok), qui le finit (succès ou échec) quand il dure.
export type Turn = { skill: string; done: boolean; options: Record<string, unknown>; end: (ok: boolean) => void };
export type ClaudeFake = {
  module: Record<string, unknown>;
  turns: Turn[];
  rewound: string[];   // pour chaque rewindFiles : le skill du premier message du processus qui l'a reçu
};

export function fakeClaude({ finish = false }: { finish?: boolean | ((skill: string) => boolean) } = {}): ClaudeFake {
  const turns: Turn[] = [];
  const rewound: string[] = [];
  const module = {
    launcher: () => ({ executable: 'claude' }),
    loadSdk: async () => ({
      getSessionInfo: async () => null,
      getSessionMessages: async () => [],
      query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: Record<string, unknown> }) => {
        let stop = () => {};
        let first = '';   // le skill du premier message de ce processus
        return Object.assign((async function* run() {
          for await (const m of prompt) {
            const turn: Turn = { skill: String(m.message.content).split(' ')[0], done: false, options, end: () => {} };
            first ||= turn.skill;
            turns.push(turn);
            const now = typeof finish === 'function' ? finish(turn.skill) : finish;
            const ok = now || await new Promise<boolean>((done) => { turn.end = done; stop = () => done(false); });
            turn.done = true;
            yield ok
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
