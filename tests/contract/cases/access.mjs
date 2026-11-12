// Les cas de l'accès et de la CLI seule (les vérifications d'avant ce ticket,
// reprises) : réglage « agents extérieurs » désactivé (refus, code 1, en moins
// d'une seconde, pas de jeton dans live.json) — offAccess, sur l'appli lancée
// réglage désactivé ; puis access : status et next depuis le projet, commands
// et schema (de la CLI, hors de la table), un dossier sans robot (refus), une
// commande inconnue (unknown-command), et la porte du robot, seulement sur ce
// qu'elle seule change (son environnement, sans live.json).
// Ne connaît pas : l'état interne de l'appli.
// Utilisé par : tests/contract/run.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { asJson, check, cli, said } from '../bench.mjs';


/** @param {import('../bench.mjs').App} app lancée avec { outsideAgents: false } */
export async function offAccess(app) {
  const status = await cli(['status'], app.projet);
  check(null, 'réglage désactivé : refusé, code 1, en moins d\'une seconde', status.code === 1 && status.ms < 1000 && /Outside agents are off/.test(status.err), `${said(status)} ${status.ms} ms`);
  const runs = await cli(['run', 'list'], app.projet);
  check(null, 'réglage désactivé : toute commande de l\'appli est refusée de même', runs.code === 1 && /Outside agents are off/.test(runs.err), said(runs));
  // le seul fichier lu : live.json, la porte publique de la CLI
  const live = JSON.parse(fs.readFileSync(path.join(app.data, 'live.json'), 'utf8'));
  check(null, 'réglage désactivé : pas de jeton dans live.json', !('token' in live), JSON.stringify(Object.keys(live)));
  const commands = await cli(['commands'], app.projet);
  check(null, 'réglage désactivé : commands se lit quand même (la table, sans l\'appli)', commands.code === 0 && /^run\.start /m.test(commands.out), said(commands));
}

/** @param {import('../bench.mjs').App} app @param {string} away un dossier sans robot */
export async function access(app, away) {
  const here = app.projet;

  // la porte extérieure, depuis le projet
  const status = await asJson(['status'], here);
  check('status', 'depuis le projet', status.code === 0 && status.json?.ok === true && status.json.result?.branch === 'feat/0.9.0-essai', said(status));
  const next = await asJson(['next'], here);
  check('next', 'depuis le projet', next.code === 0 && next.json?.ok === true && Array.isArray(next.json.result?.proposed), said(next));

  // commands et schema : lus dans la table, l'appli n'est pas appelée
  const commands = await cli(['commands'], here);
  check(null, 'commands : la table, une ligne par commande', commands.code === 0 && /^run\.start /m.test(commands.out) && /^status /m.test(commands.out), said(commands));
  const commandsJson = await asJson(['commands'], here);
  check(null, 'commands --json : la liste des commandes', commandsJson.code === 0 && Array.isArray(commandsJson.json) && commandsJson.json.some((c) => c.name === 'run.start'), said(commandsJson));
  const schema = await asJson(['schema', 'run.start'], here);
  check(null, 'schema run.start : l\'entrée de la table', schema.code === 0 && schema.json?.name === 'run.start' && schema.json.args?.required?.includes('action'), said(schema));
  const schemaUnknown = await cli(['schema', 'inconnue'], here);
  check(null, 'schema d\'une commande inconnue : refus, code 1', schemaUnknown.code === 1 && /Unknown command/.test(schemaUnknown.err), said(schemaUnknown));
  const bare = await cli([], here);
  check(null, 'sans commande : l\'usage, code 2', bare.code === 2 && /usage/.test(bare.err), said(bare));
  const badRun = await cli(['run', 'inconnu'], here);
  check(null, 'run d\'une sous-commande inconnue : l\'usage, code 2', badRun.code === 2, said(badRun));

  // un dossier sans robot
  const lost = await asJson(['status'], away);
  check('status', 'd\'un dossier sans robot : refus, code 1, en moins d\'une seconde', lost.code === 1 && lost.ms < 1000 && lost.json?.error?.code === 'no-survey', `${said(lost)} ${lost.ms} ms`, 'no-survey');

  // une commande inconnue
  const unknown = await asJson(['commande-inconnue'], here);
  check(null, 'commande inconnue : refus, code 1', unknown.code === 1 && unknown.json?.error?.code === 'unknown-command', said(unknown), 'unknown-command');

  // fermées aux agents : refus avant tout argument ou relevé
  for (const name of ['run.allow', 'run.always', 'run.deny']) {
    const closed = await asJson([name, 'action=forme'], here);
    check(name, 'fermé aux agents : closed, code 1', closed.code === 1 && closed.json?.error?.code === 'closed', said(closed), 'closed');
  }

  // la porte du robot : son environnement. Le premier tour du faux Claude Code écrit la note (port, jeton) :
  // une course tenue (forme) le déclenche, la fin attendue pour laisser l'appli sans course.
  const start = await asJson(['run', 'start', 'forme'], here);
  check(null, 'une course lance le faux Claude Code, qui écrit la note du robot', start.code === 0 && start.json?.ok === true, said(start));
  const robot = await asJson(['status'], here, 'robot');
  check('status', 'porte du robot : par son environnement, sans live.json', robot.code === 0 && robot.json?.ok === true && robot.json.result?.branch === 'feat/0.9.0-essai', said(robot));
  // un robot est un robot : le sien, d'où qu'il appelle (l'extérieur, lui, n'a de robot que sur son dossier)
  const robotAway = await asJson(['status'], away, 'robot');
  check('status', 'porte du robot : d\'un dossier sans robot, c\'est quand même le sien', robotAway.code === 0 && robotAway.json?.result?.branch === 'feat/0.9.0-essai', said(robotAway));
  const robotClosed = await asJson(['run.allow', 'action=forme'], here, 'robot');
  check('run.allow', 'porte du robot : fermé aussi, closed, code 1', robotClosed.code === 1 && robotClosed.json?.error?.code === 'closed', said(robotClosed), 'closed');
  const wait = await asJson(['run', 'wait', 'forme'], here);
  check(null, 'la course est finie avant la famille suivante', wait.code === 0 && wait.json?.result?.state === 'done', said(wait));
}
