import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateLeague from './CreateLeague';
import { getBehaviors } from '../services/behaviorService';
import { getPlayers } from '../services/playerService';

vi.mock('../services/behaviorService', () => ({
  getBehaviors: vi.fn(),
}));

vi.mock('../services/playerService', () => ({
  getPlayers: vi.fn(),
}));

const players = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  name: `Jugador ${index + 1}`,
}));
const behaviors = { items: [{ id: 11, name: 'Ofensivo' }] };

const flushPromises = () => act(async () => {});

describe('CreateLeague', () => {
  beforeEach(() => {
    getPlayers.mockReset().mockResolvedValue(players);
    getBehaviors.mockReset().mockResolvedValue(behaviors);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carga el roster y los behaviors y los muestra en el TeamBuilderForm', async () => {
    render(<CreateLeague />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando jugadores y comportamientos');

    await flushPromises();

    expect(getPlayers).toHaveBeenCalledWith(1, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(getBehaviors).toHaveBeenCalledWith(
      '',
      1,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole('region', { name: 'Armado de equipo' })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Jugador 1' })).toHaveLength(6);
    expect(screen.getAllByRole('option', { name: 'Ofensivo' })).toHaveLength(6);
  });

  it('informa si no puede cargar jugadores o behaviors', async () => {
    getPlayers.mockRejectedValue(new Error('No connection'));
    render(<CreateLeague />);

    await flushPromises();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos cargar tus jugadores o comportamientos.',
    );
  });
});
