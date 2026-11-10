#!/usr/bin/env node
// vibecoder — la commande : lit sa ligne (parseCommandLine) ; commands et
// schema lus dans ../../commands.json (la table copiée avec le plugin), sans
// l'appli ; sinon callFrom, une enveloppe (target : le chemin réel du dossier
// courant), une connexion node:net à 127.0.0.1, la première ligne reçue,
// render, exitCode. Jamais de question ; aucun shell. Usage : code 2 ; appli
// injoignable ou refus : code 1.
// Ne connaît pas : TypeScript, l'appli hors de son socket et de sa table.
// Utilisé par : l'agent principal et ses courses (par son chemin dans le
// plugin), un terminal (le lien de ~/.local/bin) ; test:contract,
// tests/invariants/cli-robot-env.test.ts.

import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { callFrom, exitCode, livePath, parseCommandLine, render } from './cli.mjs';

const fail = (text, code = 1) => { process.stderr.write(`${text}\n`); process.exitCode = code; };

// node suit le lien de ~/.local/bin pour le script lancé : import.meta.url est son vrai chemin.
const table = () => JSON.parse(fs.readFileSync(new URL('../../commands.json', import.meta.url), 'utf8'));

const local = ({ local: what, name, json }) => {
  const { commands } = table();
  if (what === 'commands') {
    const list = commands.map((c) => ({ name: c.name, description: c.description }));
    // le texte : une ligne par commande, la première phrase de sa description
    console.log(json ? JSON.stringify(list) : list.map((c) => `${c.name}  ${c.description.split(/(?<=\.)\s/)[0]}`).join('\n'));
    return;
  }
  const entry = commands.find((c) => c.name === name);
  if (!entry) return fail(`Unknown command "${name}". Try: vibecoder commands`);
  console.log(JSON.stringify(entry, null, json ? undefined : 2));
};

// Une enveloppe, la première ligne de la réponse.
const call = ({ port, token }, cmd, args, cwd) => new Promise((resolve, reject) => {
  const sock = net.connect(port, '127.0.0.1');
  let buffer = '';
  let done = false;
  sock.on('connect', () => sock.write(`${JSON.stringify({ cmd, args, token, target: cwd })}\n`));
  sock.on('data', (d) => {
    buffer += d.toString();
    const end = buffer.indexOf('\n');
    if (end < 0 || done) return;
    done = true;
    sock.destroy();
    try { resolve(JSON.parse(buffer.slice(0, end))); } catch { reject(new Error('The app answered something that is not JSON.')); }
  });
  sock.on('error', (err) => { done = true; reject(err); });
  sock.on('close', () => { if (!done) reject(new Error('The app closed the connection without an answer.')); });
});

const parsed = parseCommandLine(process.argv.slice(2));
if (parsed.usage) fail(parsed.usage, 2);
else if (parsed.local) local(parsed);
else {
  const readLiveFile = () => { try { return fs.readFileSync(livePath(process.env, process.platform, os.homedir()), 'utf8'); } catch { return null; } };
  const target = callFrom(process.env, readLiveFile);
  if (target.error) fail(target.error);
  else {
    try {
      const answer = await call(target, parsed.cmd, parsed.args, fs.realpathSync.native(process.cwd()));
      console.log(render(answer, parsed.json));
      process.exitCode = exitCode(answer);
    } catch (err) {
      fail(`VibeCoder is not reachable (${err.message}).`);
    }
  }
}
