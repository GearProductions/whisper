/** listen-from — écouter une fenêtre sur ses canaux, et seulement elle : un
 *  message venu d'une autre fenêtre, ou d'une fenêtre fermée, est ignoré
 *  (SPEC I-20). Seul endroit du principal qui écoute les pages.
 *  Ne connaît pas : les canaux eux-mêmes (passés), le métier.
 *  Utilisé par : app/ipc. */
import type { Channels, HandlerTable } from 'shared/bridge';

type Event = { sender: unknown };
export type IpcLike = {
  on(channel: string, fn: (e: Event, ...args: unknown[]) => void): unknown;
  handle(channel: string, fn: (e: Event, ...args: unknown[]) => unknown): unknown;
};
export type Sender = { webContents: unknown; isDestroyed(): boolean };

export function listenFrom<C extends Channels>(ipc: IpcLike, window: () => Sender | null, channels: C, handlers: HandlerTable<C>) {
  const allowed = (list: readonly string[], table: Record<string, unknown>) => {
    for (const ch of Object.keys(table)) if (!list.includes(ch)) throw new Error(`canal ${ch} : pas un canal de cette fenêtre`);
  };
  allowed(channels.send, handlers.on);
  allowed(channels.invoke, handlers.handle);
  const from = (e: Event) => {
    const w = window();
    return !!w && !w.isDestroyed() && e.sender === w.webContents;
  };
  for (const [ch, fn] of Object.entries(handlers.on) as [string, (...a: unknown[]) => void][]) {
    ipc.on(ch, (e, ...args) => { if (from(e)) fn(...args); });
  }
  for (const [ch, fn] of Object.entries(handlers.handle) as [string, (...a: unknown[]) => unknown][]) {
    ipc.handle(ch, (e, ...args) => (from(e) ? fn(...args) : undefined));
  }
}
