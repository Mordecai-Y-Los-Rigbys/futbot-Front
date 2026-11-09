import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useLeagueSocket from './useLeagueSocket';
import { openLeagueSocket } from '../services/leagueSocket';

vi.mock('../services/leagueSocket', () => ({ openLeagueSocket: vi.fn() }));

const makeSocket = () => ({ onopen: null, onmessage: null, onclose: null, close: vi.fn() });

const participantsMessage = (...usernames) =>
  JSON.stringify({
    type: 'leagueParticipants',
    leagueStatus: 'preparation',
    participants: usernames.map((username, index) => ({ id: index + 1, username, name: `Club ${username}`, avatar: 1 })),
  });

// Cada llamada a openLeagueSocket devuelve un socket nuevo, así se pueden manejar los reintentos.
function setup(channel = 'participants') {
  const sockets = [];
  openLeagueSocket.mockImplementation(() => {
    const socket = makeSocket();
    sockets.push(socket);
    return socket;
  });
  const hook = renderHook(() => useLeagueSocket(5, channel));
  return { sockets, last: () => sockets[sockets.length - 1], ...hook };
}

describe('useLeagueSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    openLeagueSocket.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('abre el canal de la liga, empieza conectando y pasa a "open"', () => {
    const { result, last } = setup();

    expect(openLeagueSocket).toHaveBeenCalledWith(5, 'participants');
    expect(result.current.status).toBe('connecting');
    expect(result.current.message).toBeNull();

    act(() => last().onopen());

    expect(result.current.status).toBe('open');
  });

  it('cada mensaje reemplaza al anterior con la lista completa', () => {
    const { result, last } = setup();

    act(() => last().onmessage({ data: participantsMessage('pepe') }));
    expect(result.current.message.participants).toHaveLength(1);

    act(() => last().onmessage({ data: participantsMessage('pepe', 'santi') }));
    expect(result.current.message.participants.map((p) => p.username)).toEqual(['pepe', 'santi']);
  });

  it('ignora un mensaje que no es JSON y uno con un type desconocido', () => {
    const { result, last } = setup();

    act(() => last().onmessage({ data: 'esto no es json' }));
    act(() => last().onmessage({ data: JSON.stringify({ type: 'otraCosa', participants: [] }) }));

    expect(result.current.message).toBeNull();
    expect(result.current.status).toBe('connecting');
  });

  it('en el canal matches/next espera mensajes leagueNextMatch', () => {
    const { result, last } = setup('matches/next');

    act(() => last().onmessage({ data: participantsMessage('pepe') })); // otro canal: se ignora
    expect(result.current.message).toBeNull();

    act(() =>
      last().onmessage({ data: JSON.stringify({ type: 'leagueNextMatch', leagueStatus: 'started', match: null }) }),
    );
    expect(result.current.message.type).toBe('leagueNextMatch');
  });

  it.each([
    [1000, 'leagueStarted'],
    [1000, 'leagueCancelled'],
    [4401, 'sessionInvalid'],
    [4401, 'sessionEnded'],
    [4403, 'leagueAccessRequired'],
    [4403, 'originNotAllowed'],
    [4404, 'leagueNotFound'],
    [4409, 'leagueNotInPreparation'],
    [4429, 'tooManyConnections'],
  ])('cierre %i / %s: queda cerrado con su motivo y no reconecta', (code, reason) => {
    const { result, last } = setup();

    act(() => last().onclose({ code, reason }));
    act(() => vi.advanceTimersByTime(10000));

    expect(result.current.status).toBe('closed');
    expect(result.current.closeInfo).toEqual({ code, reason });
    expect(openLeagueSocket).toHaveBeenCalledTimes(1);
  });

  it('una caída de red se reintenta 3 veces, con esperas de 1, 2 y 3 s, y después se cierra', () => {
    const { result, sockets, last } = setup();

    act(() => last().onclose({ code: 1006, reason: '' }));
    expect(result.current.status).toBe('reconnecting');
    act(() => vi.advanceTimersByTime(999));
    expect(sockets).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(sockets).toHaveLength(2);

    act(() => last().onclose({ code: 1006, reason: '' }));
    act(() => vi.advanceTimersByTime(1999));
    expect(sockets).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(sockets).toHaveLength(3);

    act(() => last().onclose({ code: 1006, reason: '' }));
    act(() => vi.advanceTimersByTime(2999));
    expect(sockets).toHaveLength(3);
    act(() => vi.advanceTimersByTime(1));
    expect(sockets).toHaveLength(4);

    // El cuarto intento falla: no se reintenta más.
    act(() => last().onclose({ code: 1006, reason: '' }));
    act(() => vi.advanceTimersByTime(10000));
    expect(sockets).toHaveLength(4);
    expect(result.current.status).toBe('closed');
    expect(result.current.closeInfo).toEqual({ code: 1006, reason: '' });
  });

  it('al reconectar y recibir el estado actual, la lista se actualiza y los reintentos se reinician', () => {
    const { result, sockets, last } = setup();

    act(() => last().onclose({ code: 1006, reason: '' }));
    act(() => vi.advanceTimersByTime(1000));
    act(() => last().onopen());
    act(() => last().onmessage({ data: participantsMessage('pepe', 'santi') }));
    expect(result.current.status).toBe('open');
    expect(result.current.message.participants).toHaveLength(2);

    // Con el primer mensaje el contador vuelve a cero: el próximo reintento espera 1 s otra vez.
    act(() => last().onclose({ code: 1006, reason: '' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(sockets).toHaveLength(3);
  });

  it('abrir la conexión no alcanza para reiniciar los reintentos (el servidor puede cerrar después)', () => {
    const { result, sockets, last } = setup();

    for (const espera of [1000, 2000, 3000]) {
      act(() => last().onopen()); // abre pero cae antes de mandar nada
      act(() => last().onclose({ code: 1006, reason: '' }));
      act(() => vi.advanceTimersByTime(espera));
    }
    act(() => last().onopen());
    act(() => last().onclose({ code: 1006, reason: '' }));

    expect(sockets).toHaveLength(4);
    expect(result.current.status).toBe('closed');
  });

  it('retry() vuelve a conectar después de un cierre definitivo', () => {
    const { result, sockets, last } = setup();
    act(() => last().onclose({ code: 4429, reason: 'tooManyConnections' }));
    expect(result.current.closeInfo).not.toBeNull();

    act(() => result.current.retry());

    expect(result.current.closeInfo).toBeNull();
    expect(result.current.status).toBe('connecting');
    expect(sockets).toHaveLength(2);
  });

  it('al salir cierra la conexión y cancela los reintentos pendientes', () => {
    const { sockets, last, unmount } = setup();
    const primero = last();

    act(() => primero.onclose({ code: 1006, reason: '' })); // queda un reintento programado
    unmount();
    act(() => vi.advanceTimersByTime(10000));

    expect(sockets).toHaveLength(1);
  });

  it('al salir con la conexión abierta, la cierra', () => {
    const { last, unmount } = setup();
    const socket = last();
    act(() => socket.onopen());

    unmount();

    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.onclose).toBeNull();
  });
});
