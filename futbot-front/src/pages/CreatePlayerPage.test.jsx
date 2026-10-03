import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreatePlayerPage from './CreatePlayerPage';
import { createPlayer } from '../services/playerService';

vi.mock('../services/playerService', () => ({ createPlayer: vi.fn() }));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/players/new']}>
    <Routes>
      <Route path="/players/new" element={<CreatePlayerPage />} />
      <Route path="/players" element={<p>Listado de jugadores</p>} />
    </Routes>
  </MemoryRouter>,
);

const makeValidForm = () => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Delantero' } });
  ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
    fireEvent.change(screen.getByRole('slider', { name: stat }), { target: { value: '60' } });
  });
};

describe('CreatePlayerPage', () => {
  beforeEach(() => {
    createPlayer.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra la pantalla inicial de creación de jugador', () => {
    render(
      <MemoryRouter>
        <CreatePlayerPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Crear jugador' })).toBeInTheDocument();
    expect(screen.getByText('Creá un nuevo jugador para tu club.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('maxLength', '20');
  });

  it('actualiza el valor controlado del nombre', () => {
    render(
      <MemoryRouter>
        <CreatePlayerPage />
      </MemoryRouter>,
    );
    const nameInput = screen.getByLabelText('Nombre');

    fireEvent.change(nameInput, { target: { value: 'Delantero' } });

    expect(nameInput).toHaveValue('Delantero');

  });

  it('muestra las cinco estadísticas como sliders con rango de 20 a 100', () => {
    render(
      <MemoryRouter>
        <CreatePlayerPage />
      </MemoryRouter>,
    );

    ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
      const slider = screen.getByRole('slider', { name: stat });
      expect(slider).toHaveAttribute('min', '20');
      expect(slider).toHaveAttribute('max', '100');
      expect(slider).toHaveValue('20');
    });
  });

  it('actualiza el valor visible de una estadística al mover el slider', () => {
    render(
      <MemoryRouter>
        <CreatePlayerPage />
      </MemoryRouter>,
    );
    const powerSlider = screen.getByRole('slider', { name: 'Power' });
    fireEvent.change(powerSlider, { target: { value: '75' } });

    expect(powerSlider).toHaveValue('75');
    expect(screen.getByText('75').tagName).toBe('OUTPUT');
  });

  it('muestra el total usado y los puntos restantes en tiempo real', () => {
    render(
      <MemoryRouter>
        <CreatePlayerPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('100 / 300');
    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('Faltan 200 puntos');

    ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
      fireEvent.change(screen.getByRole('slider', { name: stat }), { target: { value: '60' } });
    });

    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('300 / 300');
    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('Total exacto');
  });
  });