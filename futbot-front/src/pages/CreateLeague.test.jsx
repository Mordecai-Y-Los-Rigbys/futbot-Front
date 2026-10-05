import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('renderiza y conserva los campos controlados de la liga', async () => {
    render(<CreateLeague />);

    await flushPromises();

    const leagueName = screen.getByLabelText('Nombre de la liga');
    const minParticipants = screen.getByLabelText('Mínimo de participantes');
    const maxParticipants = screen.getByLabelText('Máximo de participantes');
    const matchDuration = screen.getByLabelText('Duración del partido (minutos)');

    fireEvent.change(leagueName, { target: { value: 'Liga de prueba' } });
    fireEvent.change(minParticipants, { target: { value: '4' } });
    fireEvent.change(maxParticipants, { target: { value: '12' } });
    fireEvent.change(matchDuration, { target: { value: '15' } });

    expect(leagueName).toHaveValue('Liga de prueba');
    expect(minParticipants).toHaveValue(4);
    expect(maxParticipants).toHaveValue(12);
    expect(matchDuration).toHaveValue(15);
  });

  it('limpia y deshabilita la contraseña cuando la liga se hace pública', async () => {
    render(<CreateLeague />);

    await flushPromises();

    const privateSwitch = screen.getByRole('checkbox', { name: 'Privada' });
    fireEvent.click(privateSwitch);

    const password = screen.getByLabelText('Contraseña');
    expect(password).toBeEnabled();
    fireEvent.change(password, { target: { value: 'secreta' } });
    expect(password).toHaveValue('secreta');

    fireEvent.click(privateSwitch);
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();

    fireEvent.click(privateSwitch);
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });
});
