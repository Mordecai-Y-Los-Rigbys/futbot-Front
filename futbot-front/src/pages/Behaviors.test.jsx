import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Behaviors from './Behaviors';
import { getBehaviors } from '../services/behaviorService';

vi.mock('../services/behaviorService', () => ({
  getBehaviors: vi.fn(),
  PAGE_SIZE: 50,
}));

const makeItems = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Behavior ${i + 1}` }));

const response = (items, total = items.length) => ({ items, page: 1, pageSize: 50, total });

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

// Avanza el reloj falso y deja resolver las promesas pendientes.
const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const renderPage = async () => {
  render(<Behaviors />);
  await flush();
};

const searchInput = () => screen.getByLabelText('Buscar por nombre');
const button = (name) => screen.getByRole('button', { name });

describe('Behaviors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getBehaviors.mockReset();
    getBehaviors.mockResolvedValue(response(makeItems(3)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('carga inicial', () => {
    it('llama a getBehaviors con nombre vacío y página 1', async () => {
      await renderPage();

      expect(getBehaviors).toHaveBeenCalledTimes(1);
      expect(getBehaviors).toHaveBeenCalledWith('', 1, expect.anything());
    });

    it('muestra el nombre de cada behavior y no su id', async () => {
      getBehaviors.mockResolvedValue(
        response([
          { id: 101, name: 'Defensor' },
          { id: 102, name: 'Atacante' },
        ]),
      );

      await renderPage();

      expect(screen.getByText('Defensor')).toBeInTheDocument();
      expect(screen.getByText('Atacante')).toBeInTheDocument();
      expect(screen.queryByText('101')).not.toBeInTheDocument();
      expect(screen.queryByText('102')).not.toBeInTheDocument();
    });
  });

  describe('búsqueda con debounce', () => {
    it('no llama a la API en cada tecla: espera 400ms desde la última', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'a' } });
      await flush(200);
      fireEvent.change(searchInput(), { target: { value: 'ab' } });
      await flush(200);
      fireEvent.change(searchInput(), { target: { value: 'abc' } });
      await flush(399);

      expect(getBehaviors).toHaveBeenCalledTimes(1); // solo la carga inicial

      await flush(1);

      expect(getBehaviors).toHaveBeenCalledTimes(2);
      expect(getBehaviors).toHaveBeenLastCalledWith('abc', 1, expect.anything());
    });

    it('actualiza el input al instante, sin esperar al debounce', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'hola' } });

      expect(searchInput()).toHaveValue('hola');
      expect(getBehaviors).toHaveBeenCalledTimes(1);
    });

    it('vuelve a la página 1 al disparar una búsqueda nueva', async () => {
      getBehaviors.mockResolvedValue(response(makeItems(50), 120));
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getBehaviors).toHaveBeenLastCalledWith('', 2, expect.anything());

      fireEvent.change(searchInput(), { target: { value: 'x' } });
      await flush(400);

      expect(getBehaviors).toHaveBeenLastCalledWith('x', 1, expect.anything());
    });

    it('Enter dispara la búsqueda sin esperar al timer, y el timer no la repite', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'def' } });
      fireEvent.keyDown(searchInput(), { key: 'Enter' });
      await flush();

      expect(getBehaviors).toHaveBeenCalledTimes(2);
      expect(getBehaviors).toHaveBeenLastCalledWith('def', 1, expect.anything());

      await flush(400);

      expect(getBehaviors).toHaveBeenCalledTimes(2);
    });

    it('Enter con el mismo texto vuelve a consultar a la API', async () => {
      await renderPage();

      fireEvent.keyDown(searchInput(), { key: 'Enter' });
      await flush();

      expect(getBehaviors).toHaveBeenCalledTimes(2);
      expect(getBehaviors).toHaveBeenLastCalledWith('', 1, expect.anything());
    });

    it('cancela la request anterior cuando arranca una nueva', async () => {
      const signals = [];
      getBehaviors.mockImplementation((name, page, { signal }) => {
        signals.push(signal);
        return Promise.resolve(response(makeItems(3)));
      });
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'x' } });
      await flush(400);

      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);
    });
  });

  describe('paginación', () => {
    it('no muestra los controles si hay 50 resultados o menos', async () => {
      getBehaviors.mockResolvedValue(response(makeItems(50), 50));

      await renderPage();

      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    });

    it('en la primera página deshabilita "Anterior" y habilita "Siguiente"', async () => {
      getBehaviors.mockResolvedValue(response(makeItems(50), 120));

      await renderPage();

      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(button('Anterior')).toBeDisabled();
      expect(button('Siguiente')).toBeEnabled();
    });

    it('navega entre páginas y respeta los límites', async () => {
      getBehaviors.mockResolvedValue(response(makeItems(50), 120));
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getBehaviors).toHaveBeenLastCalledWith('', 2, expect.anything());
      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
      expect(button('Anterior')).toBeEnabled();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getBehaviors).toHaveBeenLastCalledWith('', 3, expect.anything());
      expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
      expect(button('Siguiente')).toBeDisabled(); // última página

      fireEvent.click(button('Anterior'));
      await flush();
      expect(getBehaviors).toHaveBeenLastCalledWith('', 2, expect.anything());
    });
  });

  describe('lista vacía', () => {
    it('muestra un mensaje cuando no hay resultados', async () => {
      getBehaviors.mockResolvedValue(response([], 0));

      await renderPage();

      expect(screen.getByText('No se encontraron comportamientos.')).toBeInTheDocument();
    });
  });

  describe('errores', () => {
    it('ante un error que no es 401 muestra un mensaje inline sin romper la app', async () => {
      getBehaviors.mockRejectedValue(httpError(500));

      await renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar los comportamientos');
      expect(searchInput()).toBeInTheDocument(); // la pantalla sigue viva
      expect(screen.queryByText('No se encontraron comportamientos.')).not.toBeInTheDocument();
    });

    it('también captura errores de red (sin respuesta del servidor)', async () => {
      getBehaviors.mockRejectedValue(new Error('Network Error'));

      await renderPage();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('"Reintentar" vuelve a pedir los datos y limpia el error', async () => {
      getBehaviors.mockRejectedValueOnce(httpError(500));
      await renderPage();

      getBehaviors.mockResolvedValueOnce(response([{ id: 1, name: 'Atacante' }]));
      fireEvent.click(button('Reintentar'));
      await flush();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Atacante')).toBeInTheDocument();
    });

    it('ignora el 401: lo maneja el mecanismo global de autenticación', async () => {
      getBehaviors.mockRejectedValue(httpError(401));

      await renderPage();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // Pegar dentro del describe('Behaviors', ...) de Behaviors.test.jsx,
// por ejemplo justo después del describe('paginación', ...).

  describe('página fuera de rango', () => {
    // Página 1 con datos; cualquier otra página llega vacía.
    const emptyBeyondFirstPage = (name, page) =>
      Promise.resolve(page === 1 ? response(makeItems(50), 120) : response([], 120));

    it('si una página > 1 llega vacía, vuelve a la página 1', async () => {
      getBehaviors.mockImplementation(emptyBeyondFirstPage);
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      await flush();

      expect(getBehaviors).toHaveBeenCalledTimes(3); // carga inicial, página 2, de nuevo página 1
      expect(getBehaviors).toHaveBeenLastCalledWith('', 1, expect.anything());
      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(screen.queryByText('No se encontraron comportamientos.')).not.toBeInTheDocument();
    });

    it.each([400, 404, 422])(
      'un %i en una página > 1 vuelve a la página 1 sin mostrar error',
      async (status) => {
        getBehaviors.mockImplementation((name, page) =>
          page === 1 ? Promise.resolve(response(makeItems(50), 120)) : Promise.reject(httpError(status)),
        );
        await renderPage();

        fireEvent.click(button('Siguiente'));
        await flush();
        await flush();

        expect(getBehaviors).toHaveBeenLastCalledWith('', 1, expect.anything());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      },
    );

    it('un 404 en la página 1 muestra el error y no entra en loop', async () => {
      getBehaviors.mockRejectedValue(httpError(404));

      await renderPage();
      await flush();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(getBehaviors).toHaveBeenCalledTimes(1);
    });

    it('un 500 en una página > 1 muestra el error y "Reintentar" repite esa misma página', async () => {
      getBehaviors.mockResolvedValue(response(makeItems(50), 120));
      await renderPage();

      getBehaviors.mockRejectedValueOnce(httpError(500));
      fireEvent.click(button('Siguiente'));
      await flush();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(getBehaviors).toHaveBeenLastCalledWith('', 2, expect.anything());

      fireEvent.click(button('Reintentar'));
      await flush();

      expect(getBehaviors).toHaveBeenLastCalledWith('', 2, expect.anything());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});