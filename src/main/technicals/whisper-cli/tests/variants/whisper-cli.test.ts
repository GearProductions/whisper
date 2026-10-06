import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { locateWhisper, wavFile } from 'technicals/whisper-cli';

describe('wavFile', () => {
  it('en-tête PCM 16 bits mono 16 kHz', () => {
    const wav = wavFile(Buffer.alloc(320));
    expect(wav.length).toBe(364);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(16000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(320);
  });
});

describe('locateWhisper', () => {
  it('le premier de chaque, dans l’ordre des dossiers ; whisper-cli jusqu’à deux niveaux', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-loc-'));
    const a = path.join(root, 'a');
    const b = path.join(root, 'b', 'build', 'bin');
    fs.mkdirSync(a, { recursive: true });
    fs.mkdirSync(b, { recursive: true });
    fs.writeFileSync(path.join(a, 'ggml-large.bin'), '');
    fs.writeFileSync(path.join(b, 'whisper-cli'), '');
    fs.writeFileSync(path.join(root, 'b', 'ggml-tiny.bin'), '');
    expect(locateWhisper([a, path.join(root, 'b')])).toEqual({ cli: path.join(b, 'whisper-cli'), model: path.join(a, 'ggml-large.bin') });
    expect(locateWhisper([path.join(root, 'absent')])).toEqual({ cli: null, model: null });
    fs.rmSync(root, { recursive: true, force: true });
  });
});
