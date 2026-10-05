import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerMock } from './playerMocks';

describe('createPlayerMock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve el jugador creado con un id simulado', async () => {
    vi.useFakeTimers();
    const playerData = {
      name: 'Delantero',
      power: 60,
      agility: 60,
      control: 60,
      speed: 60,
      strength: 60,
    };

    const result = createPlayerMock(playerData);
    await vi.advanceTimersByTimeAsync(350);

    await expect(result).resolves.toEqual({ id: expect.any(Number), ...playerData });
  });
});
