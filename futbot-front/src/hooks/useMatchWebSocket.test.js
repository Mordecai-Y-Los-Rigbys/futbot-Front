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
});