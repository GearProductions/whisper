// Invariant (SPEC I-21, côté page) : seule une adresse http(s) devient un
// lien ; aucune autre (javascript:, file:, data:…), même en syntaxe Markdown.
// Protégé : si ce test échoue, corriger le code.
import { describe, expect, it } from 'vitest';
import { splitLinks } from '../../links';

const urls = (text: string) => splitLinks(text).filter((s) => s.url).map((s) => s.url);

describe('liens d’un message', () => {
  it.each([
    'javascript:alert(1)',
    '[clic](javascript:alert(1))',
    'file:///etc/passwd',
    '[fichier](file:///home/x/script.sh)',
    'data:text/html,<script>alert(1)</script>',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    'vbscript:msgbox',
    'ftp://example.com/x',
    '[x](//evil.example)',
  ])('%s ne devient pas un lien', (text) => {
    expect(urls(text)).toEqual([]);
  });

  it('tout lien produit est une adresse http(s)', () => {
    const text = 'voir https://a.example/x, [doc](http://b.example/y) et javascript:void(0) puis [z](javascript:x)';
    const found = urls(text);
    expect(found.length).toBeGreaterThan(0);
    for (const u of found) expect(u).toMatch(/^https?:\/\//);
  });

  it('le texte n’est jamais perdu', () => {
    const text = 'avant https://a.example/x après';
    expect(splitLinks(text).map((s) => s.text).join('')).toBe(text);
  });
});
