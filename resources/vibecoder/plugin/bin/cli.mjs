// cli — le pur de la commande vibecoder, en JS lancé par node sans
// construction (aucun import de src/) : où est live.json, ce qu'il porte, à qui
// se connecter (l'environnement d'un robot d'abord, et alors live.json jamais
// lu ; sinon live.json et son jeton extérieur), la ligne de commande lue, la
// réponse rendue et son code de sortie (0 : ok, en attente compris ; 1 : un
// refus ; usage : 2).
// Ne connaît pas : le réseau, le disque (les textes lui sont donnés), la table.
// Utilisé par : plugin/bin/vibecoder.mjs ; ses tests (tests/cli/,
// tests/invariants/cli-robot-env.test.ts).
// Squelette (invariants rouges) : le module vient à l'étape des modules.

const notImplemented = () => { throw new Error('not implemented'); };

// livePath(env, platform: string, home: string) → string
export const livePath = (_env, _platform, _home) => notImplemented();
// readLive(text: string | null) → { port: number ; token?: string } | null
export const readLive = (_text) => notImplemented();
// callFrom(env, readLiveFile: () => string | null) → { port ; token } | { error: string }
export const callFrom = (_env, _readLiveFile) => notImplemented();
// parseCommandLine(argv: string[]) → { cmd ; args ; json } | { local ; name? ; json } | { usage }
export const parseCommandLine = (_argv) => notImplemented();
// render(answer, json: boolean) → string
export const render = (_answer, _json) => notImplemented();
// exitCode(answer) → 0 | 1
export const exitCode = (_answer) => notImplemented();
