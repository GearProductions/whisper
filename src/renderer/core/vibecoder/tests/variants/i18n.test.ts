import { describe, expect, it } from 'vitest';
import { duration, fileSize, t } from 'core/vibecoder';

describe('duration', () => {
  it('secondes, minutes, heures et minutes sur deux chiffres', () => {
    expect(duration(12_400)).toBe('12 s');
    expect(duration(3 * 60_000 + 59_000)).toBe('3 min');
    expect(duration(2 * 3_600_000 + 5 * 60_000)).toBe('2 h 05');
  });

  it('une durée négative (horloge décalée) : 0 s', () => {
    expect(duration(-5000)).toBe('0 s');
  });
});

describe('fileSize', () => {
  it('octets, Ko, Mo en base 1024, dans la langue de l\'écran', () => {
    expect(fileSize(512, 'fr')).toBe('512 o');
    expect(fileSize(1536, 'fr')).toBe('1,5 Ko');
    expect(fileSize(10 * 1024 * 1024, 'en')).toBe('10 MB');
    expect(fileSize(0, 'en')).toBe('0 B');
  });
});

describe('pluriels du fil d\'Ariane et de la barre d\'état', () => {
  it('commitsOf : aucun, 1, N', () => {
    expect([0, 1, 3].map(t('fr').commitsOf)).toEqual(['aucun commit', '1 commit', '3 commits']);
    expect([0, 1, 3].map(t('en').commitsOf)).toEqual(['no commit', '1 commit', '3 commits']);
  });

  it('runsRunning : 1, N', () => {
    expect([1, 2].map(t('fr').runsRunning)).toEqual(['1 action en cours', '2 actions en cours']);
    expect([1, 2].map(t('en').runsRunning)).toEqual(['1 action running', '2 actions running']);
  });
});

describe('runProgress : l\'avancement d\'une course', () => {
  const full = { wave: 3, done: 8, total: 17, fixes: 2, opus: true };

  it('toutes les parties, dans les deux langues', () => {
    expect(t('fr').runProgress(full)).toBe('vague 3 · 8/17 modules · 2 corrections · relance Opus');
    expect(t('en').runProgress(full)).toBe('wave 3 · 8/17 modules · 2 fixes · Opus retry');
  });

  it('une partie à 0 ou fausse est absente', () => {
    expect(t('fr').runProgress({ wave: 1, done: 0, total: 5, fixes: 0, opus: false })).toBe('vague 1 · 0/5 modules');
    expect(t('fr').runProgress({ wave: 0, done: 0, total: 0, fixes: 1, opus: false })).toBe('1 correction');
    expect(t('fr').runProgress({ wave: 0, done: 0, total: 0, fixes: 0, opus: false })).toBe('');
  });

  it('les modules faits sont plafonnés au total', () => {
    expect(t('fr').runProgress({ ...full, done: 20 })).toContain('17/17 modules');
  });
});

describe('l\'arborescence des artefacts', () => {
  const problems = ['empty', 'dots', 'separator', 'hidden', 'long', 'windows', 'taken'];
  const entries = ['rename', 'trash', 'copy', 'cut', 'paste', 'duplicate', 'newFile', 'newFolder'];

  it('un motif par valeur de nameProblem et une entrée par action du menu, dans les deux langues', () => {
    for (const lang of ['fr', 'en'] as const) {
      expect(Object.keys(t(lang).nameProblem).sort()).toEqual([...problems].sort());
      expect(Object.keys(t(lang).artifactMenu).sort()).toEqual([...entries].sort());
    }
  });

  it('la confirmation : un élément nommé, n éléments comptés', () => {
    expect(t('fr').artifactConfirm(1, 'a.md')).toBe('Supprimer « a.md » ?');
    expect(t('fr').artifactConfirm(3, 'a.md')).toBe('Supprimer ces 3 éléments ?');
    expect(t('en').artifactConfirm(2, 'a.md')).toBe('Delete these 2 items?');
  });
});

describe('le sélecteur, la palette et les robots des agents', () => {
  it('le titre d\'un agent : dossier principal, worktree, PR #n', () => {
    expect((['main', 'worktree'] as const).map((k) => t('fr').agentTitle(k))).toEqual(['dossier principal', 'worktree']);
    expect(t('fr').agentTitle('pr', 42)).toBe('PR #42');
    expect(t('en').agentTitle('main')).toBe('main folder');
  });

  it('une activité par valeur d\'AgentActivity et une entrée par action de la palette, dans les deux langues', () => {
    for (const lang of ['fr', 'en'] as const) {
      expect(Object.keys(t(lang).activity).sort()).toEqual(['asking', 'done', 'failed', 'idle', 'working']);
      expect(Object.keys(t(lang).paletteActions).sort()).toEqual(['branches', 'create-branch', 'new-agent', 'stash']);
    }
  });

  it('le libellé de failed : « en échec », en français et en anglais', () => {
    expect([t('fr').activity.failed, t('en').activity.failed]).toEqual(['en échec', 'failed']);
  });

  it('tasksWatch : une tâche, plusieurs ; askAgent', () => {
    expect([1, 3].map(t('fr').tasksWatch)).toEqual(['surveille 1 tâche de fond', 'surveille 3 tâches de fond']);
    expect([1, 3].map(t('en').tasksWatch)).toEqual(['watching 1 background task', 'watching 3 background tasks']);
    expect([t('fr').askAgent, t('en').askAgent]).toEqual(['Poser une question à l\'agent', 'Ask the agent']);
  });

  it('tenue par un agent', () => {
    expect(t('fr').heldBy('Zoé')).toBe('tenue par Zoé');
  });

  it('l\'état d\'un agent : « Étape … · état », l\'état seul sans étape ; l\'aide de la palette, même nombre de touches', () => {
    expect(t('fr').agentStatus('Modules', 'travaille')).toBe('Étape Modules · travaille');
    expect(t('fr').agentStatus(null, 'au repos')).toBe('au repos');
    expect(t('en').paletteKeys).toHaveLength(t('fr').paletteKeys.length);
  });
});

describe('la page des réglages', () => {
  it('mêmes catégories, réglages, informations et commandes dans les deux langues', () => {
    for (const key of ['settingsCategory', 'settingLabel', 'settingInfo', 'settingRun', 'settingInfoValue'] as const) {
      expect(Object.keys(t('en')[key]).sort()).toEqual(Object.keys(t('fr')[key]).sort());
    }
    expect(Object.keys(t('fr').settingsCategory)).toHaveLength(6);
  });

  it('le téléchargement du modèle', () => {
    expect(t('fr').settingInfoValue.downloading(42)).toBe('téléchargement 42 %');
    expect(t('en').settingInfoValue.downloading(42)).toBe('downloading 42 %');
  });
});
