// Invariant (SPEC I-20) : un message n'est traité que s'il vient de la fenêtre
// écoutée, et vivante. Un canal hors de la liste de la fenêtre n'est jamais
// écouté. Protégé : si ce test échoue, corriger le code.
import { describe, expect, it, vi } from 'vitest';
import { listenFrom, type IpcLike } from 'technicals/ipc';

function fakeIpc() {
  const on = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => void>();
  const handle = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
  const ipc: IpcLike = { on: (ch, fn) => { on.set(ch, fn); }, handle: (ch, fn) => { handle.set(ch, fn); } };
  return { ipc, on, handle };
}
const CHANNELS = { send: ['x:go'], invoke: ['x:ask'], events: [] } as const;

describe('contrôle de l’expéditeur', () => {
  const own = { webContents: {}, isDestroyed: () => false };
  const other = { webContents: {}, isDestroyed: () => false };

  it('traité seulement depuis la fenêtre écoutée', async () => {
    const { ipc, on, handle } = fakeIpc();
    const go = vi.fn();
    const ask = vi.fn(() => 'réponse');
    listenFrom(ipc, () => own, CHANNELS, { on: { 'x:go': go }, handle: { 'x:ask': ask } });
    on.get('x:go')!({ sender: other.webContents }, 1);
    expect(await handle.get('x:ask')!({ sender: other.webContents })).toBeUndefined();
    expect(go).not.toHaveBeenCalled();
    expect(ask).not.toHaveBeenCalled();
    on.get('x:go')!({ sender: own.webContents }, 1);
    expect(go).toHaveBeenCalledWith(1);
    expect(await handle.get('x:ask')!({ sender: own.webContents })).toBe('réponse');
  });

  it('ignoré si la fenêtre est fermée ou absente', () => {
    const { ipc, on } = fakeIpc();
    const go = vi.fn();
    let win: typeof own | null = { webContents: own.webContents, isDestroyed: () => true };
    listenFrom(ipc, () => win, CHANNELS, { on: { 'x:go': go }, handle: { 'x:ask': () => 1 } });
    on.get('x:go')!({ sender: own.webContents });
    win = null;
    on.get('x:go')!({ sender: own.webContents });
    expect(go).not.toHaveBeenCalled();
  });

  it('refuse un gestionnaire pour un canal qui n’est pas celui de la fenêtre', () => {
    const { ipc } = fakeIpc();
    expect(() => listenFrom(ipc, () => own, CHANNELS, { on: { 'x:go': () => {}, 'y:autre': () => {} } as never, handle: { 'x:ask': () => 1 } }))
      .toThrow(/y:autre/);
  });
});
