import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MatchCard from './MatchCard';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/avatars', () => ({ getAvatarSrc: () => null }));

const club1 = { id: 1, name: 'Boca Juniors FC', avatar: 1 };
const club2 = { id: 2, name: 'River Plate FC', avatar: 2 };

const makeMatch = (overrides = {}) => ({
  id: 99,
  status: 'scheduled',
  club1,
  club2,
  scheduledAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  ...overrides,
});

const renderCard = (match, userId = 99) => {
  useAuth.mockReturnValue({ user: userId ? { id: userId } : null });
  render(
    <MemoryRouter>
      <MatchCard match={match} />
    </MemoryRouter>,
  );
};

describe('MatchCard – partido scheduled', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('muestra los dos clubes', () => {
    renderCard(makeMatch());
    expect(screen.getByText('Boca Juniors FC')).toBeInTheDocument();
    expect(screen.getByText('River Plate FC')).toBeInTheDocument();
  });

  it('muestra la fecha y hora del partido', () => {
    renderCard(makeMatch());
    // Solo verifica que haya algún texto de fecha (formato local puede variar)
    const datetime = screen.getByText(/\d{2}\/\d{2}/);
    expect(datetime).toBeInTheDocument();
  });

  it('muestra cuánto falta para empezar', () => {
    renderCard(makeMatch({ scheduledAt: new Date(Date.now() + 12 * 60 * 1000).toISOString() }));
    expect(screen.getByText(/Empieza en 12 min/)).toBeInTheDocument();
  });

  it('actualiza el tiempo cada minuto', async () => {
    renderCard(makeMatch({ scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }));
    expect(screen.getByText(/Empieza en 10 min/)).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(60_000); });

    expect(screen.getByText(/Empieza en 9 min/)).toBeInTheDocument();
  });

  it('no muestra el badge "En juego" ni el botón', () => {
    renderCard(makeMatch());
    expect(screen.queryByText('En juego')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /partido/ })).not.toBeInTheDocument();
  });
});

describe('MatchCard – partido started', () => {
  it('muestra el badge "En juego"', () => {
    renderCard(makeMatch({ status: 'started' }));
    expect(screen.getByText('En juego')).toBeInTheDocument();
  });

  it('muestra "Jugar partido" cuando el usuario es uno de los clubes', () => {
    renderCard(makeMatch({ status: 'started' }), 1);
    const btn = screen.getByRole('link', { name: 'Jugar partido' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('href', '/matches/99');
  });

  it('muestra "Ver partido" cuando el usuario no es ninguno de los clubes', () => {
    renderCard(makeMatch({ status: 'started' }), 999);
    const btn = screen.getByRole('link', { name: 'Ver partido' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('href', '/matches/99');
  });

  it('muestra "Ver partido" cuando no hay usuario logueado', () => {
    renderCard(makeMatch({ status: 'started' }), null);
    expect(screen.getByRole('link', { name: 'Ver partido' })).toBeInTheDocument();
  });

  it('no muestra el contador de tiempo', () => {
    renderCard(makeMatch({ status: 'started' }));
    expect(screen.queryByText(/Empieza en/)).not.toBeInTheDocument();
  });
});
