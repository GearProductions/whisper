// Règles de structure des ponts (SPEC I-20) : qui écoute les pages, et sur
// quels canaux. Elles lisent le code du principal au lieu d'observer un
// comportement ; une retouche se signale dans la PR. Ne connaissent pas le
// comportement de l'appli. Utilisées par npm test.
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sources } from './sources';

// Tout le code du principal, sauf le module qui contrôle l'expéditeur.
const MAIN = resolve(__dirname, '../../src/main');

describe('principal : contrôle de l’expéditeur', () => {
  it('seul technicals/ipc écoute les pages', () => {
    const outside = sources(MAIN).filter(([p, s]) => !p.includes(join('technicals', 'ipc')) && /ipcMain\s*\.\s*(on|handle|once)\b/.test(s));
    expect(outside.map(([p]) => p)).toEqual([]);
  });

  it('seul le panneau est écouté, sur ses propres canaux', () => {
    const listen = sources(MAIN).map(([, s]) => s).join('\n');

    const calls = [...listen.matchAll(/listenFrom\(\s*\w+,\s*\(\)\s*=>\s*state\.(\w+),\s*(\w+_CHANNELS)/g)].map((m) => `${m[1]}:${m[2]}`).sort();

    // Une seule écoute : la fenêtre du panneau, sur les canaux du panneau.
    expect(calls).toEqual(['panel:PANEL_CHANNELS']);
  });
});
