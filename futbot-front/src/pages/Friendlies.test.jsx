import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Friendlies from './Friendlies';
import * as friendlyService from '../services/friendlyService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockMatchesData = {
  items: [
    {
      id: 1,
      name: 'Superclásico Amistoso',
      status: 'scheduled',
      club1: { id: 10, username: 'roman', name: 'Boca Juniors' },
      club2: null,
    },
    {
      id: 2,
      name: 'Desafío Táctico',
      status: 'scheduled',
      club1: { id: 20, username: 'marcelo', name: 'River Plate' },
      club2: null,
    },
  ],
  page: 1,
  pageSize: 50,
  total: 2,
};

describe('Friendlies Page (SCRUM-88)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el indicador de carga inicialmente y luego renderiza la lista de partidos', async () => {
    vi.spyOn(friendlyService, 'getAvailableFriendlies').mockResolvedValue(mockMatchesData);

    render(
      <BrowserRouter>
        <Friendlies />
      </BrowserRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Superclásico Amistoso')).toBeInTheDocument();
      expect(screen.getByText('Desafío Táctico')).toBeInTheDocument();
      expect(screen.getByText('Boca Juniors')).toBeInTheDocument();
      expect(screen.getByText('@roman')).toBeInTheDocument();
    });

    const joinLinks = screen.getAllByRole('link', { name: /unirse/i });
    expect(joinLinks[0]).toHaveAttribute('href', '/friendlies/1/members');
  });

  it('muestra el estado vacío adecuado cuando no hay partidos disponibles', async () => {
    vi.spyOn(friendlyService, 'getAvailableFriendlies').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
    });

    render(
      <BrowserRouter>
        <Friendlies />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no hay amistosos disponibles en este momento/i)).toBeInTheDocument();
    });
  });

  it('muestra mensaje de error y permite reintentar si la llamada falla', async () => {
    const fetchSpy = vi.spyOn(friendlyService, 'getAvailableFriendlies')
      .mockRejectedValueOnce(new Error('Fallo de red'))
      .mockResolvedValueOnce(mockMatchesData);

    render(
      <BrowserRouter>
        <Friendlies />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Fallo de red')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Superclásico Amistoso')).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('redirige a /login si la sesión no es válida (401)', async () => {
    const error401 = { response: { status: 401 } };
    vi.spyOn(friendlyService, 'getAvailableFriendlies').mockRejectedValue(error401);

    render(
      <BrowserRouter>
        <Friendlies />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
