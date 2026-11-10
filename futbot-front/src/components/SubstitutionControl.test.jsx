import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubstitutionControl from './SubstitutionControl';
import { AuthContext } from '../context/AuthContext.jsx';
import { getMatchTeam, getSubstitutions, setSubstitution } from '../services/matchService';

vi.mock('../services/matchService', () => ({
  getMatchTeam: vi.fn(),
  getSubstitutions: vi.fn(),
  setSubstitution: vi.fn(),
}));

const roster = { clubs: [{ username: 'yo', name: 'Mi Club' }, { username: 'otro', name: 'Rival FC' }] };

const team = (overrides = {}) => ({
  members: [
    { playerId: 1, name: 'Messi', role: 'forward' },
    { playerId: 2, name: 'De Paul', role: 'midfield' },
    { playerId: 3, name: 'Romero', role: 'defense' },
    { playerId: 7, name: 'Di María', role: 'substitute' },
    { playerId: 8, name: 'Álvarez', role: 'substitute' },
    { playerId: 9, name: 'Dibu', role: 'substitute' },
  ],
  coachBehavior: null,
  ...overrides,
});

// Ticks representativos (meta del hook).
const PLAYING = { phase: 'playing', pausesLeft: 3, teamVersion: 0 };
const NO_TICKS = { phase: null, pausesLeft: null, teamVersion: 0 };
const INITIAL_COUNTDOWN = { phase: 'countdown', pausesLeft: 3, teamVersion: 0 };

const NAMES = { 1: 'Messi', 2: 'De Paul', 3: 'Romero', 7: 'Di María', 8: 'Álvarez', 9: 'Dibu' };
const setUser = vi.fn();
let serverPending = null; // lo que el servidor devolvería en GET /substitutions fuera de una pausa

const renderControl = ({ role = 'player', meta = PLAYING, username = 'yo' } = {}) => {
  const ui = (m, r = role) => (
    <AuthContext.Provider value={{ user: { username }, setUser }}>
      <SubstitutionControl matchId="5" role={r} meta={m} roster={roster} />
    </AuthContext.Provider>
  );
  const utils = render(ui(meta));
  return { ...utils, update: (m, r) => utils.rerender(ui(m, r)) };
};

const openForm = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar Jugador' }));
  return screen.findByRole('dialog');
};

const choose = (starter, substitute) => {
  fireEvent.change(screen.getByLabelText('Titular que sale'), { target: { value: String(starter) } });
  fireEvent.change(screen.getByLabelText('Suplente que entra'), { target: { value: String(substitute) } });
};

describe('SubstitutionControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMatchTeam.mockResolvedValue(team());
    serverPending = null;
    // El PUT reemplaza a la pendiente anterior y el GET devuelve la última.
    getSubstitutions.mockImplementation(async () => ({ club1: serverPending, club2: null }));
    setSubstitution.mockImplementation(async (_id, { starterId, substituteId }) => {
      serverPending = { starterName: NAMES[starterId], substituteName: NAMES[substituteId] };
    });
  });

  describe('visibilidad y habilitación', () => {
    it('un espectador no ve el botón ni pide el equipo', () => {
      renderControl({ role: 'spectator' });

      expect(screen.queryByRole('button', { name: 'Cambiar Jugador' })).toBeNull();
      expect(getMatchTeam).not.toHaveBeenCalled();
      expect(getSubstitutions).not.toHaveBeenCalled();
    });

    it('mientras no se sabe el rol no se muestra nada', () => {
      renderControl({ role: null });

      expect(screen.queryByRole('button', { name: 'Cambiar Jugador' })).toBeNull();
    });

    it('un jugador en juego ve el botón habilitado', () => {
      renderControl();

      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeEnabled();
    });

    it('espera de rival (sin ticks): botón deshabilitado', () => {
      renderControl({ meta: NO_TICKS });

      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeDisabled();
    });

    it('cuenta regresiva inicial (countdown con pausesLeft 3): botón deshabilitado', () => {
      renderControl({ meta: INITIAL_COUNTDOWN });

      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeDisabled();
    });

    it.each([
      ['3.ª pausa', { phase: 'paused', pausesLeft: 0 }],
      ['período 4', { phase: 'playing', pausesLeft: 0 }],
      ['tanda de penales', { phase: 'penalties', pausesLeft: 0 }],
      ['finished', { phase: 'finished', pausesLeft: 0 }],
    ])('conexión tardía con pausesLeft en 0 (%s): botón deshabilitado desde el primer tick', (_label, meta) => {
      renderControl({ meta: { ...meta, teamVersion: 0 } });

      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeDisabled();
    });

    it('reconexión a mitad de partido: aplica la misma regla desde el primer tick', () => {
      renderControl({ meta: { phase: 'playing', pausesLeft: 1, teamVersion: 0 } });

      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeEnabled();
    });

    it('se habilita al llegar el primer tick de juego y se deshabilita al empezar la última pausa', () => {
      const { update } = renderControl({ meta: NO_TICKS });
      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeDisabled();

      update(PLAYING);
      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeEnabled();

      update({ phase: 'paused', pausesLeft: 0, teamVersion: 3 });
      expect(screen.getByRole('button', { name: 'Cambiar Jugador' })).toBeDisabled();
    });
  });

  describe('formulario', () => {
    it('al hacer clic despliega el overlay con titulares (nombre y rol) y suplentes (nombre)', async () => {
      renderControl();

      const dialog = await openForm();

      await waitFor(() => expect(within(dialog).getByLabelText('Titular que sale')).toBeInTheDocument());
      const starters = within(screen.getByLabelText('Titular que sale')).getAllByRole('option');
      expect(starters.map((o) => o.textContent)).toEqual([
        'Elegí un titular',
        'Messi (Delantero)',
        'De Paul (Mediocampista)',
        'Romero (Defensor)',
      ]);
      const subs = within(screen.getByLabelText('Suplente que entra')).getAllByRole('option');
      expect(subs.map((o) => o.textContent)).toEqual(['Elegí un suplente', 'Di María', 'Álvarez', 'Dibu']);
      expect(getMatchTeam).toHaveBeenCalledWith('5', { signal: expect.any(AbortSignal) });
    });

    it('el botón de abrir no hace nada si está deshabilitado', () => {
      renderControl({ meta: INITIAL_COUNTDOWN });

      fireEvent.click(screen.getByRole('button', { name: 'Cambiar Jugador' }));

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('el envío está deshabilitado hasta que ambos selectores tienen valor', async () => {
      renderControl();
      await openForm();
      await screen.findByLabelText('Titular que sale');
      const submit = screen.getByRole('button', { name: 'Confirmar cambio' });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Titular que sale'), { target: { value: '1' } });
      expect(submit).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Suplente que entra'), { target: { value: '7' } });
      expect(submit).toBeEnabled();
    });

    it('el botón de envío se deshabilita si deja de estar permitido pedir cambios', async () => {
      const { update } = renderControl();
      await openForm();
      await screen.findByLabelText('Titular que sale');
      choose(1, 7);
      expect(screen.getByRole('button', { name: 'Confirmar cambio' })).toBeEnabled();

      update({ phase: 'paused', pausesLeft: 0, teamVersion: 3 });

      expect(screen.getByRole('button', { name: 'Confirmar cambio' })).toBeDisabled();
    });

    it('Cancelar y Escape cierran el formulario', async () => {
      renderControl();
      await openForm();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).toBeNull();

      await openForm();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('si falla la carga del equipo permite reintentar', async () => {
      getMatchTeam.mockRejectedValueOnce(new Error('boom'));
      renderControl();
      await openForm();

      expect(await screen.findByText('No pudimos cargar tu equipo.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByLabelText('Titular que sale')).toBeInTheDocument();
    });
  });

  describe('envío', () => {
    it('hace PUT con { starterId, substituteId } y ante 204 informa que queda pendiente hasta la próxima pausa', async () => {
      renderControl();
      await openForm();
      await screen.findByLabelText('Titular que sale');
      choose(2, 8);

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

      await waitFor(() => expect(setSubstitution).toHaveBeenCalledWith('5', { starterId: 2, substituteId: 8 }));
      expect(await screen.findByText('Cambio registrado: queda pendiente hasta la próxima pausa.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText(/Cambio pendiente/)).toHaveTextContent('sale De Paul, entra Álvarez');
    });

    it('un nuevo envío antes de la pausa reemplaza al anterior en la pendiente mostrada', async () => {
      renderControl();
      await openForm();
      await screen.findByLabelText('Titular que sale');
      choose(1, 7);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
      await waitFor(() => expect(screen.getByText(/Cambio pendiente/)).toHaveTextContent('sale Messi, entra Di María'));

      await openForm();
      await screen.findByLabelText('Titular que sale');
      choose(3, 9);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

      await waitFor(() => expect(setSubstitution).toHaveBeenCalledTimes(2));
      expect(setSubstitution).toHaveBeenLastCalledWith('5', { starterId: 3, substituteId: 9 });
      await waitFor(() => expect(screen.getByText(/Cambio pendiente/)).toHaveTextContent('sale Romero, entra Dibu'));
      expect(screen.getByText(/Cambio pendiente/)).not.toHaveTextContent('Messi');
    });

    it('con una pendiente ya cargada del servidor, la muestra (mi equipo = club1)', async () => {
      getSubstitutions.mockResolvedValue({
        club1: { starterName: 'Messi', substituteName: 'Di María' },
        club2: { starterName: 'Otamendi', substituteName: 'Pezzella' },
      });
      renderControl();

      expect(await screen.findByText(/Cambio pendiente/)).toHaveTextContent('sale Messi, entra Di María');
      expect(getSubstitutions).toHaveBeenCalledWith('5', { signal: expect.any(AbortSignal) });
    });

    it('si soy el club2, la pendiente mostrada es la de club2', async () => {
      getSubstitutions.mockResolvedValue({
        club1: { starterName: 'Otamendi', substituteName: 'Pezzella' },
        club2: { starterName: 'Messi', substituteName: 'Di María' },
      });
      renderControl({ username: 'otro' });

      expect(await screen.findByText(/Cambio pendiente/)).toHaveTextContent('sale Messi, entra Di María');
    });

    it('sin pendiente no muestra nada', async () => {
      renderControl();

      await waitFor(() => expect(getSubstitutions).toHaveBeenCalled());
      expect(screen.queryByText(/Cambio pendiente/)).toBeNull();
    });

    it('durante una pausa no pide la pendiente (el GET devolvería la aplicada)', async () => {
      renderControl({ meta: { phase: 'paused', pausesLeft: 2, teamVersion: 1 } });

      await waitFor(() => expect(getMatchTeam).toHaveBeenCalled());
      expect(getSubstitutions).not.toHaveBeenCalled();
    });

    it('al terminar la pausa vuelve a pedir la pendiente (un PUT hecho en la pausa queda para la siguiente)', async () => {
      const { update } = renderControl({ meta: { phase: 'paused', pausesLeft: 2, teamVersion: 1 } });
      expect(getSubstitutions).not.toHaveBeenCalled();
      getSubstitutions.mockResolvedValue({ club1: { starterName: 'Messi', substituteName: 'Di María' }, club2: null });

      update({ phase: 'countdown', pausesLeft: 2, teamVersion: 2 });

      expect(await screen.findByText(/Cambio pendiente/)).toHaveTextContent('sale Messi, entra Di María');
    });
  });

  describe('refresco del equipo', () => {
    it('al subir teamVersion (evento pause) vuelve a pedir el equipo y los selectores reflejan el cambio ya aplicado', async () => {
      const { update } = renderControl();
      await openForm();
      await screen.findByLabelText('Titular que sale');
      expect(getMatchTeam).toHaveBeenCalledTimes(1);
      choose(1, 7);

      // Se aplicó Di María por Messi: ahora Di María es titular delantero y Messi es suplente.
      getMatchTeam.mockResolvedValue(team({
        members: [
          { playerId: 7, name: 'Di María', role: 'forward' },
          { playerId: 2, name: 'De Paul', role: 'midfield' },
          { playerId: 3, name: 'Romero', role: 'defense' },
          { playerId: 1, name: 'Messi', role: 'substitute' },
          { playerId: 8, name: 'Álvarez', role: 'substitute' },
          { playerId: 9, name: 'Dibu', role: 'substitute' },
        ],
      }));
      update({ phase: 'paused', pausesLeft: 2, teamVersion: 1 });

      await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(2));
      await waitFor(() => {
        const starters = within(screen.getByLabelText('Titular que sale')).getAllByRole('option').map((o) => o.textContent);
        expect(starters).toContain('Di María (Delantero)');
        expect(starters).not.toContain('Messi (Delantero)');
      });
      const subs = within(screen.getByLabelText('Suplente que entra')).getAllByRole('option').map((o) => o.textContent);
      expect(subs).toContain('Messi');
      // Las selecciones viejas se descartan: la próxima se hace sobre el equipo nuevo.
      expect(screen.getByLabelText('Titular que sale')).toHaveValue('');
      expect(screen.getByLabelText('Suplente que entra')).toHaveValue('');
    });

    it('al subir teamVersion por periodStart ≥ 2 también vuelve a pedir el equipo', async () => {
      const { update } = renderControl({ meta: { phase: 'paused', pausesLeft: 2, teamVersion: 1 } });
      await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(1));

      update({ phase: 'countdown', pausesLeft: 2, teamVersion: 2 });

      await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(2));
    });

    it('sin cambios en teamVersion no vuelve a pedir el equipo (ticks comunes)', async () => {
      const { update } = renderControl();
      await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(1));

      update({ ...PLAYING, elapsedTime: 12 });
      update({ ...PLAYING, elapsedTime: 13 });

      expect(getMatchTeam).toHaveBeenCalledTimes(1);
    });

    it('al aplicarse la sustitución la pendiente mostrada desaparece', async () => {
      getSubstitutions.mockResolvedValue({ club1: { starterName: 'Messi', substituteName: 'Di María' }, club2: null });
      const { update } = renderControl();
      await screen.findByText(/Cambio pendiente/);

      getSubstitutions.mockResolvedValue({ club1: null, club2: null });
      update({ phase: 'paused', pausesLeft: 2, teamVersion: 1 });

      await waitFor(() => expect(screen.queryByText(/Cambio pendiente/)).toBeNull());
    });
  });

  describe('errores del PUT', () => {
    const submitWithError = async (error) => {
      setSubstitution.mockRejectedValue(error);
      renderControl();
      await openForm();
      await screen.findByLabelText('Titular que sale');
      choose(1, 7);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));
    };

    it.each([
      ['notStarter', [{ field: 'starterId', reason: 'notStarter' }]],
      ['notSubstitute', [{ field: 'substituteId', reason: 'notSubstitute' }]],
    ])('400 %s: recarga el equipo, reinicia la selección y avisa', async (_label, errors) => {
      await submitWithError({ response: { status: 400, data: { code: 'invalidFields', errors } } });

      expect(await screen.findByRole('alert')).toHaveTextContent('Tu selección quedó desactualizada');
      await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByLabelText('Titular que sale')).toHaveValue(''));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('400 de otro campo: mensaje genérico sin recargar el equipo', async () => {
      await submitWithError({
        response: { status: 400, data: { code: 'invalidFields', errors: [{ field: 'starterId', reason: 'outOfRange' }] } },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('La solicitud no es válida');
      expect(getMatchTeam).toHaveBeenCalledTimes(1);
    });

    it('401: avisa y trata la sesión de forma global (se limpia el usuario → /login)', async () => {
      await submitWithError({ response: { status: 401 } });

      expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión expiró');
      expect(setUser).toHaveBeenCalledWith(null);
    });

    it('403: el usuario no es jugador del partido', async () => {
      await submitWithError({ response: { status: 403, data: { code: 'notAPlayerInMatch' } } });

      expect(await screen.findByRole('alert')).toHaveTextContent('No sos jugador de este partido');
    });

    it('404: el partido no existe', async () => {
      await submitWithError({ response: { status: 404 } });

      expect(await screen.findByRole('alert')).toHaveTextContent('El partido no existe.');
    });

    it.each([
      ['matchNotStarted', 'todavía no empezó'],
      ['matchInPenalties', 'tanda de penales'],
      ['noPausesLeft', 'Ya no quedan pausas'],
    ])('409 %s: mensaje específico por code', async (code, text) => {
      await submitWithError({ response: { status: 409, data: { code } } });

      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(setUser).not.toHaveBeenCalled();
    });

    it('error de red: mensaje de conexión y el formulario sigue abierto', async () => {
      await submitWithError(new Error('Network Error'));

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
