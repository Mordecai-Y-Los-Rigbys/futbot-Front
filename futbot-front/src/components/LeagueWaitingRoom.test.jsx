import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext.jsx';
import LeagueWaitingRoom from './LeagueWaitingRoom';
import useLeagueSocket from '../hooks/useLeagueSocket';
import {  unlockLeague,
  leaveLeague,
  joinLeague,
} from '../services/leagueService';
import { getPlayers } from '../services/playerService';
import { getBehaviors } from '../services/behaviorService';


// Servicios y hook falsos: no hay red ni socket de verdad. El hook tiene sus propios tests;
// acá se le dice qué devolver para ver cómo reacciona la pantalla a cada mensaje y cierre.
vi.mock('../hooks/useLeagueSocket');
vi.mock('../services/leagueService');
vi.mock('../services/playerService');
vi.mock('../services/behaviorService');

const CREATOR = { id: 2, username: 'pepe', name: 'Boca Juniors', avatar: 1 };
const USER = { id: 1, username: 'santi', clubName: 'FC Santi' };
const ME = { id: 1, username: 'santi', name: 'FC Santi', avatar: 2 };
const PLAYERS = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Jugador ${id}` }));
const PLAYER_BEHAVIORS = [{ id: 10, name: 'Atacar', type: 'playerBehavior' }];

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
// Forma del error que arma axios: la pantalla lee `err.response.status` y `err.response.data.code`.
const httpError = (status, code) => ({ response: { status, data: { code } } });

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
    <AuthContext.Provider value={{ user: USER }}>
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
    </AuthContext.Provider>
  );
  const view = render(tree());
  return { onLeagueChanged, rerender: () => view.rerender(tree()) };
}

// Los participantes viven en su propia sección (el creador también aparece en el encabezado).
const seccionParticipantes = () => screen.queryByRole('region', { name: 'Participantes' });

async function completarEquipo() {
  const jugadores = await screen.findAllByLabelText('Jugador');
  const comportamientos = screen.getAllByLabelText('Comportamiento');
  for (let i = 0; i < 6; i += 1) {
    await userEvent.selectOptions(jugadores[i], String(i + 1));
    await userEvent.selectOptions(comportamientos[i], '10');
  }
}

describe('LeagueWaitingRoom', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPlayers.mockResolvedValue(PLAYERS);
    getBehaviors.mockResolvedValue({ items: PLAYER_BEHAVIORS, page: 1, pageSize: 50, total: 1 });

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
  
  describe('acceso a ligas privadas', () => {
    const sinAcceso = () =>
      useLeagueSocket.mockReturnValue({
        message: null,
        status: 'closed',
        closeInfo: { code: 4403, reason: 'leagueAccessRequired' },
        retry,
      });

    it('cierre 4403 leagueAccessRequired: muestra el nombre de la liga y el formulario, no los participantes', () => {
      sinAcceso();

      renderRoom(makeLeague({ private: true }));

      expect(screen.getByRole('heading', { name: 'Liga del barrio' })).toBeInTheDocument();
      expect(screen.getByLabelText(/contraseña de la liga/i)).toBeInTheDocument();
      expect(seccionParticipantes()).not.toBeInTheDocument();
      expect(screen.queryByText('Sin actualización en vivo')).not.toBeInTheDocument();
    });

    it('con la contraseña correcta desbloquea la liga y vuelve a conectar el canal', async () => {
      sinAcceso();
      unlockLeague.mockResolvedValue(undefined);

      renderRoom(makeLeague({ private: true }));
      await userEvent.type(screen.getByLabelText(/contraseña de la liga/i), 'secreta');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      await vi.waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
      expect(unlockLeague).toHaveBeenCalledWith(5, { password: 'secreta' });
    });

    it('con una contraseña incorrecta sigue en el formulario y no reconecta', async () => {
      sinAcceso();
      unlockLeague.mockRejectedValue(httpError(403, 'invalidLeaguePassword'));

      renderRoom(makeLeague({ private: true }));
      await userEvent.type(screen.getByLabelText(/contraseña de la liga/i), 'mala');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      expect(await screen.findByText('Contraseña incorrecta')).toBeInTheDocument();
      expect(retry).not.toHaveBeenCalled();
    });

    it('"Volver" lleva al listado de ligas', async () => {
      sinAcceso();

      renderRoom(makeLeague({ private: true }));
      await userEvent.click(screen.getByRole('button', { name: 'Volver' }));

      expect(await screen.findByText('Listado de ligas')).toBeInTheDocument();
    });

    it('un cierre 4403 con otro motivo no muestra el formulario', () => {
      useLeagueSocket.mockReturnValue({
        message: null, status: 'closed', closeInfo: { code: 4403, reason: 'originNotAllowed' }, retry,
      });

      renderRoom(makeLeague({ private: true }));

      expect(screen.queryByLabelText(/contraseña de la liga/i)).not.toBeInTheDocument();
      expect(screen.getByText('Sin actualización en vivo')).toBeInTheDocument();
    });

    it('con acceso (creador, participante o ya desbloqueada) entra directo, sin formulario', () => {
      canal([CREATOR]);

      renderRoom(makeLeague({ private: true }));

      expect(seccionParticipantes()).toBeInTheDocument();
      expect(screen.queryByLabelText(/contraseña de la liga/i)).not.toBeInTheDocument();
      expect(unlockLeague).not.toHaveBeenCalled();
    });
  });

});
  describe('abandonar', () => {
    it('el botón se ve solo para quien participa y no es el creador', () => {
      canal([CREATOR, ME]);

      renderRoom();

      expect(screen.getByRole('button', { name: /abandonar liga/i })).toBeInTheDocument();
    });

    it('el creador no ve el botón para abandonar', () => {
      canal([ME]);

      renderRoom(makeLeague({ creator: ME }));

      expect(screen.getByText(/sos el creador de la liga/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /abandonar liga/i })).not.toBeInTheDocument();
    });

    it('quien no está en la lista no ve el botón para abandonar', () => {
      canal([CREATOR]);

      renderRoom();

      expect(screen.queryByRole('button', { name: /abandonar liga/i })).not.toBeInTheDocument();
    });

    it('al hacer clic abre un modal de confirmación y todavía no llama a la API', async () => {
      canal([CREATOR, ME]);

      renderRoom();
      await userEvent.click(screen.getByRole('button', { name: /abandonar liga/i }));

      const modal = screen.getByRole('dialog', { name: /abandonar liga/i });
      expect(within(modal).getByText('¿Estás seguro que deseas abandonar esta liga?')).toBeInTheDocument();
      expect(leaveLeague).not.toHaveBeenCalled();
    });

    it('cancelar cierra el modal y no abandona', async () => {
      canal([CREATOR, ME]);

      renderRoom();
      await userEvent.click(screen.getByRole('button', { name: /abandonar liga/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(leaveLeague).not.toHaveBeenCalled();
    });

    it('al confirmar llama a la API con carga en el botón, avisa y vuelve al listado', async () => {
      canal([CREATOR, ME]);
      let terminar;
      leaveLeague.mockReturnValue(new Promise((resolve) => { terminar = resolve; }));

      renderRoom();
      await userEvent.click(screen.getByRole('button', { name: /abandonar liga/i }));
      await userEvent.click(screen.getByRole('button', { name: /sí, abandonar/i }));

      // Mientras espera: botón deshabilitado con carga, para evitar múltiples clics.
      const botonCargando = await screen.findByRole('button', { name: /abandonando/i });
      expect(botonCargando).toBeDisabled();
      expect(leaveLeague).toHaveBeenCalledWith(5);

      terminar();

      expect(await screen.findByText(/abandonaste la liga/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByText('Listado de ligas', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(leaveLeague).toHaveBeenCalledTimes(1);
    });

    it('si el servidor responde 409, muestra el motivo y cierra el modal', async () => {
      canal([CREATOR, ME]);
      leaveLeague.mockRejectedValue(httpError(409, 'notInPreparation'));

      renderRoom();
      await userEvent.click(screen.getByRole('button', { name: /abandonar liga/i }));
      await userEvent.click(screen.getByRole('button', { name: /sí, abandonar/i }));

      expect(await screen.findByText(/ya no está en preparación: no se puede abandonar/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('si falla la conexión, muestra un mensaje sin romper la pantalla', async () => {
      canal([CREATOR, ME]);
      leaveLeague.mockRejectedValue(new Error('Network Error'));

      renderRoom();
      await userEvent.click(screen.getByRole('button', { name: /abandonar liga/i }));
      await userEvent.click(screen.getByRole('button', { name: /sí, abandonar/i }));

      expect(await screen.findByText(/no pudimos abandonar la liga/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Liga del barrio' })).toBeInTheDocument();
    });
  });

  describe('unirse', () => {
    it('ofrece unirse si no estás en la lista, y el modal se abre', async () => {
      canal([CREATOR]);

      renderRoom();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /unirse a la liga/i }));

      expect(await screen.findByRole('dialog', { name: /unirse a liga del barrio/i })).toBeInTheDocument();
    });

    it('con el cupo lleno esconde el botón de unirse y avisa que la liga está llena', () => {
      const OTRO = { id: 3, username: 'luli', name: 'River', avatar: 1 };
      canal([CREATOR, OTRO]);

      renderRoom(makeLeague({ maxParticipants: 2 }));

      expect(screen.getByText('La liga está llena.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /unirse a la liga/i })).not.toBeInTheDocument();
    });

    it('si ya participás no se ofrece unirse', () => {
      canal([CREATOR, ME]);

      renderRoom();

      expect(screen.queryByRole('button', { name: /unirse a la liga/i })).not.toBeInTheDocument();
    });

    it('en una liga privada el modal pide la contraseña', async () => {
      canal([CREATOR]);

      renderRoom(makeLeague({ private: true }));
      await userEvent.click(screen.getByRole('button', { name: /unirse a la liga/i }));

      const modal = await screen.findByRole('dialog');
      expect(await within(modal).findByLabelText(/contraseña de la liga/i)).toBeInTheDocument();
    });

    it('al inscribirse cierra el modal, avisa y la lista nueva del canal refleja al club como participante', async () => {
      canal([CREATOR]);
      joinLeague.mockResolvedValue(undefined);

      const { rerender } = renderRoom();
      await userEvent.click(screen.getByRole('button', { name: /unirse a la liga/i }));
      await completarEquipo();
      await userEvent.click(screen.getByRole('button', { name: /confirmar inscripción/i }));

      expect(await screen.findByText('¡Te uniste a la liga!')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(joinLeague).toHaveBeenCalledTimes(1);

      // El canal manda la lista con el club inscripto: no hace falta recargar nada.
      canal([CREATOR, ME]);
      rerender();
      expect(within(seccionParticipantes()).getByText(/@santi/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /abandonar liga/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /unirse a la liga/i })).not.toBeInTheDocument();
    });
  });

