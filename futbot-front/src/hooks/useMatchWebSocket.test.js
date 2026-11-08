import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMatchWebSocket from './useMatchWebSocket';
import { createMatchConnection, openMatchSocket } from '../services/matchService';

vi.mock('../services/matchService', () => ({
  createMatchConnection: vi.fn(),
  openMatchSocket: vi.fn(),
}));

const makeSocket = () => ({ onopen: null, onmessage: null, onclose: null, close: vi.fn() });

const setup = async (connection = { tokenWs: 'tok' }) => {
  const socket = makeSocket();
  createMatchConnection.mockResolvedValue(connection);
  openMatchSocket.mockReturnValue(socket);
  const hook = renderHook(() => useMatchWebSocket('123'));
  await waitFor(() => expect(openMatchSocket).toHaveBeenCalledWith('123', 'tok'));
  return { socket, ...hook };
};

describe('useMatchWebSocket', () => {
  beforeEach(() => {
    createMatchConnection.mockReset();
    openMatchSocket.mockReset();
  });

  it('pide el token, abre el socket y pasa a "open" (esperando rival: phase null)', async () => {
    const { socket, result } = await setup();

    act(() => socket.onopen());

    expect(result.current.status).toBe('open');
    expect(result.current.meta.phase).toBeNull();
  });

  it('un tick actualiza marcador y fase', async () => {
    const { socket, result } = await setup();

    act(() =>
      socket.onmessage({
        data: JSON.stringify({
          type: 'tick', score1: 1, score2: 0, elapsedTime: 12, phase: 'playing',
          players: [], ballPosition: { x: 50, y: 30 },
        }),
      }),
    );

    expect(result.current.meta).toMatchObject({ score1: 1, score2: 0, phase: 'playing' });
  });

  it('cierre 1000 / waitExpired es fatal y explica los 15 minutos', async () => {
    const { socket, result } = await setup();

    act(() => socket.onclose({ code: 1000, reason: 'waitExpired' }));

    expect(result.current.fatal.message).toMatch(/15 minutos/);
    expect(result.current.fatal.to).toBe('/');
  });

  it('un 4409 sin reason usa el mensaje por código', async () => {
    const { socket, result } = await setup();

    act(() => socket.onclose({ code: 4409, reason: '' }));

    expect(result.current.fatal.message).toMatch(/finalizado o cancelado/);
  });

  it('un 401 al pedir el token manda a /login', async () => {
    createMatchConnection.mockRejectedValue({ response: { status: 401 } });

    const { result } = renderHook(() => useMatchWebSocket('789'));

    await waitFor(() => expect(result.current.fatal).toMatchObject({ to: '/login' }));
  });

    const tick = (extra) => ({
    data: JSON.stringify({
      type: 'tick', score1: 0, score2: 0, elapsedTime: 150, phase: 'playing',
      players: [], ballPosition: { x: 50, y: 30 }, event: null, ...extra,
    }),
  });

  it('guarda el motivo y el tiempo restante de la pausa', async () => {
    const { socket, result } = await setup();

    act(() =>
      socket.onmessage(
        tick({ phase: 'paused', pauseRemainingSeconds: 15, event: { type: 'pause', reason: 'hydration', durationSeconds: 15 } }),
      ),
    );
    expect(result.current.meta).toMatchObject({ phase: 'paused', pauseReason: 'hydration', pauseRemaining: 15, pauseCount: 1 });

    act(() => socket.onmessage(tick({ phase: 'paused', pauseRemainingSeconds: 12 })));
    expect(result.current.meta).toMatchObject({ pauseReason: 'hydration', pauseRemaining: 12, pauseCount: 1 });
  });

  it('el reloj no cambia durante la pausa', async () => {
    const { socket, result } = await setup();

    act(() => socket.onmessage(tick({ phase: 'paused', pauseRemainingSeconds: 15, event: { type: 'pause', reason: 'halftime' } })));
    act(() => socket.onmessage(tick({ phase: 'paused', pauseRemainingSeconds: 10 })));

    expect(result.current.meta.elapsedTime).toBe(150);
  });

  it('conectado en medio de la pausa no hay motivo pero sí tiempo restante', async () => {
    const { socket, result } = await setup();

    act(() => socket.onmessage(tick({ phase: 'paused', pauseRemainingSeconds: 7 })));

    expect(result.current.meta).toMatchObject({ phase: 'paused', pauseReason: null, pauseRemaining: 7, pauseCount: 1 });
  });

  it('al terminar la pausa se limpia y la próxima pausa cuenta como nueva', async () => {
    const { socket, result } = await setup();

    act(() => socket.onmessage(tick({ phase: 'paused', pauseRemainingSeconds: 1, event: { type: 'pause', reason: 'hydration' } })));
    act(() => socket.onmessage(tick({ phase: 'countdown', pauseRemainingSeconds: null, event: { type: 'periodStart', periodNumber: 2, countdownSeconds: 5 } })));
    expect(result.current.meta).toMatchObject({ pauseReason: null, pauseRemaining: null, periodNumber: 2 });
    expect(result.current.meta.countdown).toMatchObject({ seconds: 5 });

    act(() => socket.onmessage(tick({ phase: 'playing' })));
    act(() => socket.onmessage(tick({ phase: 'paused', pauseRemainingSeconds: 15, event: { type: 'pause', reason: 'halftime' } })));
    expect(result.current.meta).toMatchObject({ pauseReason: 'halftime', pauseCount: 2 });
  });

  it('conectado durante la cuenta regresiva sin periodStart no hay countdown local', async () => {
    const { socket, result } = await setup();

    act(() => socket.onmessage(tick({ phase: 'countdown', pauseRemainingSeconds: null })));

    expect(result.current.meta).toMatchObject({ phase: 'countdown', countdown: null });
  });

  describe('sustituciones', () => {
    it('expone el role que devuelve POST /matches/{id}/connections', async () => {
      const { result } = await setup({ tokenWs: 'tok', role: 'player' });

      await waitFor(() => expect(result.current.role).toBe('player'));
    });

    it('un espectador queda con role spectator; sin role en la respuesta queda null', async () => {
      const spectator = await setup({ tokenWs: 'tok', role: 'spectator' });
      await waitFor(() => expect(spectator.result.current.role).toBe('spectator'));
      spectator.unmount();

      const unknown = await setup({ tokenWs: 'tok' });
      expect(unknown.result.current.role).toBeNull();
    });

    it('sin ticks no hay pausesLeft; cada tick lo pisa con el estado completo', async () => {
      const { socket, result } = await setup();
      expect(result.current.meta.pausesLeft).toBeNull();

      act(() => socket.onmessage(tick({ phase: 'countdown', pausesLeft: 3, event: { type: 'periodStart', periodNumber: 1, countdownSeconds: 5 } })));
      expect(result.current.meta.pausesLeft).toBe(3);

      act(() => socket.onmessage(tick({ phase: 'paused', pausesLeft: 2, pauseRemainingSeconds: 15, event: { type: 'pause', reason: 'hydration' } })));
      expect(result.current.meta.pausesLeft).toBe(2);
    });

    it('conexión tardía con pausesLeft en 0: el primer tick ya lo informa', async () => {
      const { socket, result } = await setup();

      act(() => socket.onmessage(tick({ phase: 'playing', pausesLeft: 0 })));

      expect(result.current.meta).toMatchObject({ phase: 'playing', pausesLeft: 0, teamVersion: 0 });
    });

    it('el evento pause sube teamVersion (ahí se aplica la pendiente)', async () => {
      const { socket, result } = await setup();
      expect(result.current.meta.teamVersion).toBe(0);

      act(() => socket.onmessage(tick({ phase: 'paused', pausesLeft: 2, pauseRemainingSeconds: 15, event: { type: 'pause', reason: 'hydration' } })));
      expect(result.current.meta.teamVersion).toBe(1);

      // Los ticks siguientes de la misma pausa no lo vuelven a subir.
      act(() => socket.onmessage(tick({ phase: 'paused', pausesLeft: 2, pauseRemainingSeconds: 14 })));
      expect(result.current.meta.teamVersion).toBe(1);
    });

    it('periodStart con periodNumber ≥ 2 sube teamVersion; el del período 1 no', async () => {
      const { socket, result } = await setup();

      act(() => socket.onmessage(tick({ phase: 'countdown', pausesLeft: 3, event: { type: 'periodStart', periodNumber: 1, countdownSeconds: 5 } })));
      expect(result.current.meta.teamVersion).toBe(0);

      act(() => socket.onmessage(tick({ phase: 'countdown', pausesLeft: 2, event: { type: 'periodStart', periodNumber: 2, countdownSeconds: 5 } })));
      expect(result.current.meta.teamVersion).toBe(1);

      act(() => socket.onmessage(tick({ phase: 'countdown', pausesLeft: 1, event: { type: 'periodStart', periodNumber: 3, countdownSeconds: 5 } })));
      expect(result.current.meta.teamVersion).toBe(2);
    });

    it('un tick sin eventos (o con un gol) no sube teamVersion', async () => {
      const { socket, result } = await setup();

      act(() => socket.onmessage(tick({ phase: 'playing', pausesLeft: 3 })));
      act(() => socket.onmessage(tick({ phase: 'playing', pausesLeft: 3, score1: 1, event: { type: 'goal', club: 'club1', scoringClub: 'A' } })));

      expect(result.current.meta.teamVersion).toBe(0);
    });
  });
});
