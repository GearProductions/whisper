// Invariants du socket TCP (note 0.15.0,
// docs/tickets/feat/0.15.0-socket-interface.md, « Ce que ça ne doit pas
// faire ») :
//   - écouter ailleurs que sur 127.0.0.1 ;
//   - accepter une commande sans le bon jeton (un jeton tiré à chaque
//     lancement) ;
//   - garder ouverte une connexion qui a reçu une ligne qui n'est pas une
//     commande (cela bloque les requêtes d'un navigateur vers localhost).
// Le jeton ni sur le disque ni vers la page, live.json :
// app/controllers/tests/invariants/socket-token.test.ts et
// app/tests/invariants/live-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai serveur (listen) et de vraies connexions TCP (node:net) ; le
// gestionnaire (handle) relève chaque enveloppe qu'il reçoit : une commande
// acceptée se voit.
import net from 'node:net';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LINE_MAX, listen } from 'technicals/socket';
import { slow } from '../../../../app/controllers/tests/slow';

const ANSWER = { ok: true, result: 'fait' };
const TARGET = '/home/moi/projet';
const servers: { close(): Promise<void> }[] = [];

// Un serveur qui écoute, et le gestionnaire qui relève les commandes acceptées.
async function serve() {
  const handle = vi.fn(async () => ANSWER);
  const server = await listen(handle);
  servers.push(server);
  return { ...server, handle };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => s.close())); });

// Une ligne d'enveloppe, telle qu'un client l'écrit.
const line = (env: object) => `${JSON.stringify(env)}\n`;
const command = (token: unknown) => line({ cmd: 'status', args: {}, token, target: TARGET });

// Écrit sur une connexion à 127.0.0.1:port, puis lit jusqu'à ce que le serveur
// la ferme ou qu'un délai passe : ce qu'il a répondu, et s'il l'a fermée.
function exchange(port: number, text: string) {
  return new Promise<{ received: string; closed: boolean }>((done) => {
    let received = '';
    const sock = net.connect(port, '127.0.0.1', () => { sock.write(text); });
    const timer = setTimeout(() => { sock.destroy(); done({ received, closed: false }); }, slow(500));
    sock.on('data', (d) => { received += d.toString(); });
    sock.on('error', () => {});
    sock.on('close', () => { clearTimeout(timer); done({ received, closed: true }); });
  });
}
// La première réponse reçue, lue comme JSON.
const firstAnswer = (received: string) => JSON.parse(received.split('\n')[0]);

// Se connecter à host:port réussit-il ?
function reachable(host: string, port: number) {
  return new Promise<boolean>((done) => {
    const sock = net.connect({ host, port });
    const timer = setTimeout(() => { sock.destroy(); done(false); }, slow(1000));
    sock.on('connect', () => { clearTimeout(timer); sock.destroy(); done(true); });
    sock.on('error', () => { clearTimeout(timer); done(false); });
  });
}
// Une adresse IPv4 de la machine sur le réseau (pas la boucle locale), s'il y en a une.
const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

describe('le socket n’écoute que sur 127.0.0.1', () => {
  it('témoin : joignable sur 127.0.0.1', async () => {
    const { port } = await serve();

    // la connexion locale aboutit : les refus ci-dessous viennent bien de l'adresse
    expect(await reachable('127.0.0.1', port)).toBe(true);
  });

  // Une autre machine du réseau joindrait l'appli par cette adresse.
  it.skipIf(!lan)('injoignable sur l’adresse de la machine dans le réseau', async () => {
    const { port } = await serve();

    // la connexion par l'adresse du réseau est refusée
    expect(await reachable(lan!, port)).toBe(false);
  });

  // localhost peut désigner ::1 : un serveur sur toutes les adresses y répondrait.
  it('injoignable sur la boucle locale IPv6 (::1)', async () => {
    const { port } = await serve();

    // la connexion par ::1 est refusée
    expect(await reachable('::1', port)).toBe(false);
  });

  // Sous Linux, toute 127.x.x.x mène à la machine : seul 0.0.0.0 y répondrait.
  it.skipIf(process.platform !== 'linux')('injoignable sur une autre adresse de la boucle locale (127.0.0.2)', async () => {
    const { port } = await serve();

    // la connexion par 127.0.0.2 est refusée
    expect(await reachable('127.0.0.2', port)).toBe(false);
  });
});

describe('aucune commande acceptée sans le bon jeton', () => {
  it('témoin : avec le jeton du serveur, la commande atteint le gestionnaire', async () => {
    const { port, token, handle } = await serve();

    const { received } = await exchange(port, command(token));

    // le gestionnaire a reçu la commande
    expect(handle).toHaveBeenCalledTimes(1);
    // sa réponse revient au client
    expect(firstAnswer(received)).toEqual(ANSWER);
  });

  it('un mauvais jeton : refusée, le gestionnaire jamais appelé', async () => {
    const { port, handle } = await serve();

    const { received } = await exchange(port, command('0'.repeat(64)));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
    // la réponse est un refus
    expect(firstAnswer(received).ok).toBe(false);
  });

  it('sans jeton : refusée ou connexion fermée, le gestionnaire jamais appelé', async () => {
    const { port, handle } = await serve();

    await exchange(port, line({ cmd: 'status', args: {}, target: TARGET }));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  // Une comparaison qui s'arrêterait à la longueur de l'un des deux.
  it('un jeton vide : le gestionnaire jamais appelé', async () => {
    const { port, handle } = await serve();

    await exchange(port, command(''));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  it('le début du bon jeton : le gestionnaire jamais appelé', async () => {
    const { port, token, handle } = await serve();

    await exchange(port, command(token.slice(0, -1)));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  it('le bon jeton suivi d’un caractère : le gestionnaire jamais appelé', async () => {
    const { port, token, handle } = await serve();

    await exchange(port, command(`${token}0`));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  // Une comparaison qui ignorerait la casse.
  it('le bon jeton en majuscules : le gestionnaire jamais appelé', async () => {
    const { port, token, handle } = await serve();
    // témoin : le jeton a bien des lettres, sa version en majuscules en diffère
    expect(token.toUpperCase()).not.toBe(token);

    await exchange(port, command(token.toUpperCase()));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  // Un tableau qui le contient serait égal au jeton pour une comparaison lâche (==).
  it('le bon jeton dans un tableau : le gestionnaire jamais appelé', async () => {
    const { port, token, handle } = await serve();

    await exchange(port, command([token]));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  it('chaque lancement tire un autre jeton', async () => {
    const first = await serve();
    const second = await serve();

    // les deux jetons diffèrent
    expect(second.token).not.toBe(first.token);
  });

  // Un jeton lu un jour (un ancien lancement) n'ouvre plus la porte.
  it('le jeton d’un autre lancement : le gestionnaire jamais appelé', async () => {
    const other = await serve();
    const { port, handle } = await serve();

    await exchange(port, command(other.token));

    // la commande n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('une ligne qui n’est pas une commande ferme la connexion', () => {
  it('témoin : après une commande, la connexion reste ouverte et en sert une deuxième', async () => {
    const { port, token, handle } = await serve();

    const { closed } = await exchange(port, command(token) + command(token));

    // les deux commandes ont atteint le gestionnaire
    expect(handle).toHaveBeenCalledTimes(2);
    // le serveur n'a pas fermé la connexion
    expect(closed).toBe(false);
  });

  // Ce qu'envoie un navigateur qui visite http://localhost:<port>/ ; la commande
  // qui suit, dans le même paquet, n'est jamais lue.
  it('une requête HTTP GET : connexion fermée, rien de ce qui suit n’est traité', async () => {
    const { port, token, handle } = await serve();

    const { closed } = await exchange(port, `GET / HTTP/1.1\r\nHost: localhost\r\n\r\n${command(token)}`);

    // le serveur a fermé la connexion
    expect(closed).toBe(true);
    // la commande qui suivait n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  // Un fetch() d'une page web qui porte une enveloppe dans son corps.
  it('une requête HTTP POST avec une enveloppe en corps : connexion fermée, rien de traité', async () => {
    const { port, token, handle } = await serve();
    const body = command(token);

    const { closed } = await exchange(port, `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Type: text/plain\r\nContent-Length: ${body.length}\r\n\r\n${body}`);

    // le serveur a fermé la connexion
    expect(closed).toBe(true);
    // l'enveloppe du corps n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  it('une ligne qui n’est pas du JSON : connexion fermée', async () => {
    const { port, token, handle } = await serve();

    const { closed } = await exchange(port, `pas du json\n${command(token)}`);

    // le serveur a fermé la connexion
    expect(closed).toBe(true);
    // la commande qui suivait n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  it('un tableau JSON : connexion fermée', async () => {
    const { port, token, handle } = await serve();

    const { closed } = await exchange(port, `[1,2]\n${command(token)}`);

    // le serveur a fermé la connexion
    expect(closed).toBe(true);
    // la commande qui suivait n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  it('un objet sans cmd : connexion fermée', async () => {
    const { port, token, handle } = await serve();

    const { closed } = await exchange(port, line({ args: {}, token, target: TARGET }) + command(token));

    // le serveur a fermé la connexion
    expect(closed).toBe(true);
    // la commande qui suivait n'a pas atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });

  // Une ligne trop longue ne peut pas être une commande : le serveur n'attend pas sa fin.
  it('une ligne plus longue que LINE_MAX, sans fin de ligne : connexion fermée', async () => {
    const { port, handle } = await serve();

    const { closed } = await exchange(port, 'x'.repeat(LINE_MAX + 1));

    // le serveur a fermé la connexion sans attendre la fin de la ligne
    expect(closed).toBe(true);
    // rien n'a atteint le gestionnaire
    expect(handle).not.toHaveBeenCalled();
  });
});
