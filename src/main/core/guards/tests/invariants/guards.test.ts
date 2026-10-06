// Invariants de ce que les pages peuvent obtenir du système. Protégés : si un
// test échoue, corriger le code.
//   I-9  : le micro seulement, en audio seul, et seulement pour nos pages (file://).
//   I-21 : un lien ne s'ouvre que s'il est en http(s) ; un fichier joint est
//          montré (jamais ouvert), et seulement un chemin absolu existant.
import { describe, expect, it } from 'vitest';
import { allowPermission, allowPermissionCheck, showableFile, webUrl } from 'core/guards';

describe('permissions des pages (I-9)', () => {
  it.each([
    ['media', 'file:///app/index.html', ['audio'], true],
    ['media', 'file:///app/index.html', ['audio', 'video'], false],
    ['media', 'file:///app/index.html', ['video'], false],
    ['media', 'file:///app/index.html', [], false],
    ['media', 'https://example.com/', ['audio'], false],
    ['media', undefined, ['audio'], false],
    ['notifications', 'file:///app/index.html', [], false],
    ['geolocation', 'file:///app/index.html', [], false],
    ['clipboard-read', 'file:///app/index.html', [], false],
  ] as const)('%s %s %j → %s', (permission, url, types, expected) => {
    expect(allowPermission(permission, url, [...types])).toBe(expected);
  });

  it.each([
    ['media', 'file:///x', 'audio', true],
    ['media', 'file:///x', 'video', false],
    ['media', 'https://x', 'audio', false],
    ['notifications', 'file:///x', 'audio', false],
  ] as const)('vérification %s %s %s → %s', (permission, origin, type, expected) => {
    expect(allowPermissionCheck(permission, origin, type)).toBe(expected);
  });
});

describe('liens (I-21)', () => {
  it.each(['https://github.com/x', 'http://localhost:3000/a?b=c'])('%s : ouvert', (url) => {
    expect(webUrl(url)).toBe(new URL(url).href);
  });
  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'vscode://x', 'smb://nas/x', '', 'pas une adresse', 42, null])(
    '%s : refusé', (url) => { expect(webUrl(url)).toBeNull(); },
  );
});

describe('fichiers joints montrés (I-21)', () => {
  const exists = (p: string) => p === '/home/u/a.txt';
  it.each([
    ['/home/u/a.txt', true],
    ['/home/u/absent.txt', false],
    ['a.txt', false],
    ['../a.txt', false],
    [42, false],
    [undefined, false],
  ] as const)('%s → %s', (file, expected) => {
    expect(showableFile(file, exists)).toBe(expected);
  });
});
