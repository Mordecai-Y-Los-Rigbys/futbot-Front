import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeagueWaitingRoom from './LeagueWaitingRoom';
import useLeagueSocket from '../hooks/useLeagueSocket';
import {
} from '../services/leagueService';

// Servicios y hook falsos: no hay red ni socket de verdad. El hook tiene sus propios tests;
// acá se le dice qué devolver para ver cómo reacciona la pantalla a cada mensaje y cierre.
vi.mock('../hooks/useLeagueSocket');
vi.mock('../services/leagueService');

const CREATOR = { id: 2, username: 'pepe', name: 'Boca Juniors', avatar: 1 };
const ME = { id: 1, username: 'santi', name: 'FC Santi', avatar: 2 };

const makeLeague = (overrides = {}) => ({
  id: 5,
  name: 'Liga del barrio',
  creator: CREATOR,
  status: 'preparation',
  participantsCount: 1,
  maxParticipants: 8,
  minParticipants: 3,
  joined: false,
  private: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});


const retry = vi.fn();

// Lo que devuelve el hook: el último mensaje del canal (lista completa), el estado y el cierre.
const canal = (participants, extra = {}) =>
  useLeagueSocket.mockReturnValue({
    message: { type: 'leagueParticipants', leagueStatus: 'preparation', participants },
    status: 'open',
    closeInfo: null,
    retry,
    ...extra,
  });

// Router real: la navegación se verifica viendo qué pantalla aparece.
function renderRoom(league = makeLeague()) {
  const onLeagueChanged = vi.fn();
  const tree = () => (
    <MemoryRouter initialEntries={['/leagues/5']}>
      <Routes>
        <Route
          path="/leagues/:id"
          element={<LeagueWaitingRoom league={league} onLeagueChanged={onLeagueChanged} />}
        />
        <Route path="/leagues" element={<p>Listado de ligas</p>} />
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>
  );
  const view = render(tree());
  return { onLeagueChanged, rerender: () => view.rerender(tree()) };
}

// Los participantes viven en su propia sección (el creador también aparece en el encabezado).
const seccionParticipantes = () => screen.queryByRole('region', { name: 'Participantes' });

describe('LeagueWaitingRoom', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('lobby', () => {
    it('abre el canal de participantes de la liga', () => {
      canal([CREATOR]);

      renderRoom();

      expect(useLeagueSocket).toHaveBeenCalledWith(5, 'participants');
    });

    it('muestra un indicador de carga hasta recibir el primer mensaje', () => {
      useLeagueSocket.mockReturnValue({ message: null, status: 'connecting', closeInfo: null, retry });

      renderRoom();

      expect(screen.getByRole('status')).toHaveTextContent(/cargando liga/i);
      expect(screen.queryByRole('heading', { name: 'Liga del barrio' })).not.toBeInTheDocument();
    });

    it('muestra la liga, el nombre del club de cada participante (creador incluido) y cuánto falta para el cupo', () => {
      canal([CREATOR, ME]);

      renderRoom();

      expect(screen.getByRole('heading', { name: 'Liga del barrio' })).toBeInTheDocument();
      const seccion = seccionParticipantes();
      expect(within(seccion).getByText(/Boca Juniors/)).toHaveTextContent('(creador)');
      expect(within(seccion).getByText(/FC Santi/)).toBeInTheDocument();
      expect(screen.getByText('Faltan 6 para completar el cupo')).toBeInTheDocument();
      expect(screen.getByText('Mínimo 3')).toBeInTheDocument();
    });

    it('el cupo restante sale de la lista del canal, no del contador de la liga', () => {
      canal([CREATOR, ME]);

      renderRoom(makeLeague({ participantsCount: 7, maxParticipants: 8 }));

      expect(screen.getByText('Faltan 6 para completar el cupo')).toBeInTheDocument();
    });

    it('con la lista llena muestra el cupo completo', () => {
      canal([CREATOR, ME]);

      renderRoom(makeLeague({ maxParticipants: 2 }));

      expect(screen.getByText('Cupo completo')).toBeInTheDocument();
    });

    it('liga privada: muestra un distintivo al lado del nombre', () => {
      canal([CREATOR]);

      renderRoom(makeLeague({ private: true }));

      expect(screen.getByText(/privada/i)).toBeInTheDocument();
    });

    it('liga pública: no muestra el distintivo de privada', () => {
      canal([CREATOR]);

      renderRoom(makeLeague({ private: false }));

      expect(screen.queryByText(/privada/i)).not.toBeInTheDocument();
    });

    it('un mensaje nuevo reemplaza la lista y el cupo, sin recargar', () => {
      canal([CREATOR]);
      const { rerender } = renderRoom();
      expect(screen.getByText('Faltan 7 para completar el cupo')).toBeInTheDocument();

      canal([CREATOR, ME]); // alguien se une
      rerender();
      expect(within(seccionParticipantes()).getByText(/FC Santi/)).toBeInTheDocument();
      expect(screen.getByText('Faltan 6 para completar el cupo')).toBeInTheDocument();

      canal([CREATOR]); // alguien abandona
      rerender();
      expect(within(seccionParticipantes()).queryByText(/FC Santi/)).not.toBeInTheDocument();
      expect(screen.getByText('Faltan 7 para completar el cupo')).toBeInTheDocument();
    });

    it('mientras reconecta lo avisa', () => {
      canal([CREATOR], { status: 'reconnecting' });

      renderRoom();

      expect(screen.getByText('Reconectando…')).toBeInTheDocument();
    });
  });

  describe('cierres del canal', () => {
    it.each([
      [1000, 'leagueStarted'],
      [1000, 'leagueCancelled'],
      [4409, 'leagueNotInPreparation'],
    ])('cierre %i / %s: avisa que la liga cambió para volver a pedirla', (code, reason) => {
      canal([CREATOR], { status: 'closed', closeInfo: { code, reason } });

      const { onLeagueChanged } = renderRoom();

      expect(onLeagueChanged).toHaveBeenCalled();
    });

    it('cierre 4401: redirige al login', async () => {
      useLeagueSocket.mockReturnValue({
        message: null, status: 'closed', closeInfo: { code: 4401, reason: 'sessionInvalid' }, retry,
      });

      renderRoom();

      expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
    });

    it('cierre 4404: redirige al listado de ligas', async () => {
      useLeagueSocket.mockReturnValue({
        message: null, status: 'closed', closeInfo: { code: 4404, reason: 'leagueNotFound' }, retry,
      });

      renderRoom();

      expect(await screen.findByText('Listado de ligas')).toBeInTheDocument();
    });

    it.each([
      [4429, 'tooManyConnections'],
      [4403, 'originNotAllowed'],
      [1006, ''],
    ])('cierre %i / %s: muestra "Sin actualización en vivo" y Reintentar vuelve a conectar', async (code, reason) => {
      canal([CREATOR], { status: 'closed', closeInfo: { code, reason } });

      renderRoom();

      expect(screen.getByText('Sin actualización en vivo')).toBeInTheDocument();
      expect(within(seccionParticipantes()).getByText(/@pepe/)).toBeInTheDocument(); // sigue en el lobby
      await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('un cierre sin haber recibido nunca la lista también muestra "Sin actualización en vivo"', () => {
      useLeagueSocket.mockReturnValue({
        message: null, status: 'closed', closeInfo: { code: 4429, reason: 'tooManyConnections' }, retry,
      });

      renderRoom();

      expect(screen.getByText('Sin actualización en vivo')).toBeInTheDocument();
    });
  });
});
