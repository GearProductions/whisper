/** vibe-mode — le mode Vibe d'un agent (F-103), en mémoire : on (en cours),
 *  halted (arrêté par la bannière, des tours ou des courses vivent encore),
 *  off. nextVibeMode : stop : on → halted (le contrôleur évalue
 *  aussitôt le repos : off s'il l'est déjà) ; au repos (conversation libre,
 *  aucune course vivante ni demande retenue) : halted → off, on → off sans
 *  question ouverte (une question qui bloque le garde on) ; sinon inchangé.
 *  Les deux rythmes du créateur (note 0.16.0-controle-en-trois-points) : un seul moteur, ce mode ; le rythme par
 *  défaut tient deux pauses, l'express aucune.
 *  holdsPause(o: { at: VibePause | null; express: boolean; released: VibePause | null }): boolean — la pause où se
 *  tient le parcours (at, calculée par journey) est-elle tenue : 'note' (la note a perdu son ✓) toujours, express
 *  compris ; 'withdrawn:<étape>' (un ✓ d'étape retiré à la main, qui tient) de même, toujours, express compris,
 *  relancée ou pas ; 'invariants' et 'modules' au rythme par défaut seulement, et pas celle d'où l'utilisateur vient de
 *  relancer (released) ; null : non. Tenue, le contrôleur arrête le moteur comme la bannière (stop : la file jetée,
 *  la porte agent refuse halted), il ne repart qu'au geste de l'utilisateur.
 *  Ne connaît pas : Electron, le disque, les courses (leur compte est passé), le parcours (la pause est passée).
 *  Utilisé par : app/controllers (runs). */
import type { VibePause } from 'shared/bridge';

export type VibeMode = 'on' | 'halted' | 'off';
export type VibeRest = { busy: boolean; live: number; waiting: number; questions: number };

const atRest = (r: VibeRest) => !r.busy && !r.live && !r.waiting;

export function nextVibeMode(mode: VibeMode, e: 'stop' | VibeRest): VibeMode {
  if (e === 'stop') return mode === 'on' ? 'halted' : mode;
  if (!atRest(e)) return mode;
  return mode === 'halted' || !e.questions ? 'off' : mode;
}

export function holdsPause(o: { at: VibePause | null; express: boolean; released: VibePause | null }): boolean {
  if (!o.at) return false;
  return o.at === 'note' || o.at.startsWith('withdrawn:') || (!o.express && o.at !== o.released);
}
