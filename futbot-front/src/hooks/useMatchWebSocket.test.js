import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useMatchWebSocket from './useMatchWebSocket';
import { createMatchConnection, openMatchSocket } from '../services/matchService';

vi.mock('../services/matchService', () => ({
  createMatchConnection: vi.fn(),
  openMatchSocket: vi.fn(),
}));

const makeSocket = () => ({ onopen: null, onmessage: null, onclose: null, close: vi.fn() });

// `connection` es lo que devuelve POST /matches/{id}/connections.
// Por defecto es un jugador, como en los tests originales.
const setup = async (connection = { tokenWs: 'tok', role: 'player' }) => {
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

  describe('rol de la conexión (jugador / espectador)', () => {
    it('expone role "player" cuando el back lo informa', async () => {
      const { result } = await setup({ tokenWs: 'tok', role: 'player' });

      expect(result.current.role).toBe('player');
    });

    it('expone role "spectator" cuando el back lo informa', async () => {
      const { result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      expect(result.current.role).toBe('spectator');
    });

    it('el rol ya está cargado cuando el status pasa a "open"', async () => {
      const { socket, result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      act(() => socket.onopen());

      expect(result.current.status).toBe('open');
      expect(result.current.role).toBe('spectator');
    });

    it('si el back no manda role, queda null (la pantalla no muestra controles)', async () => {
      const { result } = await setup({ tokenWs: 'tok' });

      expect(result.current.role).toBeNull();
    });

    it('un role desconocido no se interpreta como jugador', async () => {
      const { result } = await setup({ tokenWs: 'tok', role: 'otraCosa' });

      expect(result.current.role).not.toBe('player');
    });

    it('al cambiar de partido el rol se reinicia a null hasta que llega el del nuevo', async () => {
      const first = makeSocket();
      createMatchConnection.mockResolvedValueOnce({ tokenWs: 'tok', role: 'player' });
      openMatchSocket.mockReturnValueOnce(first);
      const { result, rerender } = renderHook(({ id }) => useMatchWebSocket(id), {
        initialProps: { id: '123' },
      });
      await waitFor(() => expect(result.current.role).toBe('player'));

      // El segundo partido nunca responde: el rol viejo no puede quedar colgado.
      createMatchConnection.mockReturnValueOnce(new Promise(() => {}));
      rerender({ id: '456' });

      expect(result.current.role).toBeNull();
    });
  });

  describe('errores de acceso de un espectador', () => {
    it('un 403 leagueAccessRequired al pedir el token explica que la liga es privada', async () => {
      createMatchConnection.mockRejectedValue({
        response: { status: 403, data: { code: 'leagueAccessRequired' } },
      });

      const { result } = renderHook(() => useMatchWebSocket('123'));

      await waitFor(() => expect(result.current.fatal).not.toBeNull());
      expect(result.current.fatal.message).toMatch(/privada/);
      expect(result.current.fatal.message).not.toMatch(/No participás/);
      expect(result.current.fatal.to).toBe('/');
      expect(result.current.status).toBe('closed');
      expect(openMatchSocket).not.toHaveBeenCalled();
    });

    it('un 403 notAPlayerInMatch (amistoso ajeno) sigue diciendo que no participa', async () => {
      createMatchConnection.mockRejectedValue({
        response: { status: 403, data: { code: 'notAPlayerInMatch' } },
      });

      const { result } = renderHook(() => useMatchWebSocket('123'));

      await waitFor(() => expect(result.current.fatal).not.toBeNull());
      expect(result.current.fatal.message).toMatch(/No participás/);
    });

    it('un 403 sin code mantiene el mensaje genérico', async () => {
      createMatchConnection.mockRejectedValue({ response: { status: 403 } });

      const { result } = renderHook(() => useMatchWebSocket('123'));

      await waitFor(() => expect(result.current.fatal).not.toBeNull());
      expect(result.current.fatal.message).toMatch(/No participás/);
    });

    it('un 403 no deja role cargado', async () => {
      createMatchConnection.mockRejectedValue({
        response: { status: 403, data: { code: 'leagueAccessRequired' } },
      });

      const { result } = renderHook(() => useMatchWebSocket('123'));

      await waitFor(() => expect(result.current.fatal).not.toBeNull());
      expect(result.current.role).toBeNull();
    });

    it('cierre 4403 / leagueAccessRequired en el handshake es fatal, sin reintentar', async () => {
      const { socket, result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      act(() => socket.onclose({ code: 4403, reason: 'leagueAccessRequired' }));

      expect(result.current.fatal.message).toMatch(/privada/);
      expect(result.current.status).toBe('closed');
      expect(createMatchConnection).toHaveBeenCalledTimes(1);
    });

    it('cierre 4403 / notAPlayerInMatch explica que el amistoso no se puede ver', async () => {
      const { socket, result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      act(() => socket.onclose({ code: 4403, reason: 'notAPlayerInMatch' }));

      expect(result.current.fatal.message).toMatch(/no se puede ver/);
    });

    it('un 4403 con un reason desconocido usa el mensaje por código', async () => {
      const { socket, result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      act(() => socket.onclose({ code: 4403, reason: '' }));

      expect(result.current.fatal.message).toMatch(/Error de validación/);
    });
  });

  describe('el espectador recibe la misma transmisión', () => {
    it('un espectador procesa los ticks igual que un jugador', async () => {
      const { socket, result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      act(() => socket.onopen());
      act(() =>
        socket.onmessage({
          data: JSON.stringify({
            type: 'tick', score1: 2, score2: 1, elapsedTime: 30, phase: 'playing',
            players: [], ballPosition: { x: 50, y: 30 }, event: null,
          }),
        }),
      );

      expect(result.current.meta).toMatchObject({ score1: 2, score2: 1, phase: 'playing' });
    });

    it('cierre 1000 / matchEnd de un espectador no es fatal', async () => {
      const { socket, result } = await setup({ tokenWs: 'tok', role: 'spectator' });

      act(() => socket.onclose({ code: 1000, reason: 'matchEnd' }));

      expect(result.current.fatal).toBeNull();
      expect(result.current.status).toBe('closed');
    });
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
