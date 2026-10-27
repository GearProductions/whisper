/** vibe-mode — le mode Vibe d'un agent (F-103), en mémoire : on (en cours),
 *  halted (arrêté par la bannière, des tours ou des courses vivent encore),
 *  off. nextVibeMode : stop : on → halted (le contrôleur évalue
 *  aussitôt le repos : off s'il l'est déjà) ; au repos (conversation libre,
 *  aucune course vivante ni demande retenue) : halted → off, on → off sans
 *  question ouverte (une question qui bloque le garde on) ; sinon inchangé.
 *  Ne connaît pas : Electron, le disque, les courses (leur compte est passé).
 *  Utilisé par : app/controllers (runs, vibecoder). */

export type VibeMode = 'on' | 'halted' | 'off';
export type VibeRest = { busy: boolean; live: number; waiting: number; questions: number };

const atRest = (r: VibeRest) => !r.busy && !r.live && !r.waiting;

export function nextVibeMode(mode: VibeMode, e: 'stop' | VibeRest): VibeMode {
  if (e === 'stop') return mode === 'on' ? 'halted' : mode;
  if (!atRest(e)) return mode;
  return mode === 'halted' || !e.questions ? 'off' : mode;
}
