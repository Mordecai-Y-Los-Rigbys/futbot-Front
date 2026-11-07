import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMatchLineupsMock } from './matchMocks';

describe('getMatchLineupsMock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const call = async (id) => {
    const promise = getMatchLineupsMock(id);
    const settled = promise.then((v) => v, (e) => e);
    await vi.advanceTimersByTimeAsync(300);
    return settled;
  };

  it('devuelve 3 titulares por club', async () => {
    const data = await call('5');
    expect(data.club1).toHaveLength(3);
    expect(data.club2).toHaveLength(3);
    expect(data.club1.map((p) => p.role)).toEqual(['forward', 'midfield', 'defense']);
  });

  it('con id 0 el club2 es null (amistoso sin rival)', async () => {
    expect((await call('0')).club2).toBeNull();
  });

  it.each([['4031', 403], ['4041', 404]])('con id %s responde %i', async (id, status) => {
    expect((await call(id)).response.status).toBe(status);
  });
});