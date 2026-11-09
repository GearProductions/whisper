#!/usr/bin/env node
// vibecoder — la commande : lit sa ligne (parseCommandLine) ; commands et
// schema lus dans ../../commands.json, sans l'appli ; sinon callFrom, une
// enveloppe (target : le chemin réel du dossier courant), une connexion
// node:net à 127.0.0.1, la première ligne reçue, render, exitCode. Jamais de
// question ; aucun shell.
// Ne connaît pas : TypeScript, l'appli hors de son socket et de sa table.
// Utilisé par : l'agent principal et ses courses (par son chemin dans le
// plugin), un terminal (le lien de ~/.local/bin) ; test:contract,
// tests/invariants/cli-robot-env.test.ts.
// Squelette (invariants rouges) : le module vient à l'étape des modules.

throw new Error('not implemented');
