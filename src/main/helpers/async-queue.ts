/** async-queue — une file qu'on remplit d'un côté (push) et qu'on lit de
 *  l'autre comme un itérable asynchrone ; close() termine la lecture une fois
 *  la file vidée. Sert d'entrée à un processus qui vit entre deux messages.
 *  Ne connaît pas : le SDK, les agents. Utilisé par : core/agents (runtime). */

export type AsyncQueue<T> = AsyncIterable<T> & { push(item: T): void; close(): void };

export function createQueue<T>(): AsyncQueue<T> {
  const items: T[] = [];
  let closed = false;
  let wake: (() => void) | null = null; // le lecteur en attente d'un élément
  const signal = () => { if (wake) { wake(); wake = null; } };
  return {
    push(item) { if (!closed) { items.push(item); signal(); } },
    close() { closed = true; signal(); },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (items.length) { yield items.shift()!; continue; }
        if (closed) return;
        await new Promise<void>((ok) => { wake = ok; });
      }
    },
  };
}
