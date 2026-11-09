import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ranking from './Ranking';
import { getGlobalRanking } from '../services/rankingService';

vi.mock('../services/rankingService', () => ({
  getGlobalRanking: vi.fn(),
}));

// Avatar 1 existe; el resto cae en la inicial del club.
vi.mock('../utils/avatars', () => ({
  getAvatarSrc: (n) => (Number(n) === 1 ? '/avatar-1.webp' : null),
}));

const makeEntry = (overrides = {}) => ({
  position: 1,
  name: 'Boca Juniors',
  avatar: 1,
  score: 11,
  goalDifference: 4,
  goals: 9,
  wonRegular: 3,
  wonPenalties: 1,
  lost: 2,
  ...overrides,
});

const makeEntries = (n) =>
  Array.from({ length: n }, (_, i) => makeEntry({ position: i + 1, name: `Club ${i + 1}` }));

const response = (items, total = items.length) => ({ items, page: 1, pageSize: 50, total });

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

// Avanza el reloj falso y deja resolver las promesas pendientes.
const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const renderPage = async () => {
  const utils = render(<Ranking />);
  await flush();
  return utils;
};

const searchInput = () => screen.getByLabelText('Buscar por nombre de club');
const button = (name) => screen.getByRole('button', { name });
const pending = () => new Promise(() => {});

// Filas del cuerpo de la tabla (sin la fila de encabezados).
const bodyRows = () => screen.getAllByRole('row').slice(1);
const positions = () => bodyRows().map((row) => row.querySelector('td').textContent);
const clubNames = (container) =>
  [...container.querySelectorAll('.ranking__name')].map((node) => node.textContent);

describe('Ranking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getGlobalRanking.mockReset();
    getGlobalRanking.mockResolvedValue(response(makeEntries(3)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('carga inicial', () => {
    it('pide el ranking sin nombre y en la página 1', async () => {
      await renderPage();

      expect(getGlobalRanking).toHaveBeenCalledTimes(1);
      expect(getGlobalRanking).toHaveBeenCalledWith('', 1, expect.anything());
    });

    it('muestra un indicador de carga mientras espera la respuesta', async () => {
      getGlobalRanking.mockReturnValue(pending());

      await renderPage();

      expect(screen.getByRole('status')).toHaveTextContent('Cargando ranking');
    });
  });

  describe('renderizado de columnas', () => {
    it('muestra los encabezados Puesto, Club, P, DG, Goles, PG, PGP y PP', async () => {
      await renderPage();

      const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
      expect(headers).toEqual(['Puesto', 'Club', 'P', 'DG', 'Goles', 'PG', 'PGP', 'PP']);
    });

    it('muestra en cada columna el valor que corresponde', async () => {
      getGlobalRanking.mockResolvedValue(
        response([
          makeEntry({
            position: 7,
            name: 'River Plate',
            score: 22,
            goalDifference: -3,
            goals: 15,
            wonRegular: 6,
            wonPenalties: 2,
            lost: 4,
          }),
        ]),
      );

      await renderPage();

      const cells = [...bodyRows()[0].querySelectorAll('td')].map((td) => td.textContent);
      expect(cells).toEqual(['7', 'River Plate', '22', '-3', '15', '6', '2', '4']);
    });

    it('muestra el avatar con getAvatarSrc y una inicial si no hay imagen', async () => {
      getGlobalRanking.mockResolvedValue(
        response([
          makeEntry({ position: 1, name: 'Boca', avatar: 1 }),
          makeEntry({ position: 2, name: 'River', avatar: 9 }),
        ]),
      );

      const { container } = await renderPage();

      const images = container.querySelectorAll('img.ranking__avatar');
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute('src', '/avatar-1.webp');
      expect(container.querySelector('.ranking__avatar--fallback')).toHaveTextContent('R');
    });
  });

  describe('orden y posiciones', () => {
    it('respeta el orden recibido, sin reordenar en el cliente', async () => {
      getGlobalRanking.mockResolvedValue(
        response([
          makeEntry({ position: 1, name: 'Zeta', score: 1 }),
          makeEntry({ position: 2, name: 'Alfa', score: 50 }),
          makeEntry({ position: 3, name: 'Medio', score: 20 }),
        ]),
      );

      const { container } = await renderPage();

      expect(clubNames(container)).toEqual(['Zeta', 'Alfa', 'Medio']);
    });

    it('muestra el position del back: los empatados comparten puesto (1, 2, 2, 4)', async () => {
      getGlobalRanking.mockResolvedValue(
        response([
          makeEntry({ position: 1, name: 'A' }),
          makeEntry({ position: 2, name: 'B' }),
          makeEntry({ position: 2, name: 'C' }),
          makeEntry({ position: 4, name: 'D' }),
        ]),
      );

      await renderPage();

      expect(positions()).toEqual(['1', '2', '2', '4']);
    });

    it('con una búsqueda activa conserva el position del ranking completo', async () => {
      await renderPage();

      getGlobalRanking.mockResolvedValue(response([makeEntry({ position: 40, name: 'Club 40' })]));
      fireEvent.change(searchInput(), { target: { value: 'Club 40' } });
      await flush(400);

      expect(positions()).toEqual(['40']);
    });
  });

  describe('lista vacía', () => {
    it('sin búsqueda muestra un mensaje de que todavía no hay clubes', async () => {
      getGlobalRanking.mockResolvedValue(response([], 0));

      await renderPage();

      expect(screen.getByText('Todavía no hay clubes en el ranking')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('si la búsqueda no matchea ningún club muestra un mensaje distinto', async () => {
      await renderPage();

      getGlobalRanking.mockResolvedValue(response([], 0));
      fireEvent.change(searchInput(), { target: { value: 'zzz' } });
      await flush(400);

      expect(
        screen.getByText('No se encontraron clubes que coincidan con la búsqueda'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Todavía no hay clubes en el ranking')).not.toBeInTheDocument();
    });
  });

  describe('errores', () => {
    it('ante un error que no es 401 muestra un mensaje sin romper la página', async () => {
      getGlobalRanking.mockRejectedValue(httpError(500));

      await renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar el ranking');
      expect(searchInput()).toBeInTheDocument(); // la pantalla sigue viva
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText('Todavía no hay clubes en el ranking')).not.toBeInTheDocument();
    });

    it('también captura errores de red (sin respuesta del servidor)', async () => {
      getGlobalRanking.mockRejectedValue(new Error('Network Error'));

      await renderPage();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('"Reintentar" vuelve a pedir los datos y limpia el error', async () => {
      getGlobalRanking.mockRejectedValueOnce(httpError(500));
      await renderPage();

      getGlobalRanking.mockResolvedValueOnce(response([makeEntry({ name: 'Recuperado' })]));
      fireEvent.click(button('Reintentar'));
      await flush();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Recuperado')).toBeInTheDocument();
    });

    it('ignora el 401: no muestra error, ni lista vacía, ni queda cargando', async () => {
      getGlobalRanking.mockRejectedValue(httpError(401));

      await renderPage();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText('Todavía no hay clubes en el ranking')).not.toBeInTheDocument();
    });
  });

  describe('búsqueda', () => {
    it('no llama a la API en cada tecla: espera 400ms desde la última', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'a' } });
      await flush(200);
      fireEvent.change(searchInput(), { target: { value: 'ab' } });
      await flush(399);

      expect(getGlobalRanking).toHaveBeenCalledTimes(1); // solo la carga inicial

      await flush(1);

      expect(getGlobalRanking).toHaveBeenCalledTimes(2);
      expect(getGlobalRanking).toHaveBeenLastCalledWith('ab', 1, expect.anything());
    });

    it('vuelve a la página 1 al buscar y manda el name', async () => {
      getGlobalRanking.mockResolvedValue(response(makeEntries(50), 120));
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getGlobalRanking).toHaveBeenLastCalledWith('', 2, expect.anything());

      fireEvent.change(searchInput(), { target: { value: 'x' } });
      await flush(400);

      expect(getGlobalRanking).toHaveBeenLastCalledWith('x', 1, expect.anything());
    });

    it('si el campo queda vacío no manda name y se ve el ranking completo', async () => {
      await renderPage();
      fireEvent.change(searchInput(), { target: { value: 'x' } });
      await flush(400);

      fireEvent.change(searchInput(), { target: { value: '' } });
      await flush(400);

      expect(getGlobalRanking).toHaveBeenLastCalledWith('', 1, expect.anything());
    });

    it('Enter dispara la búsqueda sin esperar al timer, y el timer no la repite', async () => {
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'def' } });
      fireEvent.keyDown(searchInput(), { key: 'Enter' });
      await flush();

      expect(getGlobalRanking).toHaveBeenCalledTimes(2);
      expect(getGlobalRanking).toHaveBeenLastCalledWith('def', 1, expect.anything());

      await flush(400);

      expect(getGlobalRanking).toHaveBeenCalledTimes(2);
    });

    it('cancela la request anterior cuando arranca una nueva', async () => {
      const signals = [];
      getGlobalRanking.mockImplementation((name, page, { signal }) => {
        signals.push(signal);
        return Promise.resolve(response(makeEntries(3)));
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
    it('no muestra los controles si hay 50 clubes o menos', async () => {
      getGlobalRanking.mockResolvedValue(response(makeEntries(50), 50));

      await renderPage();

      expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    });

    it('calcula las páginas con total y pageSize, y deshabilita "Anterior" en la primera', async () => {
      getGlobalRanking.mockResolvedValue(response(makeEntries(50), 120));

      await renderPage();

      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(button('Anterior')).toBeDisabled();
      expect(button('Siguiente')).toBeEnabled();
    });

    it('navega entre páginas, respeta los límites y manda page', async () => {
      getGlobalRanking.mockResolvedValue(response(makeEntries(50), 120));
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(getGlobalRanking).toHaveBeenLastCalledWith('', 2, expect.anything());
      expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();

      fireEvent.click(button('Siguiente'));
      await flush();
      expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
      expect(button('Siguiente')).toBeDisabled(); // última página

      fireEvent.click(button('Anterior'));
      await flush();
      expect(getGlobalRanking).toHaveBeenLastCalledWith('', 2, expect.anything());
    });

    it('al cambiar de página conserva el name activo', async () => {
      getGlobalRanking.mockResolvedValue(response(makeEntries(50), 120));
      await renderPage();

      fireEvent.change(searchInput(), { target: { value: 'club' } });
      await flush(400);
      fireEvent.click(button('Siguiente'));
      await flush();

      expect(getGlobalRanking).toHaveBeenLastCalledWith('club', 2, expect.anything());
    });

    it('con filtro activo el total de páginas refleja los clubes que matchean', async () => {
      getGlobalRanking.mockResolvedValue(response(makeEntries(50), 120));
      await renderPage();
      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();

      getGlobalRanking.mockResolvedValue(response(makeEntries(60), 60));
      fireEvent.change(searchInput(), { target: { value: 'club' } });
      await flush(400);

      expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    });

    it('si una página > 1 llega vacía, vuelve a la página 1', async () => {
      getGlobalRanking.mockImplementation((name, page) =>
        Promise.resolve(page === 1 ? response(makeEntries(50), 120) : response([], 120)),
      );
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      await flush();

      expect(getGlobalRanking).toHaveBeenLastCalledWith('', 1, expect.anything());
      expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
      expect(screen.queryByText('Todavía no hay clubes en el ranking')).not.toBeInTheDocument();
    });

    it('un 400 en una página > 1 vuelve a la 1 sin mostrar error; en la 1 muestra el error sin loop', async () => {
      getGlobalRanking.mockImplementation((name, page) =>
        page === 1 ? Promise.resolve(response(makeEntries(50), 120)) : Promise.reject(httpError(400)),
      );
      await renderPage();

      fireEvent.click(button('Siguiente'));
      await flush();
      await flush();

      expect(getGlobalRanking).toHaveBeenLastCalledWith('', 1, expect.anything());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});