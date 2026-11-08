import { describe, expect, it } from 'vitest';
import {
  buildSlots,
  isDrawnByLot,
  penaltyPlayerInfo,
  sameCurrent,
  sameKicks,
  shootoutLabel,
  sideNumber,
  winnerLabel,
} from './penalties';

const kick = (club, round, scored, extra = {}) => ({
  club,
  kickerId: club === 'club1' ? round : 10 + round,
  kickerName: `${club}-${round}`,
  round,
  scored,
  ...extra,
});

const CURRENT = { club: 'club2', kickerId: 12, kickerName: 'Haaland', defenderId: 3, defenderName: 'Dybala' };

describe('buildSlots', () => {
  it('arma 5 casilleros vacíos por club si todavía no se pateó nada', () => {
    const slots = buildSlots([]);

    expect(slots.club1).toEqual([null, null, null, null, null]);
    expect(slots.club2).toEqual([null, null, null, null, null]);
  });

  it('cada penal ocupa el casillero de su round en la fila de su club', () => {
    const a = kick('club1', 1, true);
    const b = kick('club2', 1, false);
    const c = kick('club1', 2, true);

    const slots = buildSlots([a, b, c]);

    expect(slots.club1).toEqual([a, c, null, null, null]);
    expect(slots.club2).toEqual([b, null, null, null, null]);
  });

  it('los casilleros que no se patearon quedan vacíos (tanda cortada antes de los 5)', () => {
    const kicks = [1, 2, 3].flatMap((round) => [kick('club1', round, true), kick('club2', round, false)]);

    const slots = buildSlots(kicks);

    expect(slots.club1.map(Boolean)).toEqual([true, true, true, false, false]);
    expect(slots.club2.map(Boolean)).toEqual([true, true, true, false, false]);
  });

  it('ignora un round fuera de 1..5 y tolera lista ausente', () => {
    expect(buildSlots([kick('club1', 6, true), kick('club1', 0, true)]).club1).toEqual([null, null, null, null, null]);
    expect(buildSlots(undefined).club2).toEqual([null, null, null, null, null]);
  });
});

describe('sameKicks', () => {
  it('es true si el contenido es igual aunque sean listas distintas (cada tick llega como JSON nuevo)', () => {
    const a = [kick('club1', 1, true), kick('club2', 1, false)];
    const b = JSON.parse(JSON.stringify(a));

    expect(sameKicks(a, b)).toBe(true);
  });

  it('es false si cambia el largo o algún penal', () => {
    const a = [kick('club1', 1, true)];

    expect(sameKicks(a, [])).toBe(false);
    expect(sameKicks(a, [kick('club1', 1, false)])).toBe(false);
    expect(sameKicks(a, [kick('club1', 1, true, { kickerName: 'otro' })])).toBe(false);
  });
});

describe('sameCurrent', () => {
  it('compara por contenido y tolera null', () => {
    expect(sameCurrent(null, null)).toBe(true);
    expect(sameCurrent(CURRENT, { ...CURRENT })).toBe(true);
    expect(sameCurrent(CURRENT, null)).toBe(false);
    expect(sameCurrent(null, CURRENT)).toBe(false);
    expect(sameCurrent(CURRENT, { ...CURRENT, defenderId: 4 })).toBe(false);
    expect(sameCurrent(CURRENT, { ...CURRENT, club: 'club1' })).toBe(false);
  });
});

describe('penaltyPlayerInfo', () => {
  it('el pateador toma el club de penaltyCurrent y el defensor el contrario', () => {
    expect(penaltyPlayerInfo(12, CURRENT)).toEqual({ club: 2, name: 'Haaland', role: 'kicker' });
    expect(penaltyPlayerInfo(3, CURRENT)).toEqual({ club: 1, name: 'Dybala', role: 'defender' });
  });

  it('funciona igual si patea el club 1', () => {
    const current = { ...CURRENT, club: 'club1' };

    expect(penaltyPlayerInfo(12, current).club).toBe(1);
    expect(penaltyPlayerInfo(3, current).club).toBe(2);
  });

  it('devuelve null si el jugador no está en el penal o no hay penal en curso', () => {
    expect(penaltyPlayerInfo(99, CURRENT)).toBeNull();
    expect(penaltyPlayerInfo(12, null)).toBeNull();
  });
});

describe('textos', () => {
  it('sideNumber', () => {
    expect(sideNumber('club1')).toBe(1);
    expect(sideNumber('club2')).toBe(2);
  });

  it('shootoutLabel: “pen. 4 - 3”', () => {
    expect(shootoutLabel({ score1: 4, score2: 3 })).toBe('pen. 4 - 3');
  });

  it('winnerLabel: “Gana {club}” y, con la tanda empatada, “(definido por sorteo)”', () => {
    expect(winnerLabel({ score1: 4, score2: 3 }, 'Boca')).toBe('Gana Boca');
    expect(winnerLabel({ score1: 3, score2: 3 }, 'River')).toBe('Gana River (definido por sorteo)');
  });

  it('isDrawnByLot solo cuando los penales convertidos son iguales', () => {
    expect(isDrawnByLot({ score1: 3, score2: 3 })).toBe(true);
    expect(isDrawnByLot({ score1: 4, score2: 3 })).toBe(false);
  });
});
