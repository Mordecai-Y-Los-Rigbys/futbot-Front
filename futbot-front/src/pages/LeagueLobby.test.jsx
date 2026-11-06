import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeagueLobby from './LeagueLobby';
import { getLeague } from '../services/leagueService';

// La sala de espera tiene sus propios tests: acá es un reemplazo que permite avisar que la liga cambió.
vi.mock('../components/LeagueWaitingRoom', () => ({
  default: ({ league, onLeagueChanged }) => (
    <div>
      <p>Sala de espera de {league.name}</p>
      <button type="button" onClick={onLeagueChanged}>Cambió la liga</button>
    </div>
  ),
}));
vi.mock('../services/leagueService');

const makeLeague = (overrides = {}) => ({
  id: 5,
  name: 'Liga del barrio',
  creator: { id: 2, username: 'pepe', name: 'Boca Juniors', avatar: 1 },
  status: 'preparation',
  participantsCount: 1,
  maxParticipants: 8,
  minParticipants: 3,
  joined: false,
  private: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const httpError = (status) => ({ response: { status, data: {} } });

function renderLobby() {
  render(
    <MemoryRouter initialEntries={['/leagues/5']}>
      <Routes>
        <Route path="/leagues/:id" element={<LeagueLobby />} />
        <Route path="/leagues" element={<p>Listado de ligas</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LeagueLobby', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('muestra un indicador de carga hasta tener la liga', async () => {
    let entregar;
    getLeague.mockReturnValue(new Promise((resolve) => { entregar = resolve; }));

    renderLobby();

    expect(screen.getByRole('status')).toHaveTextContent(/cargando liga/i);

    entregar(makeLeague());

    expect(await screen.findByText('Sala de espera de Liga del barrio')).toBeInTheDocument();
    expect(getLeague).toHaveBeenCalledWith('5', expect.anything());
  });

  it('liga en preparación: muestra la sala de espera', async () => {
    getLeague.mockResolvedValue(makeLeague({ status: 'preparation' }));

    renderLobby();

    expect(await screen.findByText('Sala de espera de Liga del barrio')).toBeInTheDocument();
  });

  it.each(['started', 'finished'])('liga %s: ya no muestra la sala de espera y avisa', async (status) => {
    getLeague.mockResolvedValue(makeLeague({ status }));

    renderLobby();

    expect(await screen.findByText('Esta liga ya no está en preparación.')).toBeInTheDocument();
    expect(screen.queryByText(/sala de espera/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a ligas/i })).toHaveAttribute('href', '/leagues');
  });

  it('liga cancelada: avisa que fue cancelada', async () => {
    getLeague.mockResolvedValue(makeLeague({ status: 'cancelled' }));

    renderLobby();

    expect(await screen.findByText('La liga fue cancelada.')).toBeInTheDocument();
  });

  it('cuando la sala de espera avisa que la liga cambió, vuelve a pedirla y cambia la vista', async () => {
    getLeague
      .mockResolvedValueOnce(makeLeague({ status: 'preparation' }))
      .mockResolvedValueOnce(makeLeague({ status: 'started' }));

    renderLobby();
    await userEvent.click(await screen.findByRole('button', { name: /cambió la liga/i }));

    expect(await screen.findByText('Esta liga ya no está en preparación.')).toBeInTheDocument();
    expect(getLeague).toHaveBeenCalledTimes(2);
  });

  it('401 al cargar la liga: redirige al login', async () => {
    getLeague.mockRejectedValue(httpError(401));

    renderLobby();

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
  });

  it('404 al cargar la liga: redirige al listado de ligas', async () => {
    getLeague.mockRejectedValue(httpError(404));

    renderLobby();

    expect(await screen.findByText('Listado de ligas')).toBeInTheDocument();
  });

  it('error de red: muestra el error y permite reintentar', async () => {
    getLeague
      .mockRejectedValueOnce(new Error('Network Error')) // sin err.response
      .mockResolvedValueOnce(makeLeague());

    renderLobby();

    expect(await screen.findByText(/no pudimos cargar la liga/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Sala de espera de Liga del barrio')).toBeInTheDocument();
    expect(getLeague).toHaveBeenCalledTimes(2);
  });
});
