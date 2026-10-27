import { describe, expect, it, vi } from 'vitest';
import { findTerminal } from 'technicals/editor';

// `which` ne trouve que les programmes de `found`.
const found = new Set<string>();
vi.mock('technicals/paths', () => ({ which: (name: string) => (found.has(name) ? `/usr/bin/${name}` : null) }));
const only = (...names: string[]) => { found.clear(); names.forEach((n) => found.add(n)); };
// spawn relève ses arguments, ne lance rien.
const spawned: unknown[][] = [];
vi.mock('node:child_process', () => ({ spawn: (...a: unknown[]) => { spawned.push(a); return { on() { return this; }, unref() {} }; } }));
const launched = (command: string, platform: string) => {
  findTerminal(command, platform)!.open('/projet');
  const [program, args, opts] = spawned.at(-1) as [string, string[], { cwd: string; windowsHide: boolean }];
  return { program, args, cwd: opts.cwd, windowsHide: opts.windowsHide };
};

describe('findTerminal', () => {
  it('rien de réglé : le premier de la liste du système qui existe, lancé au dossier sans argument', () => {
    only('kitty', 'xterm');
    expect(findTerminal('', 'linux')?.name).toBe('kitty');
    expect(launched('', 'linux')).toEqual({ program: '/usr/bin/kitty', args: [], cwd: '/projet', windowsHide: false });
  });
  it('Windows : wt avec -d <dossier>, sinon cmd', () => {
    only('wt', 'cmd');
    expect(launched('', 'win32').args).toEqual(['-d', '/projet']);
    only('cmd');
    expect(launched('', 'win32')).toMatchObject({ program: '/usr/bin/cmd', args: [], cwd: '/projet' });
  });
  it('aucun trouvé, ou système inconnu : null', () => {
    only();
    expect(findTerminal(undefined, 'linux')).toBeNull();
    only('konsole');
    expect(findTerminal('', 'darwin')).toBeNull();
  });
  it('réglé : son texte comme nom, ses arguments, {dir} remplacé, lancé au dossier', () => {
    only('konsole');
    expect(findTerminal(' konsole --workdir {dir} ', 'linux')?.name).toBe('konsole --workdir {dir}');
    expect(launched('konsole --workdir {dir} -e distrobox enter dev', 'linux'))
      .toMatchObject({ args: ['--workdir', '/projet', '-e', 'distrobox', 'enter', 'dev'], cwd: '/projet' });
  });
  it('réglé sur un programme absent : null (pas de repli sur la liste)', () => {
    only('konsole');
    expect(findTerminal('absent --x', 'linux')).toBeNull();
  });
});
