// Variantes de caller : sur quel robot agit un appelant, et par quelle porte ; l'environnement d'un robot.
import { describe, expect, it } from 'vitest';
import { callerRobot, robotAt, robotEnv } from 'core/commands';

const robots = [{ id: 'a1', dir: '/p' }, { id: 'a2', dir: '/p2' }, { id: 'a3', dir: '/p' }];

describe('robotAt', () => {
  it('l’affiché sur ce dossier passe avant le premier', () => {
    expect(robotAt('/p', robots, 'a3')).toBe('a3');
    expect(robotAt('/p', robots, null)).toBe('a1');
  });
  it('l’affiché ailleurs ne compte pas : le premier du dossier', () => {
    expect(robotAt('/p', robots, 'a2')).toBe('a1');
  });
  it('un sous-dossier compte', () => {
    expect(robotAt('/p/sous/dossier', robots, null)).toBe('a1');
  });
  it('/p2 n’est pas sous /p', () => {
    expect(robotAt('/p2', [{ id: 'a1', dir: '/p' }], null)).toBeNull();
    expect(robotAt('/p2/x', robots, null)).toBe('a2');
  });
  it('aucun robot ici : null', () => {
    expect(robotAt('/autre', robots, 'a1')).toBeNull();
    expect(robotAt('/p', [], null)).toBeNull();
  });
});

describe('callerRobot', () => {
  it('screen : le robot du dossier, porte écran', () => {
    expect(callerRobot('screen', '/p2/x', robots, 'a1', false)).toEqual({ robot: 'a2', door: 'screen' });
  });
  it('outside, réglage activé : le robot du dossier, porte agent', () => {
    expect(callerRobot('outside', '/p2', robots, 'a1', true)).toEqual({ robot: 'a2', door: 'agent' });
  });
  it('outside, aucun robot ici : robot null', () => {
    expect(callerRobot('outside', '/autre', robots, 'a1', true)).toEqual({ robot: null, door: 'agent' });
  });
  it('outside, réglage désactivé : null', () => {
    expect(callerRobot('outside', '/p', robots, 'a1', false)).toBeNull();
  });
  it('un robot : lui, même si target désigne un autre robot', () => {
    expect(callerRobot('a2', '/p', robots, 'a1', false)).toEqual({ robot: 'a2', door: 'agent' });
  });
  it('un robot retiré : null', () => {
    expect(callerRobot('a9', '/p', robots, 'a1', true)).toBeNull();
  });
});

describe('robotEnv', () => {
  it('garde la base, ajoute les deux variables, ne modifie pas la base', () => {
    const base = { PATH: '/bin', GONE: undefined };
    const env = robotEnv(base, 4242, 'tok');
    expect(env).toEqual({ PATH: '/bin', GONE: undefined, VIBECODER_PORT: '4242', VIBECODER_TOKEN: 'tok' });
    expect(base).toEqual({ PATH: '/bin', GONE: undefined });
  });
});
