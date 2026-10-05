import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JoinFriendly from './JoinFriendly';
import { getPlayers } from '../services/playerService';
import { getBehaviors } from '../services/behaviorService';
import { joinFriendlyMatch } from '../services/friendlyService';

vi.mock('../services/playerService', () => ({
  getPlayers: vi.fn(),
}));

vi.mock('../services/behaviorService', () => ({
  getBehaviors: vi.fn(),
}));

vi.mock('../services/friendlyService', () => ({
  joinFriendlyMatch: vi.fn(),
}));

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    useParams: () => ({ id: '10' }),
  };
});

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const mockPlayers = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Jugador ${i + 1}` }));
const mockBehaviors = [{ id: 101, name: 'Ofensivo' }, { id: 102, name: 'Defensivo' }];

const renderPage = async () => {
  render(
    <MemoryRouter initialEntries={['/friendlies/10/join']}>
      <Routes>
        <Route path="/friendlies/:id/join" element={<JoinFriendly />} />
      </Routes>
    </MemoryRouter>,
  );
  await flush();
};

const button = (name) => screen.getByRole('button', { name });

const fillValidTeam = () => {
  for (let i = 0; i < 6; i++) {
    fireEvent.change(screen.getByLabelText(/Jugador/i, { selector: `#player-${i}` }), {
      target: { value: String(i + 1) },
    });
    fireEvent.change(screen.getByLabelText(/Comportamiento/i, { selector: `#behavior-${i}` }), {
      target: { value: '101' },
    });
  }
};

describe('JoinFriendly (SCRUM-48)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedNavigate.mockReset();
    getPlayers.mockReset().mockResolvedValue(mockPlayers);
    getBehaviors.mockReset().mockResolvedValue({ items: mockBehaviors, total: 2 });
    joinFriendlyMatch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validación del formulario', () => {
    it('mantiene el botón deshabilitado hasta tener 6 jugadores únicos y comportamientos', async () => {
      await renderPage();
      const submitBtn = button('Confirmar y Unirse');

      expect(submitBtn).toBeDisabled();

      for (let i = 0; i < 5; i++) {
        fireEvent.change(screen.getByLabelText(/Jugador/i, { selector: `#player-${i}` }), {
          target: { value: String(i + 1) },
        });
        fireEvent.change(screen.getByLabelText(/Comportamiento/i, { selector: `#behavior-${i}` }), {
          target: { value: '101' },
        });
      }
      fireEvent.change(screen.getByLabelText(/Jugador/i, { selector: '#player-5' }), {
        target: { value: '1' },
      });
      fireEvent.change(screen.getByLabelText(/Comportamiento/i, { selector: '#behavior-5' }), {
        target: { value: '101' },
      });

      expect(submitBtn).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/Jugador/i, { selector: '#player-5' }), {
        target: { value: '6' },
      });
      expect(submitBtn).toBeEnabled();
    });
  });

  describe('respuesta exitosa', () => {
    it('envía los 6 miembros (200 OK) y redirige al partido con el matchId', async () => {
      joinFriendlyMatch.mockResolvedValue({ id: 10, matchId: 99, status: 'started' });
      await renderPage();

      fillValidTeam();
      fireEvent.click(button('Confirmar y Unirse'));
      await flush();

      expect(joinFriendlyMatch).toHaveBeenCalledTimes(1);
      expect(joinFriendlyMatch).toHaveBeenCalledWith(
        '10',
        expect.arrayContaining([
          expect.objectContaining({ playerId: 1, role: 'forward', behaviorId: 101 }),
          expect.objectContaining({ playerId: 2, role: 'midfield', behaviorId: 101 }),
          expect.objectContaining({ playerId: 3, role: 'defense', behaviorId: 101 }),
        ]),
      );
      expect(mockedNavigate).toHaveBeenCalledWith('/matches/99');
    });
  });

  describe('errores del servidor', () => {
    it('notWaiting (409): muestra alerta y vuelve a /friendlies', async () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      joinFriendlyMatch.mockRejectedValue(httpError(409, { code: 'notWaiting' }));
      await renderPage();

      fillValidTeam();
      fireEvent.click(button('Confirmar y Unirse'));
      await flush();

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('El partido ya no admite rival'));
      expect(mockedNavigate).toHaveBeenCalledWith('/friendlies');
    });

    it.each([
      [409, 'isOwnMatch', 'No puedes unirte a un partido creado por ti mismo.'],
      [409, 'alreadyPlaying', 'Ya te encuentras disputando otro partido.'],
      [409, 'playerOrBehaviorNotOwned', 'Alguno de los jugadores o comportamientos seleccionados no te pertenece.'],
      [400, null, 'Alineación inválida.'],
      [404, null, 'El partido amistoso no existe.'],
    ])('con error %i y código %s muestra mensaje en pantalla', async (status, code, text) => {
      joinFriendlyMatch.mockRejectedValue(httpError(status, { code, message: text }));
      await renderPage();

      fillValidTeam();
      fireEvent.click(button('Confirmar y Unirse'));
      await flush();

      expect(screen.getByText(new RegExp(text, 'i'))).toBeInTheDocument();
      expect(button('Confirmar y Unirse')).toBeEnabled();
    });
  });
});
