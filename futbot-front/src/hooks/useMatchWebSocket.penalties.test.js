import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMatchWebSocket from './useMatchWebSocket';
import { createMatchConnection, openMatchSocket } from '../services/matchService';

vi.mock('../services/matchService', () => ({
  createMatchConnection: vi.fn(),
  openMatchSocket: vi.fn(),
}));

const makeSocket = () => ({ onopen: null, onmessage: null, onclose: null, close: vi.fn() });

const setup = async () => {
  const socket = makeSocket();
  createMatchConnection.mockResolvedValue({ tokenWs: 'tok' });
  openMatchSocket.mockReturnValue(socket);
  const hook = renderHook(() => useMatchWebSocket('123'));
  await waitFor(() => expect(openMatchSocket).toHaveBeenCalledWith('123', 'tok'));
  return { socket, ...hook };
};

const CURRENT = { club: 'club1', kickerId: 1, kickerName: 'Messi', defenderId: 11, defenderName: 'Foden' };

const kick = (club, round, scored, kickerName) => ({ club, kickerId: round, kickerName, round, scored });

// Tick de la tanda con todos los campos (como en la AsyncAPI).
const penaltyTick = (overrides = {}) => ({
  type: 'tick',
  players: [
    { playerId: 1, position: { x: 50, y: 30 } },
    { playerId: 11, position: { x: 95, y: 30 } },
  ],
  ballPosition: { x: 50, y: 30 },
  score1: 1,
  score2: 1,
  elapsedTime: 600,
  phase: 'penalties',
  event: null,
  penaltyScore1: 0,
  penaltyScore2: 0,
  penaltyKicks: [],
  penaltyCurrent: CURRENT,
  penaltyCountdownSeconds: null,
  penaltyRemainingSeconds: 8,
  ...overrides,
});

const send = (socket, tick) => act(() => socket.onmessage({ data: JSON.stringify(tick) }));

describe('useMatchWebSocket: tanda de penales', () => {
  beforeEach(() => {
    createMatchConnection.mockReset();
    openMatchSocket.mockReset();
  });

  it('el primer tick de la tanda trae el cartel y la cuenta previa', async () => {
    const { socket, result } = await setup();

    send(
      socket,
      penaltyTick({ event: { type: 'penaltiesStart' }, penaltyCountdownSeconds: 3, penaltyRemainingSeconds: 8 }),
    );

    expect(result.current.meta).toMatchObject({
      phase: 'penalties',
      penaltyScore1: 0,
      penaltyScore2: 0,
      penaltyCurrent: CURRENT,
      penaltyCountdownSeconds: 3,
      penaltyRemainingSeconds: 8,
      penaltiesBanner: { id: 1 },
    });
  });

  it('el cartel no se repite con los ticks siguientes', async () => {
    const { socket, result } = await setup();
    send(socket, penaltyTick({ event: { type: 'penaltiesStart' }, penaltyCountdownSeconds: 3 }));
    const banner = result.current.meta.penaltiesBanner;

    send(socket, penaltyTick({ penaltyCountdownSeconds: 2 }));

    expect(result.current.meta.penaltiesBanner).toBe(banner);
  });

  it('con el penal en juego la cuenta previa queda en null y corren los 8 segundos', async () => {
    const { socket, result } = await setup();

    send(socket, penaltyTick({ penaltyCountdownSeconds: null, penaltyRemainingSeconds: 5 }));

    expect(result.current.meta.penaltyCountdownSeconds).toBeNull();
    expect(result.current.meta.penaltyRemainingSeconds).toBe(5);
  });

  it('un cliente que se conecta a mitad de la tanda reconstruye todo con el estado completo, sin eventos', async () => {
    const { socket, result } = await setup();
    const kicks = [kick('club1', 1, true, 'Messi'), kick('club2', 1, false, 'Haaland'), kick('club1', 2, true, 'Di María')];

    send(socket, penaltyTick({ penaltyScore1: 2, penaltyScore2: 0, penaltyKicks: kicks, event: null }));

    expect(result.current.meta.penaltyKicks).toEqual(kicks);
    expect(result.current.meta).toMatchObject({ penaltyScore1: 2, penaltyScore2: 0, penaltiesBanner: null });
  });

  it('un penal ejecutado figura en la lista del mismo tick en que llega el evento penaltyKick', async () => {
    const { socket, result } = await setup();
    const scored = kick('club1', 1, true, 'Messi');

    send(socket, penaltyTick({ penaltyScore1: 1, penaltyKicks: [scored], event: { type: 'penaltyKick', ...scored } }));

    expect(result.current.meta.penaltyKicks).toEqual([scored]);
    expect(result.current.meta.penaltyScore1).toBe(1);
  });

  it('no re-renderiza si el tick trae lo mismo (la lista llega como JSON nuevo en cada tick)', async () => {
    const { socket, result } = await setup();
    const kicks = [kick('club1', 1, true, 'Messi')];
    send(socket, penaltyTick({ penaltyScore1: 1, penaltyKicks: kicks }));
    const before = result.current.meta;
    const beforeKicks = before.penaltyKicks;
    const beforeCurrent = before.penaltyCurrent;

    send(socket, penaltyTick({ penaltyScore1: 1, penaltyKicks: kicks }));

    expect(result.current.meta).toBe(before);
    expect(result.current.meta.penaltyKicks).toBe(beforeKicks);
    expect(result.current.meta.penaltyCurrent).toBe(beforeCurrent);
  });

  it('actualiza cuando cambian los segundos restantes', async () => {
    const { socket, result } = await setup();
    send(socket, penaltyTick({ penaltyRemainingSeconds: 8 }));
    const before = result.current.meta;

    send(socket, penaltyTick({ penaltyRemainingSeconds: 7 }));

    expect(result.current.meta).not.toBe(before);
    expect(result.current.meta.penaltyRemainingSeconds).toBe(7);
    expect(result.current.meta.penaltyKicks).toBe(before.penaltyKicks);
  });

  it('el tick final (matchEnd) guarda result con la tanda y las marcas', async () => {
    const { socket, result } = await setup();
    const kicks = [kick('club1', 1, true, 'Messi'), kick('club2', 1, false, 'Haaland')];
    const penalties = { score1: 4, score2: 3, winner: 'club1', kicks };

    send(
      socket,
      penaltyTick({
        phase: 'finished',
        penaltyCurrent: null,
        penaltyRemainingSeconds: null,
        penaltyKicks: kicks,
        event: { type: 'matchEnd', result: { score1: 1, score2: 1, penalties } },
      }),
    );

    expect(result.current.meta.phase).toBe('finished');
    expect(result.current.meta.result).toEqual({ score1: 1, score2: 1, penalties });
    expect(result.current.meta.penaltyKicks).toEqual(kicks);
  });

  it('un partido sin tanda deja los campos de la tanda en sus valores vacíos (aunque el tick no los traiga)', async () => {
    const { socket, result } = await setup();

    send(socket, {
      type: 'tick', score1: 1, score2: 0, elapsedTime: 12, phase: 'playing',
      players: [], ballPosition: { x: 50, y: 30 },
    });

    expect(result.current.meta).toMatchObject({
      penaltyScore1: 0,
      penaltyScore2: 0,
      penaltyKicks: [],
      penaltyCurrent: null,
      penaltyCountdownSeconds: null,
      penaltyRemainingSeconds: null,
      penaltiesBanner: null,
      result: null,
    });
  });

  it('un matchEnd sin tanda guarda result.penalties en null', async () => {
    const { socket, result } = await setup();

    send(socket, {
      type: 'tick', score1: 2, score2: 1, elapsedTime: 600, phase: 'finished',
      players: [], ballPosition: { x: 50, y: 30 },
      event: { type: 'matchEnd', result: { score1: 2, score2: 1, penalties: null } },
    });

    expect(result.current.meta.result).toEqual({ score1: 2, score2: 1, penalties: null });
  });
});
