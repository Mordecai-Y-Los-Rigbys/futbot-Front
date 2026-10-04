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
  it('muestra las validaciones pendientes para nombre y total de estadísticas', () => {
    renderPage();

    expect(screen.getByRole('list', { name: 'Validaciones pendientes' })).toHaveTextContent(
      'Ingresá el nombre del jugador.',
    );
    expect(screen.getByRole('list', { name: 'Validaciones pendientes' })).toHaveTextContent(
      'Asigná los 200 puntos restantes.',
    );

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Delantero' } });

    expect(screen.queryByText('Ingresá el nombre del jugador.')).not.toBeInTheDocument();
  });

  it('bloquea el envío cuando los datos son inválidos', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Crear jugador' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('heading', { name: 'Crear jugador' }).closest('main').querySelector('form'));

    expect(createPlayer).not.toHaveBeenCalled();
  });

  it('envía los datos válidos, muestra éxito y redirige a jugadores', async () => {
    vi.useFakeTimers();
    createPlayer.mockResolvedValue({ id: 1, name: 'Delantero' });
    renderPage();
    makeValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(createPlayer).toHaveBeenCalledWith({
      name: 'Delantero',
      power: 60,
      agility: 60,
      control: 60,
      speed: 60,
      strength: 60,
    });
    expect(screen.getByText('¡Jugador creado correctamente! Redirigiendo al listado…')).toHaveAttribute(
      'role',
      'status',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(screen.getByText('Listado de jugadores')).toBeInTheDocument();
  });

  it('muestra el estado de carga mientras la petición está pendiente', async () => {
    let resolveRequest;
    createPlayer.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    renderPage();
    makeValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));

    expect(screen.getByRole('button', { name: 'Creando jugador…' })).toBeDisabled();

    await act(async () => {
      resolveRequest({ id: 1 });
      await Promise.resolve();
    });
  });

  it('muestra el mensaje de error del backend sin desmontar el formulario', async () => {
    createPlayer.mockRejectedValue({
      response: { data: { message: 'El nombre ya está en uso.' } },
    });
    renderPage();
    makeValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('El nombre ya está en uso.');
    expect(screen.getByRole('heading', { name: 'Crear jugador' })).toBeInTheDocument();
  });
});