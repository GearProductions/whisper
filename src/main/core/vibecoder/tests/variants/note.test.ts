import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findNote, noteKey, parseNote } from 'core/vibecoder';

// Une vraie note du dépôt (0.7.0) : sa Forme est un bloc de code « chemin  contrat ».
const ROOT = path.resolve(__dirname, '../../../../../..');
const real = parseNote(fs.readFileSync(path.join(ROOT, 'docs/tickets/feat/0.7.0-taches-en-arriere-plan.md'), 'utf8'));

describe('parseNote sur une vraie note (0.7.0)', () => {
  it('son titre est le premier titre #', () => {
    expect(real.title).toBe('0.7.0 — Ce que l\'agent surveille et lance en arrière-plan, visible');
  });

  it('« Ce que ça fait » est rédigée', () => {
    expect(real.filled).toBe(true);
  });

  it('ses rubriques sont ses titres ##, dans l\'ordre', () => {
    expect(real.sections.map((s) => s.name)).toEqual(
      ['Ce que ça fait', 'Ce que ça ne doit pas faire', 'Ce que ça touche', 'Forme', 'Pistes pour plus tard']);
  });

  it('chaque ligne « ne doit pas » porte sa marque', () => {
    expect(real.mustNot.map((l) => l.mark)).toEqual(['invariant', 'invariant', 'structure', 'review', 'variant']);
  });

  it('une ligne « ne doit pas » réunit ses lignes de suite', () => {
    expect(real.mustNot[3].text).toBe('Montrer les tâches d\'un autre agent ou d\'une autre session que celle affichée (I-22). → vu en review');
  });

  it('les modules de la Forme sont les lignes du bloc qui commencent par un chemin', () => {
    expect(real.modules.map((m) => m.path)).toEqual([
      'shared/bridge/types.ts', 'main/core/agents/tasks.ts', 'main/core/agents/runtime.ts', 'main/core/conversation/tasks-view.ts',
      'main/helpers/text.ts', 'main/app/controllers/conversation.ts', 'renderer/app/panel/components/header.tsx',
      'renderer/app/panel/components/tasks-pane.tsx', 'renderer/app/panel/panel-app.tsx', 'renderer/app/icon/',
    ]);
  });

  it('le contrat d\'un module est la fin de sa ligne', () => {
    expect(real.modules.find((m) => m.path === 'main/helpers/text.ts')?.contract).toBe('tail(text, lines, maxChars) (pur)');
  });

  it('le contrat d\'un module réunit ses lignes de suite, plus indentées', () => {
    expect(real.modules.find((m) => m.path === 'main/core/agents/tasks.ts')?.contract).toBe(
      'Task, TaskLog { tasks, tools } ; EMPTY_LOG ; applyTaskEvent(log, m, now) → log (pur, même référence si rien ne change) ;'
      + ' runningTasks(log) · ne connaît pas : le runtime, le disque · utilisé par : core/agents (runtime), core/conversation');
  });

  it('la Forme est aussi rendue telle quelle', () => {
    expect(real.forme.startsWith('La source n\'est pas la transcription')).toBe(true);
  });
});

// Le style de la note 0.8.0 : un dossier, puis ses fichiers indentés.
const GROUPS = `# 0.8.0 — x

## Forme

\`\`\`
main/technicals/git/        gitRun(dir) : git en execFile
                            · ne connaît pas : VibeCoder
main/core/vibecoder/        pur ; disque et git injectés
  note.ts                   parseNote(md) → NoteFacts ;
                            noteKey(branch, version)
  test-files.ts             isTest, caseTitles(src)
resources/vibecoder/        README.md, actions.fr.json,
                            plugin/.claude-plugin/plugin.json
package.json                extraResources
\`\`\`
`;

describe('parseNote : modules en dossiers (style 0.8.0)', () => {
  const { modules } = parseNote(GROUPS);

  it('les fichiers indentés sous un dossier deviennent dossier/fichier', () => {
    expect(modules.map((m) => m.path)).toContain('main/core/vibecoder/note.ts');
  });

  it('un dossier qui a des fichiers n\'est plus un module lui-même', () => {
    expect(modules.map((m) => m.path)).not.toContain('main/core/vibecoder/');
  });

  it('le contrat d\'un fichier du dossier réunit ses lignes de suite', () => {
    expect(modules.find((m) => m.path === 'main/core/vibecoder/note.ts')?.contract).toBe('parseNote(md) → NoteFacts ; noteKey(branch, version)');
  });

  it('un dossier sans fichiers indentés reste un module, avec son contrat', () => {
    expect(modules.find((m) => m.path === 'main/technicals/git/')?.contract).toBe('gitRun(dir) : git en execFile · ne connaît pas : VibeCoder');
  });

  it('un chemin aligné sur le contrat du dossier en est la suite, pas un fichier', () => {
    expect(modules.find((m) => m.path === 'resources/vibecoder/')?.contract).toBe('README.md, actions.fr.json, plugin/.claude-plugin/plugin.json');
  });

  it('un fichier sans dossier (package.json) est un module', () => {
    expect(modules.map((m) => m.path)).toEqual([
      'main/technicals/git/', 'main/core/vibecoder/note.ts', 'main/core/vibecoder/test-files.ts', 'resources/vibecoder/', 'package.json',
    ]);
  });
});

// Le style de gt-plugins (G2-6752) : un titre ### par module, Expose / Ne connaît pas / Utilisé par.
const HEADINGS = `# G2-6752 — add 3d-picker — note de ticket

## Forme

### core/parser/helpers/input-preparers.ts

Expose : \`registerInputPreparer(workflowName, preparer)\`
Ne connaît pas : les pickers, la 3D
Utilisé par : \`useProcess\`

### core/ui/components/model-viewer-3d/helpers/convert-to-glb.ts, load-model.ts

Expose : \`convertToGlb(file)\`, \`loadModel(file)\`

### core/parser/node-components/

#### save-glb

Expose : \`SaveGLB\`

### Décisions de forme

Rien d'autre.
`;

describe('parseNote : modules en titres ### (style G2-6752)', () => {
  const { modules } = parseNote(HEADINGS);

  it('chaque titre ### qui est un chemin est un module', () => {
    expect(modules[0].path).toBe('core/parser/helpers/input-preparers.ts');
  });

  it('ses lignes forment le contrat, jointes par « · »', () => {
    expect(modules[0].contract).toBe('Expose : `registerInputPreparer(workflowName, preparer)` · Ne connaît pas : les pickers, la 3D · Utilisé par : `useProcess`');
  });

  it('un titre qui nomme deux fichiers : le premier est le chemin, le reste ouvre le contrat', () => {
    expect(modules[1]).toEqual({
      path: 'core/ui/components/model-viewer-3d/helpers/convert-to-glb.ts', contract: 'load-model.ts · Expose : `convertToGlb(file)`, `loadModel(file)`',
    });
  });

  it('un ### qui finit par / est un dossier : ses #### sont ses modules', () => {
    expect(modules[2]).toEqual({ path: 'core/parser/node-components/save-glb', contract: 'Expose : `SaveGLB`' });
  });

  it('un titre qui n\'est pas un chemin clôt le module précédent', () => {
    expect(modules).toHaveLength(3);
  });
});

describe('parseNote : modules en liste ou en texte', () => {
  it('une puce « `chemin` : contrat » donne le chemin et le contrat', () => {
    expect(parseNote('## Forme\n- `core/x.ts` : expose a\n').modules).toEqual([{ path: 'core/x.ts', contract: 'expose a' }]);
  });

  it('le gabarit <chemin> n\'est pas un module', () => {
    expect(parseNote('## Forme\n<chemin>   expose … · ne connaît pas …\n').modules).toEqual([]);
  });

  it('une phrase qui commence par un chemin suivi d\'une virgule n\'est pas un module', () => {
    expect(parseNote('## Forme\n`main/core/x.ts`, `main/core/y.ts` sont à part.\n').modules).toEqual([]);
  });

  it('une ligne de texte non indentée clôt le contrat du module précédent', () => {
    expect(parseNote('## Forme\nlib/a.ts  pur\nLe reste est de la colle.\n').modules).toEqual([{ path: 'lib/a.ts', contract: 'pur' }]);
  });

  it('une rubrique « Shape » (anglais) est la Forme', () => {
    expect(parseNote('## Shape\nlib/a.ts  pure\n').modules).toEqual([{ path: 'lib/a.ts', contract: 'pure' }]);
  });
});

// Une note minimale, « Ce que ça ne doit pas faire » remplie de `lines`.
const mustNot = (...lines: string[]) => parseNote(`# x\n\n## Ce que ça ne doit pas faire\n${lines.join('\n')}\n`).mustNot;

describe('parseNote : la marque des lignes « ne doit pas »', () => {
  it('→ invariant', () => {
    expect(mustNot('- Lire un fichier désigné. → invariant')[0].mark).toBe('invariant');
  });

  it('→ variant suffit', () => {
    expect(mustNot('- Bloquer le fil. → variant suffit')[0].mark).toBe('variant');
  });

  it('→ vu en review', () => {
    expect(mustNot('- Changer la vue. → vu en review')[0].mark).toBe('review');
  });

  it('→ structure', () => {
    expect(mustNot('- Un shell pour git. → structure')[0].mark).toBe('structure');
  });

  it('sans marque : null', () => {
    expect(mustNot('- Planter.')[0].mark).toBeNull();
  });

  it('plusieurs marques : la première après la flèche', () => {
    expect(mustNot('- Faire travailler l\'agent en douce. → variant suffit (le message), structure (sendToAgent)')[0].mark).toBe('variant');
  });

  it('une flèche dans le texte : la marque suit la dernière', () => {
    expect(mustNot('- Changer A → B sans le dire. → invariant')[0].mark).toBe('invariant');
  });

  it('la marque sur une ligne de suite (guide § 7.1)', () => {
    expect(mustNot('- Monter toutes les vignettes.', '                                         → vérifié en review')[0].mark).toBe('review');
  });

  it('une marque en préfixe entre crochets : [structure]', () => {
    expect(mustNot('- [structure] Le picker ne connaît pas ComfyUI.')[0].mark).toBe('structure');
  });

  it('une marque en préfixe entre parenthèses : (review, sans test)', () => {
    expect(mustNot('- (review, sans test) La capture montre l\'angle affiché.')[0].mark).toBe('review');
  });

  it('une ligne en attente « (…) » du modèle de note est écartée', () => {
    expect(mustNot('- (marquer → invariant les seules lignes critiques et invisibles à l\'écran)')).toEqual([]);
  });

  it('une rubrique « What it must not do » (anglais) est lue aussi', () => {
    expect(parseNote('## What it must not do\n- Leak a token. → invariant\n').mustNot).toEqual([{ text: 'Leak a token. → invariant', mark: 'invariant' }]);
  });
});

describe('parseNote : « Ce que ça fait » rédigée ou non', () => {
  it('rubrique absente : non rédigée', () => {
    expect(parseNote('# x\n\n## Forme\nlib/a.ts  pur\n').filled).toBe(false);
  });

  it('rubrique vide : non rédigée', () => {
    expect(parseNote('# x\n\n## Ce que ça fait\n\n## Forme\n').filled).toBe(false);
  });

  it('rubrique qui ne contient qu\'un « (…) » : non rédigée', () => {
    expect(parseNote('# x\n\n## Ce que ça fait\n- (à rédiger)\n').filled).toBe(false);
  });

  it('« What it does » (anglais) avec du texte : rédigée', () => {
    expect(parseNote('# x\n\n## What it does\nA button.\n').filled).toBe(true);
  });

  it('un ## dans un bloc de code n\'ouvre pas de rubrique', () => {
    expect(parseNote('# x\n\n## Ce que ça fait\n```\n## pas un titre\n```\n').sections.map((s) => s.name)).toEqual(['Ce que ça fait']);
  });
});

describe('noteKey : la clé de la note d\'après la branche', () => {
  it('un ticket G2-6675', () => {
    expect(noteKey('feat/G2-6675-add-picker', '1.0.0')).toBe('G2-6675');
  });

  it('un ticket WT-14', () => {
    expect(noteKey('WT-14-release-builder', null)).toBe('WT-14');
  });

  it('une version portée par la branche (0.8.0), « vibecoder-1 » n\'étant pas un ticket', () => {
    expect(noteKey('feat/0.8.0-vibecoder-1-socle', '0.7.0')).toBe('0.8.0');
  });

  it('le ticket avant la version', () => {
    expect(noteKey('feat/G2-6675-v1.2.3', null)).toBe('G2-6675');
  });

  it('ni ticket ni version dans la branche : la version donnée', () => {
    expect(noteKey('feat/vibecoder', '0.7.0')).toBe('0.7.0');
  });

  it('rien du tout : null', () => {
    expect(noteKey('main', null)).toBeNull();
  });
});

describe('findNote : le .md de docs/tickets/ qui nomme la clé', () => {
  it('le fichier dont le nom contient la clé', () => {
    expect(findNote(['README.md', 'docs/tickets/feat/G2-6675-add-picker.md'], 'G2-6675')).toBe('docs/tickets/feat/G2-6675-add-picker.md');
  });

  it('sans tenir compte de la casse', () => {
    expect(findNote(['docs/tickets/feat/g2-6675-x.md'], 'G2-6675')).toBe('docs/tickets/feat/g2-6675-x.md');
  });

  it('en mot entier : g2-66751 n\'est pas g2-6675', () => {
    expect(findNote(['docs/tickets/feat/g2-66751-x.md'], 'G2-6675')).toBeNull();
  });

  it('en mot entier : 10.8.0 n\'est pas 0.8.0', () => {
    expect(findNote(['docs/tickets/feat/10.8.0-x.md', 'docs/tickets/feat/0.8.0-vibecoder.md'], '0.8.0')).toBe('docs/tickets/feat/0.8.0-vibecoder.md');
  });

  it('seulement un .md sous docs/tickets/', () => {
    expect(findNote(['notes/G2-6675.md', 'docs/tickets/feat/G2-6675.txt'], 'G2-6675')).toBeNull();
  });

  it('plusieurs : le premier dans l\'ordre des chemins', () => {
    expect(findNote(['docs/tickets/refactor/0.7.0-processus.md', 'docs/tickets/feat/0.7.0-taches.md'], '0.7.0')).toBe('docs/tickets/feat/0.7.0-taches.md');
  });
});
