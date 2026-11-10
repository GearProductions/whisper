// Le protocole d'une ligne : ce que readLine rend, refuse ou ferme, et ce que writeLine écrit.
import { describe, expect, it } from 'vitest';
import { BAD_TOKEN, LINE_MAX, readLine, writeLine } from 'technicals/socket';

const TOKEN = 'a'.repeat(64);
const TOKENS = new Map([['screen', TOKEN]]);
const line = (o: object) => JSON.stringify(o);
const ENV = { cmd: 'list-agents', args: { a: 1 }, token: TOKEN, target: 'vibecoder' };

describe('readLine', () => {
  it('une enveloppe complète : rendue telle quelle', () => {
    expect(readLine(line(ENV), TOKENS)).toEqual({ envelope: ENV, caller: 'screen' });
  });

  it('une enveloppe sans args : rendue', () => {
    const { args: _args, ...sans } = ENV;
    expect(readLine(line(sans), TOKENS)).toEqual({ envelope: sans, caller: 'screen' });
  });

  it('un mauvais jeton, de même longueur ou non : refuse BAD_TOKEN', () => {
    expect(readLine(line({ ...ENV, token: 'b'.repeat(64) }), TOKENS)).toEqual({ refuse: BAD_TOKEN });
    expect(readLine(line({ ...ENV, token: 'b' }), TOKENS)).toEqual({ refuse: BAD_TOKEN });
  });

  it('un jeton absent ou pas une chaîne : refuse BAD_TOKEN', () => {
    const { token: _t, ...sans } = ENV;
    expect(readLine(line(sans), TOKENS)).toEqual({ refuse: BAD_TOKEN });
    expect(readLine(line({ ...ENV, token: 42 }), TOKENS)).toEqual({ refuse: BAD_TOKEN });
  });

  it('plusieurs jetons : celui de la table rend son caller ; un jeton absent ou une table vide : BAD_TOKEN', () => {
    const robot = 'r'.repeat(64);
    const table = new Map([['screen', TOKEN], ['robot-1', robot]]);
    expect(readLine(line({ ...ENV, token: robot }), table)).toEqual({ envelope: { ...ENV, token: robot }, caller: 'robot-1' });
    expect(readLine(line(ENV), table)).toEqual({ envelope: ENV, caller: 'screen' });
    expect(readLine(line({ ...ENV, token: 'z'.repeat(64) }), table)).toEqual({ refuse: BAD_TOKEN });
    expect(readLine(line(ENV), new Map())).toEqual({ refuse: BAD_TOKEN });
  });

  it('BAD_TOKEN : code bad-token, message et todo en anglais', () => {
    expect(BAD_TOKEN).toMatchObject({ ok: false, error: { code: 'bad-token', details: {} } });
    expect(BAD_TOKEN.error.message).toMatch(/token/i);
    expect(BAD_TOKEN.error.todo).toBeTruthy();
  });

  it.each([
    ['pas du JSON', 'pas du json'],
    ['un tableau', '[1,2]'],
    ['null', 'null'],
    ['une requête HTTP', 'GET / HTTP/1.1'],
    ['une ligne vide', ''],
  ])('%s : close', (_n, l) => {
    expect(readLine(l, TOKENS)).toEqual({ close: true });
  });

  it('cmd absent, target absent, cmd ou target pas une chaîne : close', () => {
    const { cmd: _c, ...sansCmd } = ENV;
    const { target: _t, ...sansTarget } = ENV;
    expect(readLine(line(sansCmd), TOKENS)).toEqual({ close: true });
    expect(readLine(line(sansTarget), TOKENS)).toEqual({ close: true });
    expect(readLine(line({ ...ENV, cmd: 1 }), TOKENS)).toEqual({ close: true });
    expect(readLine(line({ ...ENV, target: null }), TOKENS)).toEqual({ close: true });
  });

  it('une clé inconnue : close, avant même le jeton', () => {
    expect(readLine(line({ ...ENV, extra: 1 }), TOKENS)).toEqual({ close: true });
    expect(readLine(line({ ...ENV, extra: 1, token: 'faux' }), TOKENS)).toEqual({ close: true });
  });

  it('une ligne au-delà de LINE_MAX : close ; à LINE_MAX, lue', () => {
    expect(readLine('x'.repeat(LINE_MAX + 1), TOKENS)).toEqual({ close: true });
    const fill = 'y'.repeat(LINE_MAX - line({ ...ENV, args: '' }).length);
    expect('envelope' in readLine(line({ ...ENV, args: fill }), TOKENS)).toBe(true);
  });
});

describe('writeLine', () => {
  it('une seule ligne, terminée par \\n, même si la valeur contient des sauts de ligne', () => {
    const out = writeLine({ ok: true, text: 'a\nb' });
    expect(out.endsWith('\n')).toBe(true);
    expect(out.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(out)).toEqual({ ok: true, text: 'a\nb' });
  });
});
