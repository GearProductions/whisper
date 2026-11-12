import { describe, expect, it } from 'vitest';
import { fileDecision, fileTarget, type Bounds } from 'core/vibecoder';

// Un faux disque POSIX (chemins /…, /home → /var/home) : sous Windows, path.resolve y met une lettre de lecteur.
// Ces cas tournent hors de Windows ; là, les bornes sont gardées sur le vrai disque par l'invariant run-rights.
const onPosix = describe.runIf(process.platform !== 'win32');

const P = '/var/home/u/proj';
const OUT = '/var/home/u/out';
const PLUGIN = '/opt/plugin';
const B: Bounds = { project: P, out: OUT, plugin: PLUGIN, reads: false };

// Un faux disque : /home → /var/home, des liens, et des chemins qui n'existent pas (real lève).
const LINKS: Record<string, string> = { [`${P}/lien`]: '/etc', [`${P}/doc`]: `${P}/.git/hooks`, [`${P}/AGENTS.md`]: `${P}/notes.md` };
const real = (p: string): string => {
  if (p.startsWith('/home/')) return `/var${p}`;
  for (const [from, to] of Object.entries(LINKS)) if (p === from || p.startsWith(`${from}/`)) return to + p.slice(from.length);
  if (p.includes('/nouveau/')) throw new Error('ENOENT');
  return p;
};
const d = (tool: string, path: string, b: Bounds = B, key = 'file_path') => fileDecision(tool, { [key]: path }, b, real);
const refused = (tool: string, path: string, b: Bounds = B, key = 'file_path') => {
  const r = d(tool, path, b, key);
  expect(r.allow).toBe(false);
  return r.allow ? '' : r.reason;
};

onPosix('fileTarget', () => {
  it('file_path, notebook_path, path ; relatif au projet ; Glob et Grep sans path : le projet', () => {
    expect(fileTarget('Read', { file_path: 'a/b.ts' }, P)).toEqual({ path: `${P}/a/b.ts`, write: false });
    expect(fileTarget('NotebookEdit', { notebook_path: '/x/n.ipynb' }, P)).toEqual({ path: '/x/n.ipynb', write: true });
    expect(fileTarget('Grep', { path: '/etc' }, P)).toEqual({ path: '/etc', write: false });
    expect(fileTarget('Glob', { pattern: '*' }, P)).toEqual({ path: P, write: false });
    expect(fileTarget('Grep', { pattern: 'x', path: '' }, P)).toEqual({ path: P, write: false });
  });
  it('Write, Edit, MultiEdit, NotebookEdit écrivent ; Bash, Agent, WebFetch : null', () => {
    for (const t of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']) expect(fileTarget(t, { file_path: 'a' }, P)?.write).toBe(true);
    for (const t of ['Bash', 'Agent', 'WebFetch', 'mcp__x']) expect(fileTarget(t, { file_path: 'a', command: 'ls' }, P)).toBeNull();
  });
  it('une entrée qui n\'est pas un objet ou un chemin qui n\'est pas un texte : le projet', () => {
    expect(fileTarget('Read', null, P)?.path).toBe(P);
    expect(fileTarget('Read', { file_path: 3 }, P)?.path).toBe(P);
  });
});

onPosix('fileDecision : lire', () => {
  it('dans le projet, les sorties, le plugin : allow', () => {
    for (const p of [`${P}/src/a.ts`, 'src/a.ts', `${OUT}/x.md`, `${PLUGIN}/skills/x/SKILL.md`, P]) expect(d('Read', p)).toEqual({ allow: true });
  });
  it('/etc/hostname : refus, la raison cite le chemin', () => {
    expect(refused('Read', '/etc/hostname')).toContain('/etc/hostname');
  });
  it('Glob et Grep : sans path le projet, avec un path hors bornes refus', () => {
    expect(fileDecision('Glob', { pattern: '*' }, B, real)).toEqual({ allow: true });
    expect(fileDecision('Grep', { pattern: 'x' }, B, real)).toEqual({ allow: true });
    expect(refused('Grep', '/etc', B, 'path')).toContain('/etc');
    expect(refused('Glob', '/var/home/u', B, 'path')).toContain('/var/home/u');
  });
  it('lire un fichier borné : allow', () => {
    for (const p of ['AGENTS.md', 'src/AGENTS.md', 'package.json', '.claude/settings.json', '.git/config']) expect(d('Read', p)).toEqual({ allow: true });
  });
  it('les artefacts du projet (hors projet et sorties), les réglages de l\'utilisateur : refus', () => {
    refused('Read', '/var/home/u/artifacts/a.pdf');
    refused('Read', '/var/home/u/.claude/settings.json');
  });
});

onPosix('fileDecision : écrire', () => {
  it('dans le projet et les sorties : allow ; dans le plugin : refus', () => {
    for (const t of ['Write', 'Edit', 'MultiEdit']) {
      expect(d(t, 'src/a.ts')).toEqual({ allow: true });
      expect(d(t, `${OUT}/x.md`)).toEqual({ allow: true });
      expect(refused(t, `${PLUGIN}/skills/x/SKILL.md`)).toContain(`${PLUGIN}/skills/x/SKILL.md`);
    }
    expect(d('NotebookEdit', 'n.ipynb', B, 'notebook_path')).toEqual({ allow: true });
    refused('NotebookEdit', '/etc/n.ipynb', B, 'notebook_path');
  });
  it('reads : le projet refusé, les sorties permises', () => {
    const r = { ...B, reads: true };
    expect(refused('Write', 'src/a.ts', r)).toContain('src/a.ts');
    expect(d('Write', `${OUT}/x.md`, r)).toEqual({ allow: true });
    expect(d('Read', 'src/a.ts', r)).toEqual({ allow: true });
  });
  it('un fichier borné : refus, la raison cite le chemin', () => {
    for (const p of ['AGENTS.md', 'src/AGENTS.md', 'package.json', 'web/package.json', '.claude/settings.json', '.claude/skills/x/SKILL.md', '.git/hooks/pre-commit', '.husky/pre-commit', '.git', 'sub/.husky/x'])
      expect(refused('Edit', p)).toContain(p);
    expect(refused('MultiEdit', `${P}/.claude/settings.local.json`)).toContain('.claude');
  });
  it('un nom voisin d\'un nom borné n\'est pas borné ; la casse ne contourne pas', () => {
    for (const p of ['AGENTS.md.bak', 'my-package.json', '.claudeX/a', 'docs/.gitignore', 'a.husky']) expect(d('Write', p)).toEqual({ allow: true });
    refused('Write', 'agents.MD');
    refused('Write', '.GIT/config');
  });
  it('dans les sorties, un nom borné n\'est pas jugé', () => {
    expect(d('Write', `${OUT}/AGENTS.md`)).toEqual({ allow: true });
    expect(d('Write', `${OUT}/.claude/x`)).toEqual({ allow: true });
  });
  it('un fichier qui n\'existe pas encore (real lève) : jugé par son dossier', () => {
    expect(d('Write', 'nouveau/a.ts')).toEqual({ allow: true });
    refused('Write', `${P}/nouveau/.git/x`);
    refused('Write', '/etc/nouveau/x');
  });
});

onPosix('fileDecision : chemins', () => {
  it('../ qui sort du projet : refus ; ../ qui reste dedans : allow', () => {
    refused('Read', `${P}/../dehors/secret.txt`);
    refused('Write', '../secret.txt');
    expect(d('Read', 'a/../b.ts')).toEqual({ allow: true });
    refused('Write', 'a/../AGENTS.md');
  });
  it('un lien vers ailleurs : refus ; un lien vers un fichier borné : refus', () => {
    refused('Read', 'lien/passwd');
    refused('Write', 'lien/passwd');
    refused('Edit', 'doc/pre-commit');
    refused('Write', 'AGENTS.md'); // lien vers notes.md : le nom du chemin demandé borne
  });
  it('/home/… et /var/home/… du même projet : le même chemin', () => {
    expect(d('Read', '/home/u/proj/a.ts')).toEqual({ allow: true });
    refused('Edit', '/home/u/proj/package.json');
    refused('Read', '/home/u/autre/a.ts');
  });
  it('un voisin qui partage le préfixe n\'est pas dedans', () => {
    refused('Read', `${P}2/a.ts`);
    refused('Write', `${OUT}-x/a.ts`);
    refused('Read', `${PLUGIN}er/a`);
  });
});

onPosix('fileDecision : les autres outils', () => {
  it('Bash, Agent, WebFetch : allow', () => {
    for (const t of ['Bash', 'Agent', 'WebFetch'])
      expect(fileDecision(t, { command: 'cat /etc/passwd', file_path: '/etc/passwd', url: 'x' }, B, real)).toEqual({ allow: true });
  });
});

onPosix('fileDecision : le motif d’un Glob, le filtre d’un Grep', () => {
  it('un motif absolu ou qui remonte par .. : refus ; un motif du dossier : allow', () => {
    expect(fileDecision('Glob', { pattern: '/etc/*' }, B, real).allow).toBe(false);
    expect(fileDecision('Glob', { pattern: '../../**/secret.txt', path: P }, B, real).allow).toBe(false);
    expect(fileDecision('Grep', { pattern: 'x', glob: '../*.ts' }, B, real).allow).toBe(false);
    expect(fileDecision('Glob', { pattern: 'src/**/*.ts' }, B, real)).toEqual({ allow: true });
    expect(fileDecision('Grep', { pattern: '\\.\\./x', glob: '*.{ts,tsx}' }, B, real)).toEqual({ allow: true });
  });
});
