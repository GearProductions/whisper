// tmp-dir (le globalSetup des tests) : le dossier temporaire d'un lancement porte son pid, et un lancement balaie ceux
// qu'une suite morte a laissés (T-49 : une suite interrompue avait laissé 468 000 fichiers, et la suivante échouait
// faute d'inodes). Un lancement vivant, ou un dossier qui n'est pas un lancement, n'est jamais touché.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { sweep } from './tmp-dir';

let root = '';
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const make = (name: string, ageHours = 0) => {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'profil'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'profil', 'f'), 'x');
  const t = (Date.now() - ageHours * 3_600_000) / 1000;
  fs.utimesSync(dir, t, t);
  return dir;
};
const left = () => fs.readdirSync(root).sort();

it('le dossier d’un lancement mort est effacé ; celui d’un lancement vivant reste', () => {
  make('whisper-tests-111-aaaaaa');
  make('whisper-tests-222-bbbbbb');
  sweep(root, (pid) => pid === 222);
  expect(left()).toEqual(['whisper-tests-222-bbbbbb']);
});

it('un dossier d’avant le pid (whisper-tests-XXXXXX) : effacé s’il a plus de six heures, gardé sinon', () => {
  make('whisper-tests-Old123', 7);
  make('whisper-tests-New123', 1);
  sweep(root, () => false);
  expect(left()).toEqual(['whisper-tests-New123']);
});

it('ce qui n’est pas un lancement des tests n’est jamais touché', () => {
  make('autre-chose-111-aaaaaa', 48);
  make('whisper-dev', 48);
  sweep(root, () => false);
  expect(left()).toEqual(['autre-chose-111-aaaaaa', 'whisper-dev']);
});
