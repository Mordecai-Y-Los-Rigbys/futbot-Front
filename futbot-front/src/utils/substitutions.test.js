import { describe, expect, it } from 'vitest';
import { canRequestSubstitution, splitTeam } from './substitutions';

const meta = (phase, pausesLeft) => ({ phase, pausesLeft });

describe('canRequestSubstitution', () => {
  it('habilita a un jugador en juego con pausas por delante', () => {
    expect(canRequestSubstitution('player', meta('playing', 3))).toBe(true);
    expect(canRequestSubstitution('player', meta('playing', 1))).toBe(true);
  });

  it('habilita durante una pausa que no es la última (el pedido queda para la siguiente)', () => {
    expect(canRequestSubstitution('player', meta('paused', 2))).toBe(true);
  });

  it('habilita en la cuenta regresiva de los períodos 2 a 4 si quedan pausas', () => {
    expect(canRequestSubstitution('player', meta('countdown', 2))).toBe(true);
    expect(canRequestSubstitution('player', meta('countdown', 1))).toBe(true);
  });

  it('no habilita a un espectador ni sin rol todavía', () => {
    expect(canRequestSubstitution('spectator', meta('playing', 3))).toBe(false);
    expect(canRequestSubstitution(null, meta('playing', 3))).toBe(false);
  });

  it('no habilita sin ticks (esperando rival)', () => {
    expect(canRequestSubstitution('player', { phase: null, pausesLeft: null })).toBe(false);
    expect(canRequestSubstitution('player', { phase: null, pausesLeft: 3 })).toBe(false);
  });

  it('no habilita en la cuenta regresiva inicial (countdown con pausesLeft 3)', () => {
    expect(canRequestSubstitution('player', meta('countdown', 3))).toBe(false);
  });

  it.each([
    ['3.ª pausa', 'paused'],
    ['período 4', 'playing'],
    ['cuenta del período 4', 'countdown'],
    ['tanda de penales', 'penalties'],
    ['finished', 'finished'],
  ])('no habilita con pausesLeft 0 (%s)', (_label, phase) => {
    expect(canRequestSubstitution('player', meta(phase, 0))).toBe(false);
  });

  it('un tick sin pausesLeft no habilita', () => {
    expect(canRequestSubstitution('player', meta('playing', null))).toBe(false);
  });
});

describe('splitTeam', () => {
  it('separa titulares (forward, midfield, defense) de suplentes', () => {
    const members = [
      { playerId: 1, name: 'A', role: 'forward' },
      { playerId: 2, name: 'B', role: 'midfield' },
      { playerId: 3, name: 'C', role: 'defense' },
      { playerId: 4, name: 'D', role: 'substitute' },
    ];
    const { starters, substitutes } = splitTeam({ members });
    expect(starters.map((m) => m.playerId)).toEqual([1, 2, 3]);
    expect(substitutes.map((m) => m.playerId)).toEqual([4]);
  });

  it('una respuesta sin members da listas vacías', () => {
    expect(splitTeam(null)).toEqual({ starters: [], substitutes: [] });
  });
});
