import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Leagues from './Leagues';
import { getLeagues } from '../services/leagueService';

vi.mock('../services/leagueService', () => ({
  getLeagues: vi.fn(),
  PAGE_SIZE: 50,
}));

const makeLeague = (overrides = {}) => ({
  id: 1,
  name: 'Liga Uno',
  creator: { id: 10, username: 'pepe', name: 'Boca Juniors FC' },
  status: 'preparation',
  participantsCount: 8,
  maxParticipants: 16,
  private: false,
  createdAt: '2026-01-15T10:00:00Z',
  ...overrides,
});

const makeLeagues = (n) =>
  Array.from({ length: n }, (_, i) => makeLeague({ id: i + 1, name: `Liga ${i + 1}` }));

const response = (items, total = items.length) => ({ items, page: 1, pageSize: 50, total });

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

// Avanza el reloj falso y deja resolver las promesas pendientes.
const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function DetailStub() {
  const { id } = useParams();
  return <p>DETALLE LIGA {id}</p>;
}

const renderPage = async () => {
  render(
    <MemoryRouter initialEntries={['/leagues']}>
      <Routes>
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/leagues/create" element={<p>PANTALLA CREAR LIGA</p>} />
        <Route path="/leagues/:id" element={<DetailStub />} />
      </Routes>
    </MemoryRouter>,
  );
  await flush();
};

const searchInput = () => screen.getByLabelText('Buscar por nombre');
const button = (name) => screen.getByRole('button', { name });
const pending = () => new Promise(() => {});

describe('Leagues', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getLeagues.mockReset();
    getLeagues.mockResolvedValue(response(makeLeagues(3)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('carga inicial', () => {
    it('llama a getLeagues con nombre vacío y página 1', async () => {
      await renderPage();

      expect(getLeagues).toHaveBeenCalledTimes(1);
      expect(getLeagues).toHaveBeenCalledWith('', 1, expect.anything());
    });

    it('muestra un indicador de carga mientras espera la respuesta', async () => {
      getLeagues.mockReturnValue(pending());

      await renderPage();

      expect(screen.getByRole('status')).toHaveTextContent('Cargando ligas');
    });
  });

  describe('contenido de cada fila', () => {
    it('muestra nombre, creador, estado y capacidad combinada', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ name: 'Copa del Barrio' })]));

      await renderPage();

      expect(screen.getByText('Copa del Barrio')).toBeInTheDocument();
      expect(screen.getByText('Boca Juniors FC · @pepe')).toBeInTheDocument();
      expect(screen.getByText('En preparación')).toBeInTheDocument();
      // Un solo dato "8/16", nunca dos valores separados.
      expect(screen.getByText('8/16')).toBeInTheDocument();
    });

    it('no muestra el id ni la fecha de creación', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ id: 777, createdAt: '2026-03-09T10:00:00Z' })]));

      await renderPage();

      expect(screen.queryByText('777')).not.toBeInTheDocument();
      expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
    });

    it.each([
      ['preparation', 'En preparación'],
      ['started', 'En curso'],
      ['cancelled', 'Cancelada'],
      ['finished', 'Finalizada'],
    ])('traduce el estado "%s" a "%s"', async (status, text) => {
      getLeagues.mockResolvedValue(response([makeLeague({ status })]));

      await renderPage();

      expect(screen.getByText(text)).toBeInTheDocument();
    });

    it('una liga privada muestra un candado con texto alternativo "Privada"', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ private: true })]));

      await renderPage();

      const lock = screen.getByRole('img', { name: 'Privada' });
      expect(lock).toHaveTextContent('🔒');
      expect(lock).toHaveAttribute('title', 'Privada');
      expect(screen.queryByRole('img', { name: 'Pública' })).not.toBeInTheDocument();
    });

    it('una liga pública muestra un candado abierto con texto alternativo "Pública"', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ private: false })]));

      await renderPage();

      const lock = screen.getByRole('img', { name: 'Pública' });
      expect(lock).toHaveTextContent('🔓');
      expect(lock).toHaveAttribute('title', 'Pública');
    });

    it('el texto alternativo del candado no se muestra como texto visible', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ private: true })]));

      await renderPage();

      expect(screen.queryByText('Privada')).not.toBeInTheDocument();
    });
  });

  describe('navegación al detalle', () => {
    it('ofrece acceso a la pantalla para crear una liga', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('link', { name: 'Crear Liga' }));

      expect(screen.getByText('PANTALLA CREAR LIGA')).toBeInTheDocument();
    });

    it('hacer clic en una fila navega a /leagues/{id}', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ id: 7, name: 'Liga Siete' })]));
      await renderPage();

      fireEvent.click(screen.getByRole('link', { name: /Liga Siete/ }));

      expect(screen.getByText('DETALLE LIGA 7')).toBeInTheDocument();
    });

    it('la fila se puede activar con teclado: tiene foco y responde a Enter', async () => {
      getLeagues.mockResolvedValue(response([makeLeague({ id: 9, name: 'Liga Nueve' })]));
      await renderPage();

      const row = screen.getByRole('link', { name: /Liga Nueve/ });
      expect(row).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(row, { key: 'Enter' });

      expect(screen.getByText('DETALLE LIGA 9')).toBeInTheDocument();
    });

    it('no hay ninguna acción de unirse en el listado', async () => {
      await renderPage();

      expect(screen.queryByRole('button', { name: /unirse/i })).not.toBeInTheDocument();
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

      expect(getLeagues).toHaveBeenCalledTimes(1); // solo la carga inicial

      await flush(1);

      expect(getLeagues).toHaveBeenCalledTimes(2);
      expect(getLeagues).toHaveBeenLastCalledWith('abc', 1, expect.anything());
    });

    it('actualiza el input al instante, sin esperar al debounce', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'hola' } });

      expect(searchInput()).toHaveValue('hola');
      expect(getLeagues).toHaveBeenCalledTimes(1);
    });

    it('aplica trim al texto antes de buscar', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: '  copa  ' } });
      await flush(400);

      expect(getLeagues).toHaveBeenLastCalledWith('copa', 1, expect.anything());
    });

    it('un texto de solo espacios no dispara ninguna búsqueda', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: '   ' } });
      await flush(400);

      expect(getLeagues).toHaveBeenCalledTimes(1);
    });

    it('no vuelve a consultar si el texto efectivo (con trim) no cambió', async () => {
      await renderPage();
      fireEvent.change(searchInput(), { target: { value: 'copa' } });
      await flush(400);
      expect(getLeagues).toHaveBeenCalledTimes(2);

      fireEvent.change(searchInput(), { target: { value: 'copa ' } });
      await flush(400);

      expect(getLeagues).toHaveBeenCalledTimes(2);
    });

    it('vuelve a la página 1 al disparar una búsqueda nueva', async () => {
      getLeagues.mockResolvedValue(response(makeLeagues(50), 120));
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getLeagues).toHaveBeenLastCalledWith('', 2, expect.anything());

      fireEvent.change(searchInput(), { target: { value: 'x' } });
      await flush(400);

      expect(getLeagues).toHaveBeenLastCalledWith('x', 1, expect.anything());
    });

    it('Enter dispara la búsqueda sin esperar al timer, y el timer no la repite', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'def' } });
      fireEvent.keyDown(searchInput(), { key: 'Enter' });
      await flush();

      expect(getLeagues).toHaveBeenCalledTimes(2);
      expect(getLeagues).toHaveBeenLastCalledWith('def', 1, expect.anything());

      await flush(400);

      expect(getLeagues).toHaveBeenCalledTimes(2);
    });

    it('Enter con el mismo texto vuelve a consultar a la API', async () => {
      await renderPage();

      fireEvent.keyDown(searchInput(), { key: 'Enter' });
      await flush();

      expect(getLeagues).toHaveBeenCalledTimes(2);
      expect(getLeagues).toHaveBeenLastCalledWith('', 1, expect.anything());
    });

    it('cancela la request anterior cuando arranca una nueva', async () => {
      const signals = [];
      getLeagues.mockImplementation((name, page, { signal }) => {
        signals.push(signal);
        return Promise.resolve(response(makeLeagues(3)));
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
      getLeagues.mockResolvedValue(response(makeLeagues(50), 50));

      await renderPage();

      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    });

    it('en la primera página deshabilita "Anterior" y habilita "Siguiente"', async () => {
      getLeagues.mockResolvedValue(response(makeLeagues(50), 120));

      await renderPage();

      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(button('Anterior')).toBeDisabled();
      expect(button('Siguiente')).toBeEnabled();
    });

    it('navega entre páginas y respeta los límites', async () => {
      getLeagues.mockResolvedValue(response(makeLeagues(50), 120));
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getLeagues).toHaveBeenLastCalledWith('', 2, expect.anything());
      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
      expect(button('Anterior')).toBeEnabled();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getLeagues).toHaveBeenLastCalledWith('', 3, expect.anything());
      expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
      expect(button('Siguiente')).toBeDisabled(); // última página

      fireEvent.click(button('Anterior'));
      await flush();
      expect(getLeagues).toHaveBeenLastCalledWith('', 2, expect.anything());
    });

    it('mientras carga una página, los botones están deshabilitados y la lista queda atenuada', async () => {
      getLeagues.mockResolvedValueOnce(response(makeLeagues(50), 120)).mockReturnValueOnce(pending());
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();

      expect(button('Anterior')).toBeDisabled();
      expect(button('Siguiente')).toBeDisabled();
      expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('lista vacía', () => {
    it('sin búsqueda muestra "No hay ligas disponibles en este momento"', async () => {
      getLeagues.mockResolvedValue(response([], 0));

      await renderPage();

      expect(screen.getByText('No hay ligas disponibles en este momento')).toBeInTheDocument();
      expect(screen.queryByText(/No se encontraron ligas/)).not.toBeInTheDocument();
    });

    it('con búsqueda muestra "No se encontraron ligas que coincidan con la búsqueda"', async () => {
      await renderPage();

      getLeagues.mockResolvedValue(response([], 0));
      fireEvent.change(searchInput(), { target: { value: 'zzz' } });
      await flush(400);

      expect(
        screen.getByText('No se encontraron ligas que coincidan con la búsqueda'),
      ).toBeInTheDocument();
      expect(screen.queryByText('No hay ligas disponibles en este momento')).not.toBeInTheDocument();
    });
  });

  describe('página fuera de rango', () => {
    it('si una página > 1 llega vacía, vuelve a la página 1 sin mostrar mensaje de vacío', async () => {
      getLeagues.mockImplementation((name, page) =>
        Promise.resolve(page === 1 ? response(makeLeagues(50), 120) : response([], 120)),
      );
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      await flush();

      expect(getLeagues).toHaveBeenCalledTimes(3); // carga inicial, página 2, de nuevo página 1
      expect(getLeagues).toHaveBeenLastCalledWith('', 1, expect.anything());
      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(screen.queryByText('No hay ligas disponibles en este momento')).not.toBeInTheDocument();
    });

    it('un 400 en una página > 1 vuelve a la página 1 sin mostrar error', async () => {
      getLeagues.mockImplementation((name, page) =>
        page === 1 ? Promise.resolve(response(makeLeagues(50), 120)) : Promise.reject(httpError(400)),
      );
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      await flush();

      expect(getLeagues).toHaveBeenLastCalledWith('', 1, expect.anything());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    });

    it('un 400 en la página 1 muestra el error y no entra en loop', async () => {
      getLeagues.mockRejectedValue(httpError(400));

      await renderPage();
      await flush();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(getLeagues).toHaveBeenCalledTimes(1);
    });
  });

  describe('errores', () => {
    it('ante un error que no es 401 muestra un mensaje inline sin romper la app', async () => {
      getLeagues.mockRejectedValue(httpError(500));

      await renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las ligas');
      expect(searchInput()).toBeInTheDocument(); // la pantalla sigue viva
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
      expect(screen.queryByText(/No hay ligas disponibles/)).not.toBeInTheDocument();
    });

    it('también captura errores de red (sin respuesta del servidor)', async () => {
      getLeagues.mockRejectedValue(new Error('Network Error'));

      await renderPage();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('"Reintentar" vuelve a pedir los datos y limpia el error', async () => {
      getLeagues.mockRejectedValueOnce(httpError(500));
      await renderPage();

      getLeagues.mockResolvedValueOnce(response([makeLeague({ name: 'Liga Recuperada' })]));
      fireEvent.click(button('Reintentar'));
      await flush();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Liga Recuperada')).toBeInTheDocument();
    });

    it('ignora el 401: no muestra error, ni lista vacía, ni queda cargando', async () => {
      getLeagues.mockRejectedValue(httpError(401));

      await renderPage();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(/No hay ligas disponibles/)).not.toBeInTheDocument();
      expect(screen.queryByText(/No se encontraron ligas/)).not.toBeInTheDocument();
    });
  });
});