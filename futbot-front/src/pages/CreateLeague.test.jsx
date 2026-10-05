import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CreateLeague from './CreateLeague';
import { getBehaviors } from '../services/behaviorService';
import { getPlayers } from '../services/playerService';
import { createLeague } from '../services/leagueService';

vi.mock('../services/behaviorService', () => ({
  getBehaviors: vi.fn(),
}));

vi.mock('../services/playerService', () => ({
  getPlayers: vi.fn(),
}));

vi.mock('../services/leagueService', () => ({
  createLeague: vi.fn(),
}));

const players = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  name: `Jugador ${index + 1}`,
}));
const behaviors = { items: [{ id: 11, name: 'Ofensivo' }] };

const flushPromises = () => act(async () => {});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Ruta actual">{location.pathname}</output>;
}

const renderPage = async () => {
  render(
    <MemoryRouter>
      <LocationProbe />
      <CreateLeague />
    </MemoryRouter>,
  );
  await flushPromises();
};

const fillTeam = () => {
  for (let index = 0; index < 6; index += 1) {
    fireEvent.change(
      screen.getByLabelText('Jugador', { selector: `select[id$="player-${index}"]` }),
      { target: { value: String(index + 1) } },
    );
    fireEvent.change(
      screen.getByLabelText('Comportamiento', { selector: `select[id$="behavior-${index}"]` }),
      { target: { value: '11' } },
    );
  }
};

const fillLeagueDetails = () => {
  fireEvent.change(screen.getByLabelText('Nombre de la liga'), {
    target: { value: 'Liga de prueba' },
  });
  fillTeam();
};

describe('CreateLeague', () => {
  beforeEach(() => {
    getPlayers.mockReset().mockResolvedValue(players);
    getBehaviors.mockReset().mockResolvedValue(behaviors);
    createLeague.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('carga el roster y los behaviors y los muestra en el TeamBuilderForm', async () => {
    render(<MemoryRouter><CreateLeague /></MemoryRouter>);
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
    render(<MemoryRouter><CreateLeague /></MemoryRouter>);

    await flushPromises();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos cargar tus jugadores o comportamientos.',
    );
  });

  it('renderiza y conserva los campos controlados de la liga', async () => {
    render(<MemoryRouter><CreateLeague /></MemoryRouter>);

    await flushPromises();

    const leagueName = screen.getByLabelText('Nombre de la liga');
    const minParticipants = screen.getByLabelText('Mínimo de participantes');
    const maxParticipants = screen.getByLabelText('Máximo de participantes');
    const matchDuration = screen.getByLabelText('Duración del partido (minutos)');

    fireEvent.change(leagueName, { target: { value: 'Liga de prueba' } });
    fireEvent.change(minParticipants, { target: { value: '4' } });
    fireEvent.change(maxParticipants, { target: { value: '12' } });
    fireEvent.change(matchDuration, { target: { value: '10' } });

    expect(leagueName).toHaveValue('Liga de prueba');
    expect(minParticipants).toHaveValue(4);
    expect(maxParticipants).toHaveValue(12);
    expect(matchDuration).toHaveValue(10);
  });

  it('limpia y deshabilita la contraseña cuando la liga se hace pública', async () => {
    render(<MemoryRouter><CreateLeague /></MemoryRouter>);

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

  it('deshabilita el envío si el máximo es menor que el mínimo', async () => {
    await renderPage();
    fillLeagueDetails();

    fireEvent.change(screen.getByLabelText('Mínimo de participantes'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText('Máximo de participantes'), {
      target: { value: '3' },
    });

    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Máximo de participantes'), {
      target: { value: '4' },
    });
    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeEnabled();
  });

  it('deshabilita el envío si la duración del partido supera los 10 minutos', async () => {
    await renderPage();
    fillLeagueDetails();

    const matchDuration = screen.getByLabelText('Duración del partido (minutos)');
    fireEvent.change(matchDuration, { target: { value: '11' } });
    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeDisabled();

    fireEvent.change(matchDuration, { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeEnabled();
  });

  it('limita a 72 caracteres la contraseña de una liga privada', async () => {
    await renderPage();
    fillLeagueDetails();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Privada' }));

    const password = screen.getByLabelText('Contraseña');
    expect(password).toHaveAttribute('maxLength', '72');

    fireEvent.change(password, { target: { value: 'x'.repeat(73) } });
    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeDisabled();

    fireEvent.change(password, { target: { value: 'x'.repeat(72) } });
    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeEnabled();
  });

  it('envía todos los campos, members y password null si la liga es pública', async () => {
    createLeague.mockResolvedValue({ id: 42 });
    await renderPage();
    fillLeagueDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Crear Liga' }));
    await flushPromises();

    expect(createLeague).toHaveBeenCalledExactlyOnceWith({
      name: 'Liga de prueba',
      minParticipants: 3,
      maxParticipants: 8,
      matchDuration: 10,
      private: false,
      password: null,
      members: [
        { playerId: 1, role: 'forward', behaviorId: 11 },
        { playerId: 2, role: 'midfield', behaviorId: 11 },
        { playerId: 3, role: 'defense', behaviorId: 11 },
        { playerId: 4, role: 'substitute', behaviorId: 11 },
        { playerId: 5, role: 'substitute', behaviorId: 11 },
        { playerId: 6, role: 'substitute', behaviorId: 11 },
      ],
    });
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/leagues/42/lobby');
  });

  it('envía la contraseña cuando la liga es privada', async () => {
    createLeague.mockResolvedValue({ id: 43 });
    await renderPage();
    fillLeagueDetails();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Privada' }));
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'clave-segura' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear Liga' }));
    await flushPromises();

    expect(createLeague).toHaveBeenCalledWith(expect.objectContaining({
      private: true,
      password: 'clave-segura',
    }));
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/leagues/43/lobby');
  });

  it('deshabilita el botón y evita envíos dobles durante la creación', async () => {
    let resolveRequest;
    createLeague.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    await renderPage();
    fillLeagueDetails();

    const submitButton = screen.getByRole('button', { name: 'Crear Liga' });
    fireEvent.click(submitButton);

    expect(screen.getByRole('button', { name: /Creando Liga/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Creando Liga/ }));
    expect(createLeague).toHaveBeenCalledTimes(1);

    await act(async () => resolveRequest({ id: 44 }));
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/leagues/44/lobby');
  });

  it.each([
    [400, {}, 'Datos inválidos.'],
    [401, {}, 'Tu sesión venció'],
    [409, { code: 'playerOrBehaviorNotOwned' }, 'no te pertenece'],
  ])('muestra el error HTTP %i conservando lo ingresado', async (status, data, expectedMessage) => {
    createLeague.mockRejectedValue(Object.assign(new Error('Request failed'), {
      response: { status, data: { ...data, message: status === 400 ? 'Datos inválidos.' : undefined } },
    }));
    await renderPage();
    fillLeagueDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Crear Liga' }));
    await flushPromises();

    expect(screen.getByRole('alert')).toHaveTextContent(expectedMessage);
    expect(screen.getByLabelText('Nombre de la liga')).toHaveValue('Liga de prueba');
    expect(screen.getByRole('button', { name: 'Crear Liga' })).toBeEnabled();
  });
});
