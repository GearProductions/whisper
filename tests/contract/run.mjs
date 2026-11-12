// Banc du contrat, vu de l'extérieur : la version courante seule, sur l'appli
// réelle (bench.mjs), la commande vibecoder appelée comme un agent. Dans cet
// ordre : la corbeille du banc vérifiée (trash.mjs) ; l'appli réglage
// « agents extérieurs » désactivé (cases/access offAccess) ; puis activé, les
// familles de cases/, une par fichier (access, reads, runs, procs, git, gh,
// artifacts, review, conversation) ; enfin le résumé (coverage.mjs) : n
// commandes couvertes sur celles de la table, chaque commande sans cas nommée,
// les codes d'erreur non couverts. Un cas en échec ou une commande sans cas :
// code de sortie 1. Une famille qui lève une exception ne l'arrête pas : un cas
// en échec, et la suivante passe.
//
//   npm run test:contract        (lancé à la main, hors de npm test)
//
// Tout vit dans un profil temporaire (XDG_CONFIG_HOME, XDG_DATA_HOME), sous
// ~/.cache/whisper-contract (le système de fichiers du home : la corbeille) ; le
// ~/.config et la corbeille de l'utilisateur ne sont jamais touchés, GitHub
// jamais joint. Une fenêtre s'ouvre brièvement. Il faut `npm run build` avant.
// Ne connaît pas : le détail des cas (cases/), l'état interne de l'appli.
// Utilisé par : package.json (test:contract).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, startApp, tally } from './bench.mjs';
import { access, offAccess } from './cases/access.mjs';
import { artifacts } from './cases/artifacts.mjs';
import { conversation } from './cases/conversation.mjs';
import { ghActions } from './cases/gh.mjs';
import { gitActions } from './cases/git.mjs';
import { procs } from './cases/procs.mjs';
import { reads } from './cases/reads.mjs';
import { review } from './cases/review.mjs';
import { runs } from './cases/runs.mjs';
import { coverage } from './coverage.mjs';
import { trashLanding } from './trash.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
if (!fs.existsSync(path.join(ROOT, 'out/main/index.js'))) { console.error('npm run build d\'abord'); process.exit(2); }

const t0 = Date.now();
// Les profils temporaires (le banc, launch.mjs : os.tmpdir) sur le système de fichiers du home, pas sur /tmp
// (tmpfs) : gio n'y met rien à la corbeille, celle du banc (XDG_DATA_HOME) ne pourrait pas être vérifiée.
const scratch = path.join(os.homedir(), '.cache', 'whisper-contract');
fs.mkdirSync(scratch, { recursive: true });
process.env.TMPDIR = scratch;
const tmp = (what) => fs.mkdtempSync(path.join(os.tmpdir(), `whisper-contract-${what}-`));

// La corbeille du banc : Electron y met-il le témoin, et pas dans celle de l'utilisateur ?
let trashSafe = false;
const trashDir = tmp('trash');
try {
  const { isolated, where } = await trashLanding(trashDir);
  trashSafe = isolated;
  console.log(`corbeille du banc : ${isolated ? 'isolée' : 'PAS isolée (les cas de corbeille sont sautés)'} — ${where}`);
} catch (e) {
  console.log(`corbeille du banc : non vérifiée (les cas de corbeille sont sautés) — ${e.message}`);
} finally {
  fs.rmSync(trashDir, { recursive: true, force: true });
}

// Une famille sur une appli : son exception est un cas en échec, le banc continue.
const family = async (name, run) => {
  try { await run(); } catch (e) { check(null, `${name} : exception`, false, e.stack); }
};

// Réglage désactivé : la commande refuse.
try {
  const off = await startApp({ name: 'contract-off', port: 9363, config: { outsideAgents: false } });
  try { await family('offAccess', () => offAccess(off)); } finally { await off.dispose(); }
} catch (e) { check(null, 'appli réglage désactivé : exception', false, e.stack); }

// Réglage activé, le faux Claude Code pour agent.
const away = tmp('away');
try {
  const app = await startApp({ name: 'contract', port: 9364 });
  try {
    for (const [name, run] of [
      ['access', () => access(app, away)],
      ['reads', () => reads(app)],
      ['runs', () => runs(app)],
      ['procs', () => procs(app)],
      ['gitActions', () => gitActions(app)],
      ['ghActions', () => ghActions(app)],
      ['artifacts', () => artifacts(app, trashSafe)],
      ['review', () => review(app)],
      ['conversation', () => conversation(app)],
    ]) await family(name, run);
  } finally { await app.dispose(); }
} catch (e) { check(null, 'appli réglage activé : exception', false, e.stack); }
finally { fs.rmSync(away, { recursive: true, force: true }); }

// Le résumé : la table contre ce que les cas ont couvert.
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources/vibecoder/commands.json'), 'utf8'));
const { covered, codes, failed } = tally();
const { lines, missing } = coverage(table, { covered, codes });
console.log(`\n${lines.join('\n')}`);
console.log(`\nDurée : ${Math.round((Date.now() - t0) / 1000)} s`);
try { fs.rmdirSync(scratch); } catch { /* pas vide : un profil resté, à voir */ }
const bad = failed > 0 || missing.length > 0;
console.log(failed ? `${failed} vérification(s) en échec.` : missing.length ? `${missing.length} commande(s) sans cas.` : 'Contrat tenu.');
process.exit(bad ? 1 : 0);
