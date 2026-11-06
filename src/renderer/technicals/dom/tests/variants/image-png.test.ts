// imagePng : une image collée, redessinée par le navigateur (qui la lit, puisqu'il l'affiche) et réencodée en PNG,
// pour que le principal (nativeImage, plus strict) la lise aussi ; seul un PNG est redessiné (un GIF, un JPEG, un WebP
// partent tels quels) ; un échec, ou un PNG obtenu plus gros que la borne du principal (50 Mo) : l'originale.
import { afterEach, expect, it, vi } from 'vitest';
import { imagePng } from 'technicals/dom';

const file = (type: string, bytes = [1, 2, 3]) => ({ type, arrayBuffer: async () => new Uint8Array(bytes).buffer }) as unknown as File;
const PNG = new Uint8Array([137, 80, 78, 71]).buffer;

afterEach(() => vi.unstubAllGlobals());

function browser(ok = true, out: ArrayBuffer = PNG) {
  const drawn: unknown[] = [];
  vi.stubGlobal('createImageBitmap', async (f: unknown) => { if (!ok) throw new Error('illisible'); return { width: 4, height: 3, close() {}, f }; });
  vi.stubGlobal('OffscreenCanvas', class {
    constructor(public width: number, public height: number) {}
    getContext() { return { drawImage: (b: unknown) => drawn.push(b) }; }
    async convertToBlob(o: { type: string }) { return { type: o.type, arrayBuffer: async () => out }; }
  });
  return drawn;
}

it('une capture PNG : redessinée, rendue en PNG', async () => {
  const drawn = browser();
  expect(await imagePng(file('image/png'))).toEqual({ type: 'image/png', data: PNG });
  expect(drawn).toHaveLength(1);
});

it('un JPEG ou un WebP part tel quel, sans être redessiné (réencodé en PNG, il pèserait 5 à 10 fois plus)', async () => {
  const drawn = browser();
  for (const type of ['image/jpeg', 'image/webp']) {
    const out = await imagePng(file(type, [5, 6]));
    expect([out.type, [...new Uint8Array(out.data)]]).toEqual([type, [5, 6]]);
  }
  expect(drawn).toHaveLength(0);
});

it('le PNG obtenu dépasse la borne du principal (50 Mo) : l’originale, comme pour un échec', async () => {
  browser(true, new ArrayBuffer(50 * 1024 * 1024 + 1));
  const out = await imagePng(file('image/png', [8]));
  expect([out.type, out.data.byteLength]).toEqual(['image/png', 1]);   // l'originale (1 octet), pas le PNG obtenu
});

it('un PNG obtenu pile à la borne est gardé', async () => {
  const exact = new ArrayBuffer(50 * 1024 * 1024);
  browser(true, exact);
  expect((await imagePng(file('image/png', [8]))).data).toBe(exact);
});

it('un GIF (peut-être animé) part tel quel, sans être redessiné', async () => {
  const drawn = browser();
  const out = await imagePng(file('image/gif', [7, 7]));
  expect([out.type, [...new Uint8Array(out.data)]]).toEqual(['image/gif', [7, 7]]);
  expect(drawn).toHaveLength(0);
});

it('le navigateur ne la lit pas : l’originale, telle quelle', async () => {
  browser(false);
  const out = await imagePng(file('image/png', [9]));
  expect([out.type, [...new Uint8Array(out.data)]]).toEqual(['image/png', [9]]);
});
