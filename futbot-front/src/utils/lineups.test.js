import { describe, expect, it } from 'vitest';
import { lineupsToPlayers } from './lineups';

const p = (playerId, name, role) => ({ playerId, name, role });

describe('lineupsToPlayers', () => {
  it('arma el mapa playerId -> { name, role, club }', () => {
    const players = lineupsToPlayers({
      club1: [p(1, 'Messi', 'forward')],
      club2: [p(4, 'Lautaro', 'defense')],
    });

    expect(players).toEqual({
      1: { name: 'Messi', role: 'forward', club: 1 },
      4: { name: 'Lautaro', role: 'defense', club: 2 },
    });
  });

  it('tolera club2 null y respuestas vacías', () => {
    expect(lineupsToPlayers({ club1: [p(1, 'Messi', 'forward')], club2: null })).toEqual({
      1: { name: 'Messi', role: 'forward', club: 1 },
    });
    expect(lineupsToPlayers(undefined)).toEqual({});
  });
});