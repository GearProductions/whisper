// L'échelle d'une image jointe (imageScale) : le maximum que lisent les modèles actuels, 2576 px sur le grand côté et
// 3,75 mégapixels ; une capture en 1440p passe entière.
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ nativeImage: {} }));
const { imageScale } = await import('technicals/images');

describe('imageScale', () => {
  it('une capture 2560×1440, une image 1080p, un petit visuel : entières (1)', () => {
    expect([imageScale(2560, 1440), imageScale(1920, 1080), imageScale(800, 600)]).toEqual([1, 1, 1]);
  });

  it('plus longue que 2576 px : réduite à 2576 sur le grand côté', () => {
    expect(Math.round(3000 * imageScale(3000, 1000))).toBe(2576);
  });

  it('au-delà de 3,75 Mpx sans dépasser 2576 px de côté : réduite à 3,75 Mpx', () => {
    const s = imageScale(2500, 2500);
    expect(s).toBeLessThan(1);
    expect(Math.round(2500 * s * 2500 * s)).toBe(3_750_000);
  });
});
