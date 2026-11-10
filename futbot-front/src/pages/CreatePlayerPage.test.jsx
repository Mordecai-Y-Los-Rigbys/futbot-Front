import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreatePlayerPage from './CreatePlayerPage';
import { createPlayer } from '../services/playerService';

vi.mock('../services/playerService', () => ({ createPlayer: vi.fn() }));

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={['/players/new']}>
      <Routes>
        <Route path="/players/new" element={<CreatePlayerPage />} />
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
    mockedNavigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra la pantalla inicial de creación de jugador', () => {
    renderComponent();

    expect(screen.getByRole('heading', { name: 'Crear jugador' })).toBeInTheDocument();
    expect(screen.getByText('Creá un nuevo jugador para tu club.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('maxLength', '20');
  });

  it('vuelve al inicio al cancelar la creación (el listado de jugadores ya no existe)', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mockedNavigate).toHaveBeenCalledWith('/');
  });

  it('actualiza el valor controlado del nombre', () => {
    renderComponent();
    const nameInput = screen.getByLabelText('Nombre');

    fireEvent.change(nameInput, { target: { value: 'Delantero' } });

    expect(nameInput).toHaveValue('Delantero');

  });

  it('muestra las cinco estadísticas como sliders con rango de 20 a 100', () => {
    renderComponent();

    ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
      const slider = screen.getByRole('slider', { name: stat });
      expect(slider).toHaveAttribute('min', '20');
      expect(slider).toHaveAttribute('max', '100');
      expect(slider).toHaveValue('20');
    });
  });

  it('actualiza el valor visible de una estadística al mover el slider', () => {
    renderComponent();
    const powerSlider = screen.getByRole('slider', { name: 'Power' });
    fireEvent.change(powerSlider, { target: { value: '75' } });

    expect(powerSlider).toHaveValue('75');
    expect(screen.getByText('75').tagName).toBe('OUTPUT');
  });

  it('muestra el total usado y los puntos restantes en tiempo real', () => {
    renderComponent();

    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('100 / 300');
    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('Faltan 200 puntos');

    ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
      fireEvent.change(screen.getByRole('slider', { name: stat }), { target: { value: '60' } });
    });

    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('300 / 300');
    expect(screen.getByText(/Puntos usados:/)).toHaveTextContent('Total exacto');
  });
  it('los sliders frenan en 300 puntos: no dejan subir más allá del total', () => {
    renderComponent();
    const slider = (name) => screen.getByRole('slider', { name });
    const points = () => screen.getByText(/Puntos usados:/);

    fireEvent.change(slider('Power'), { target: { value: '100' } });
    fireEvent.change(slider('Agility'), { target: { value: '100' } });
    expect(points()).toHaveTextContent('260 / 300');

    // Control quiere llegar a 100 (340 en total): se frena en los 40 puntos que quedaban.
    fireEvent.change(slider('Control'), { target: { value: '100' } });
    expect(slider('Control')).toHaveValue('60');
    expect(points()).toHaveTextContent('300 / 300');

    // Con el total completo, otro slider no puede subir.
    fireEvent.change(slider('Speed'), { target: { value: '90' } });
    expect(slider('Speed')).toHaveValue('20');
    expect(points()).toHaveTextContent('300 / 300');
    expect(screen.queryByText(/Sobran/)).not.toBeInTheDocument();

    // Bajar un slider libera puntos para los demás.
    fireEvent.change(slider('Power'), { target: { value: '80' } });
    fireEvent.change(slider('Speed'), { target: { value: '40' } });
    expect(slider('Speed')).toHaveValue('40');
    expect(points()).toHaveTextContent('300 / 300');
  });

  it('muestra las validaciones pendientes para nombre y total de estadísticas', () => {
    renderComponent();

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
    renderComponent();

    expect(screen.getByRole('button', { name: 'Crear jugador' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('heading', { name: 'Crear jugador' }).closest('main').querySelector('form'));

    expect(createPlayer).not.toHaveBeenCalled();
  });

  it('envía los datos válidos, avisa el éxito, no redirige y deja el formulario limpio', async () => {
    createPlayer.mockResolvedValue({ id: 1, name: 'Delantero' });
    renderComponent();
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
    expect(screen.getByText('¡Jugador creado correctamente!')).toHaveAttribute('role', 'status');
    expect(mockedNavigate).not.toHaveBeenCalled();

    // Listo para crear otro jugador.
    expect(screen.getByLabelText('Nombre')).toHaveValue('');
    expect(screen.getByLabelText('Nombre')).toBeEnabled();
    expect(screen.getByRole('slider', { name: 'Power' })).toHaveValue('20');
    expect(screen.getByRole('slider', { name: 'Power' })).toBeEnabled();
  });

  it('el aviso de éxito desaparece al empezar a editar el siguiente jugador', async () => {
    createPlayer.mockResolvedValue({ id: 1 });
    renderComponent();
    makeValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('¡Jugador creado correctamente!')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otro' } });

    expect(screen.queryByText('¡Jugador creado correctamente!')).not.toBeInTheDocument();
  });

  it('muestra el estado de carga mientras la petición está pendiente', async () => {
    let resolveRequest;
    createPlayer.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    renderComponent();
    makeValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));

    expect(screen.getByRole('button', { name: 'Creando jugador…' })).toBeDisabled();
    expect(screen.getByLabelText('Nombre')).toBeDisabled();
    ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
      expect(screen.getByRole('slider', { name: stat })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await act(async () => {
      resolveRequest({ id: 1 });
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Nombre')).toBeEnabled();
    ['Power', 'Agility', 'Control', 'Speed', 'Strength'].forEach((stat) => {
      expect(screen.getByRole('slider', { name: stat })).toBeEnabled();
    });
  });

  it('muestra el mensaje de error del backend sin desmontar el formulario', async () => {
    createPlayer.mockRejectedValue({
      response: { data: { message: 'El nombre ya está en uso.' } },
    });
    renderComponent();
    makeValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('El nombre ya está en uso.');
    expect(screen.getByRole('heading', { name: 'Crear jugador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear jugador' })).toBeEnabled();
  });

  it('muestra los errores de validación devueltos como lista por la API', async () => {
    createPlayer.mockRejectedValue({
      response: {
        data: { errors: ['Power inválido.', 'El jugador ya existe.'] },
      },
    });
    renderComponent();
    makeValidForm();

    fireEvent.click(screen.getByRole('button', { name: 'Crear jugador' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Power inválido. El jugador ya existe.');
    expect(screen.getByRole('heading', { name: 'Crear jugador' })).toBeInTheDocument();
  });
});
