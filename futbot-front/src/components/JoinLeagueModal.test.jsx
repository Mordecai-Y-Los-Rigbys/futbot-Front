import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JoinLeagueModal from './JoinLeagueModal';
import { getBehaviors } from '../services/behaviorService';
import { joinLeague } from '../services/leagueService';
import { getPlayers } from '../services/playerService';

// Servicios falsos: ninguna petición sale de verdad.
vi.mock('../services/leagueService');
vi.mock('../services/playerService');
vi.mock('../services/behaviorService');

const PLAYERS = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Jugador ${id}` }));
const PLAYER_BEHAVIORS = [{ id: 10, name: 'Atacar', type: 'playerBehavior' }];

const makeLeague = (overrides = {}) => ({
  id: 5,
  name: 'Liga del barrio',
  creator: { id: 2, username: 'pepe', name: 'Boca Juniors', avatar: 1 },
  status: 'preparation',
  participantsCount: 1,
  maxParticipants: 8,
  minParticipants: 3,
  joined: false,
  private: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const httpError = (status, data = {}) => ({ response: { status, data } });

function renderModal({ league = makeLeague() } = {}) {
  const onClose = vi.fn();
  const onJoined = vi.fn();
  render(
    <MemoryRouter initialEntries={['/leagues/5']}>
      <Routes>
        <Route
          path="/leagues/:id"
          element={
            <JoinLeagueModal
              league={league}
              onClose={onClose}
              onJoined={onJoined}
            />
          }
        />
        <Route path="/leagues" element={<p>Listado de ligas</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onClose, onJoined };
}

// Elige un jugador distinto y el mismo comportamiento en cada uno de los 6 lugares del equipo.
async function completarEquipo() {
  const jugadores = await screen.findAllByLabelText('Jugador');
  const comportamientos = screen.getAllByLabelText('Comportamiento');
  for (let i = 0; i < 6; i += 1) {
    await userEvent.selectOptions(jugadores[i], String(i + 1));
    await userEvent.selectOptions(comportamientos[i], '10');
  }
}

const botonConfirmar = () => screen.getByRole('button', { name: /confirmar inscripción/i });

describe('JoinLeagueModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPlayers.mockResolvedValue(PLAYERS);
    getBehaviors.mockResolvedValue({ items: PLAYER_BEHAVIORS, page: 1, pageSize: 50, total: 1 });
  });

  it('muestra el modal con el equipo a armar y no pide director técnico', async () => {
    renderModal();

    expect(await screen.findByRole('dialog', { name: /unirse a liga del barrio/i })).toBeInTheDocument();
    expect(await screen.findAllByLabelText('Jugador')).toHaveLength(6);
    expect(screen.queryByLabelText(/director técnico/i)).not.toBeInTheDocument();
    // Solo se piden behaviors de jugador.
    expect(getBehaviors).toHaveBeenCalledTimes(1);
    expect(getBehaviors.mock.calls[0][2].type).toBe('playerBehavior');
  });

  describe('bloqueo previo', () => {
    it('con menos de 6 jugadores muestra lo que falta y no deja armar el equipo', async () => {
      getPlayers.mockResolvedValue(PLAYERS.slice(0, 4));

      renderModal();

      expect(await screen.findByText(/necesitás al menos 6 jugadores y tenés 4/i)).toBeInTheDocument();
      expect(screen.queryByLabelText('Jugador')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /confirmar inscripción/i })).not.toBeInTheDocument();
    });

    it('sin ningún comportamiento de jugador muestra lo que falta', async () => {
      getBehaviors.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });

      renderModal();

      expect(await screen.findByText(/al menos un comportamiento de jugador/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /confirmar inscripción/i })).not.toBeInTheDocument();
    });

    it('si no se pueden cargar los datos, avisa y permite cerrar', async () => {
      getPlayers.mockRejectedValue(new Error('Network Error'));

      const { onClose } = renderModal();

      expect(await screen.findByText(/no pudimos cargar tus jugadores/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /cerrar/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('validación del equipo', () => {
    it('el botón queda deshabilitado hasta completar los 6 lugares con su behavior', async () => {
      renderModal();
      await screen.findAllByLabelText('Jugador');

      expect(botonConfirmar()).toBeDisabled();

      // 6 jugadores pero un solo behavior elegido: todavía falta.
      const jugadores = screen.getAllByLabelText('Jugador');
      for (let i = 0; i < 6; i += 1) {
        await userEvent.selectOptions(jugadores[i], String(i + 1));
      }
      await userEvent.selectOptions(screen.getAllByLabelText('Comportamiento')[0], '10');
      expect(botonConfirmar()).toBeDisabled();

      await completarEquipo();
      expect(botonConfirmar()).toBeEnabled();
    });

    it('no deja elegir el mismo jugador en dos lugares', async () => {
      renderModal();
      const jugadores = await screen.findAllByLabelText('Jugador');

      await userEvent.selectOptions(jugadores[0], '1');

      const opcionEnOtroLugar = within(jugadores[1]).getByRole('option', { name: /jugador 1/i });
      expect(opcionEnOtroLugar).toBeDisabled();
    });
  });

  describe('contraseña', () => {
    it('liga pública: no hay campo de contraseña y el envío no incluye password', async () => {
      joinLeague.mockResolvedValue(undefined);
      const { onJoined } = renderModal();

      expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
      await completarEquipo();
      await userEvent.click(botonConfirmar());

      await vi.waitFor(() => expect(onJoined).toHaveBeenCalled());
      const [leagueId, team] = joinLeague.mock.calls[0];
      expect(leagueId).toBe(5);
      expect(team.password).toBeUndefined();
      expect(team).not.toHaveProperty('coachBehaviorId');
      expect(team.members.map((member) => member.role)).toEqual([
        'forward',
        'midfield',
        'defense',
        'substitute',
        'substitute',
        'substitute',
      ]);
      expect(team.members.map((member) => member.playerId)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('liga privada: pide la contraseña, no deja enviar sin ella y la manda en el body', async () => {
      joinLeague.mockResolvedValue(undefined);
      const { onJoined } = renderModal({ league: makeLeague({ private: true }) });

      await completarEquipo();
      expect(botonConfirmar()).toBeDisabled();

      await userEvent.type(screen.getByLabelText(/contraseña de la liga/i), 'abc123');
      expect(botonConfirmar()).toBeEnabled();
      await userEvent.click(botonConfirmar());

      await vi.waitFor(() => expect(onJoined).toHaveBeenCalled());
      expect(joinLeague.mock.calls[0][1].password).toBe('abc123');
      // Nunca queda en un storage.
      expect(sessionStorage.length).toBe(0);
      expect(localStorage.length).toBe(0);
    });
  });

  describe('envío', () => {
    it('muestra carga en el botón y bloquea envíos duplicados', async () => {
      let terminar;
      joinLeague.mockReturnValue(new Promise((resolve) => { terminar = resolve; }));
      const { onJoined } = renderModal();

      await completarEquipo();
      await userEvent.click(botonConfirmar());

      const botonCargando = await screen.findByRole('button', { name: /inscribiendo/i });
      expect(botonCargando).toBeDisabled();
      await userEvent.click(botonCargando);
      expect(joinLeague).toHaveBeenCalledTimes(1);

      terminar();
      await vi.waitFor(() => expect(onJoined).toHaveBeenCalled());
    });

    it('Cancelar cierra el modal sin enviar nada', async () => {
      const { onClose } = renderModal();
      await screen.findAllByLabelText('Jugador');

      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(onClose).toHaveBeenCalled();
      expect(joinLeague).not.toHaveBeenCalled();
    });
  });

  describe('errores del servidor (sin perder las selecciones)', () => {
    async function enviarConError(error, options) {
      joinLeague.mockRejectedValue(error);
      const rendered = renderModal(options);
      await completarEquipo();
      await userEvent.click(botonConfirmar());
      return rendered;
    }

    it('400: muestra un renglón por cada campo inválido', async () => {
      await enviarConError(
        httpError(400, {
          code: 'invalidFields',
          errors: [
            { field: 'members[0].playerId', reason: 'invalidType' },
            { field: 'members', reason: 'invalidTeam' },
          ],
        }),
      );

      expect(await screen.findByText('members[0].playerId: invalidType')).toBeInTheDocument();
      expect(screen.getByText('members: invalidTeam')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Jugador')[0]).toHaveValue('1');
      expect(botonConfirmar()).toBeEnabled();
    });

    it('403: avisa "Contraseña incorrecta", limpia el campo y conserva el equipo', async () => {
      joinLeague.mockRejectedValue(httpError(403, { code: 'invalidLeaguePassword' }));
      renderModal({ league: makeLeague({ private: true }) });
      await completarEquipo();
      await userEvent.type(screen.getByLabelText(/contraseña de la liga/i), 'mala');
      await userEvent.click(botonConfirmar());

      expect(await screen.findByText('Contraseña incorrecta.')).toBeInTheDocument();
      expect(screen.getByLabelText(/contraseña de la liga/i)).toHaveValue('');
      expect(screen.getAllByLabelText('Jugador')[0]).toHaveValue('1');
    });

    it('404: la liga no existe, vuelve al listado', async () => {
      await enviarConError(httpError(404, { code: 'notFound' }));

      expect(await screen.findByText('Listado de ligas')).toBeInTheDocument();
    });

    it.each([
      ['notInPreparation', 'La liga ya no admite inscripciones.'],
      ['leagueFull', 'La liga completó su cupo máximo.'],
      ['alreadyParticipating', 'Ya participás en esta liga.'],
      ['playerOrBehaviorNotOwned', /alguna de las selecciones no es válida/i],
      ['behaviorTypeMismatch', /alguna de las selecciones no es válida/i],
    ])('409 %s: muestra el mensaje que corresponde', async (code, message) => {
      await enviarConError(httpError(409, { code }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getAllByLabelText('Jugador')[0]).toHaveValue('1');
    });

    it('fallo de red: muestra un mensaje de conexión', async () => {
      await enviarConError(new Error('Network Error'));

      expect(await screen.findByText(/no se pudo conectar con el servidor/i)).toBeInTheDocument();
    });
  });
});
