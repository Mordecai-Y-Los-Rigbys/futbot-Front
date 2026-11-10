import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LeagueWaitingRoom from './LeagueWaitingRoom';

vi.mock('../hooks/useLeagueSocket');
vi.mock('../services/leagueService');
vi.mock('../context/AuthContext');

import useLeagueSocket from '../hooks/useLeagueSocket';
import { startLeague } from '../services/leagueService';
import { useAuth } from '../context/AuthContext';

const CREATOR = { id: 1, username: 'pepe' };
const OTHER   = { id: 2, username: 'luli' };

const BASE_LEAGUE = {
  id: 10,
  name: 'Liga test',
  status: 'preparation',
  private: false,
  minParticipants: 3,
  maxParticipants: 8,
  creator: { id: CREATOR.id, username: CREATOR.username, name: 'Boca FC' },
};

const makeSocket = (participants) => ({
  message: { type: 'leagueParticipants', leagueStatus: 'preparation', participants },
  status: 'open',
  closeInfo: null,
  retry: vi.fn(),
});

function renderRoom(league, user, socketOverride) {
  useAuth.mockReturnValue({ user });
  useLeagueSocket.mockReturnValue(socketOverride ?? makeSocket([
    { id: 1, username: 'pepe', name: 'Boca FC', avatar: 1 },
    { id: 2, username: 'luli', name: 'River FC', avatar: 2 },
    { id: 3, username: 'nico', name: 'Racing',   avatar: 3 },
  ]));

  return render(
    <MemoryRouter>
      <LeagueWaitingRoom league={league} onLeagueChanged={vi.fn()} />
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('botón Iniciar liga', () => {
  it('no aparece si el usuario no es el creador', () => {
    renderRoom(BASE_LEAGUE, OTHER);
    expect(screen.queryByRole('button', { name: /iniciar liga/i })).toBeNull();
  });

  it('no aparece si hay menos participantes que el mínimo', () => {
    const fewParticipants = [{ id: 1, username: 'pepe', name: 'Boca FC', avatar: 1 }];
    renderRoom(BASE_LEAGUE, CREATOR, makeSocket(fewParticipants));
    expect(screen.queryByRole('button', { name: /iniciar liga/i })).toBeNull();
  });

  it('aparece para el creador con suficientes participantes', () => {
    renderRoom(BASE_LEAGUE, CREATOR);
    expect(screen.getByRole('button', { name: /iniciar liga/i })).toBeTruthy();
  });

  it('llama a startLeague al hacer click y muestra estado de carga', async () => {
    startLeague.mockResolvedValue();
    renderRoom(BASE_LEAGUE, CREATOR);
    await userEvent.click(screen.getByRole('button', { name: /iniciar liga/i }));
    expect(startLeague).toHaveBeenCalledWith(BASE_LEAGUE.id);
  });

  it('muestra error notEnoughParticipants si llega 409', async () => {
    startLeague.mockRejectedValue({
      response: { status: 409, data: { code: 'notEnoughParticipants' } },
    });
    renderRoom(BASE_LEAGUE, CREATOR);
    await userEvent.click(screen.getByRole('button', { name: /iniciar liga/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No hay suficientes participantes')
    );
  });

  it('muestra error notInPreparation si llega 409', async () => {
    startLeague.mockRejectedValue({
      response: { status: 409, data: { code: 'notInPreparation' } },
    });
    renderRoom(BASE_LEAGUE, CREATOR);
    await userEvent.click(screen.getByRole('button', { name: /iniciar liga/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('no está en preparación')
    );
  });
});
