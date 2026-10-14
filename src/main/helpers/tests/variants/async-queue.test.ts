import { describe, expect, it } from 'vitest';
import { createQueue } from 'helpers';

describe('createQueue', () => {
  it('rend les éléments dans l’ordre, attend les suivants, se termine à close', async () => {
    const q = createQueue<number>();
    const read: number[] = [];
    q.push(1);
    const reading = (async () => { for await (const n of q) read.push(n); })();
    await new Promise((r) => setTimeout(r, 0));
    q.push(2); q.push(3);
    await new Promise((r) => setTimeout(r, 0));
    expect(read).toEqual([1, 2, 3]);
    q.close();
    q.push(4); // ignoré : fermée
    await reading;
    expect(read).toEqual([1, 2, 3]);
  });
});
