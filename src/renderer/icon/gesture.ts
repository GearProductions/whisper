/** gesture — un seul appui, deux gestes : BOUGER au-delà de DRAG_PX déplace la
 *  fenêtre ; MAINTENIR HOLD_MS sans bouger dicte, jusqu'au relâché où que soit
 *  le curseur (capture du pointeur). Un simple clic ne fait rien.
 *  Ne connaît pas : le pont (les rappels sont passés), le micro.
 *  Utilisé par : IconApp. */
import { useRef } from 'react';
import type { PointerEvent } from 'react';
import type { Bounds } from '../bridge';

export const DRAG_PX = 5;
export const HOLD_MS = 300;

export type GestureHandlers = {
  getBounds(): Promise<Bounds | null>;
  moveTo(x: number, y: number): void;
  dropAt(x: number, y: number): void;
  holdStart(): void;
  holdEnd(): void;
};

export function useGesture(h: GestureHandlers) {
  const g = useRef({
    pressed: false, mode: null as null | 'drag' | 'dictate', hold: undefined as ReturnType<typeof setTimeout> | undefined,
    startX: 0, startY: 0, winX: 0, winY: 0, lastX: 0, lastY: 0,
  }).current;
  const handlers = useRef(h);
  handlers.current = h;

  function end(e: PointerEvent<HTMLElement>) {
    if (!g.pressed) return;
    g.pressed = false;
    clearTimeout(g.hold); g.hold = undefined;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    if (g.mode === 'drag') handlers.current.dropAt(g.lastX, g.lastY);
    else if (g.mode === 'dictate') handlers.current.holdEnd();
    g.mode = null;
  }

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return;
      g.pressed = true;
      g.mode = null;
      g.startX = e.screenX; g.startY = e.screenY;
      e.currentTarget.setPointerCapture(e.pointerId);
      // Position lue en parallèle : le seuil de glisser laisse le temps qu'elle arrive.
      handlers.current.getBounds().then((b) => {
        if (!b) return;
        g.winX = b.x; g.winY = b.y; g.lastX = b.x; g.lastY = b.y;
      });
      g.hold = setTimeout(() => {
        g.hold = undefined;
        if (!g.pressed || g.mode) return;
        g.mode = 'dictate';
        handlers.current.holdStart();
      }, HOLD_MS);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      if (!g.pressed || g.mode === 'dictate') return;
      const dx = e.screenX - g.startX;
      const dy = e.screenY - g.startY;
      if (!g.mode) {
        if (Math.hypot(dx, dy) < DRAG_PX) return;
        g.mode = 'drag';
        clearTimeout(g.hold); g.hold = undefined;
      }
      g.lastX = g.winX + dx;
      g.lastY = g.winY + dy;
      handlers.current.moveTo(g.lastX, g.lastY);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
