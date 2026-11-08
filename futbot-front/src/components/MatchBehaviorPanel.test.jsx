import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MatchBehaviorPanel from './MatchBehaviorPanel';
import { getBehaviors } from '../services/behaviorService';
import { getMatchBehavior, getMatchTeam, reassignBehavior } from '../services/matchService';

vi.mock('../services/behaviorService', () => ({ getBehaviors: vi.fn() }));
vi.mock('../services/matchService', () => ({
  getMatchBehavior: vi.fn(),
  getMatchTeam: vi.fn(),
  reassignBehavior: vi.fn(),
}));

const members = [
  { playerId: 1, name: 'Ada Delantera', role: 'forward' },
  { playerId: 2, name: 'Bea Mediocampista', role: 'midfield' },
  { playerId: 7, name: 'Cami Suplente', role: 'substitute' },
];
const behaviors = {
  items: [
    { id: 11, name: 'Ofensivo' },
    { id: 12, name: 'Defensivo' },
    { id: 13, name: 'Equilibrado' },
  ],
  page: 1,
  pageSize: 50,
  total: 3,
};

describe('MatchBehaviorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMatchTeam.mockResolvedValue({ members, coachBehavior: null });
    getMatchBehavior.mockImplementation(async (...args) => {
      const playerId = args[1];
      return {
        name: playerId === 1 ? 'Ofensivo' : 'Defensivo',
        code: 'return;',
      };
    });
    getBehaviors.mockResolvedValue(behaviors);
    reassignBehavior.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no consulta ni muestra el panel si la conexión del usuario no está abierta', () => {
    render(<MatchBehaviorPanel matchId="42" canManage={false} />);

    expect(screen.queryByRole('complementary', { name: 'Cambio de comportamiento' })).not.toBeInTheDocument();
    expect(getMatchTeam).not.toHaveBeenCalled();
  });

  it('oculta el panel si la API indica que el usuario no participa', async () => {
    getMatchTeam.mockRejectedValue({ response: { status: 403 } });

    render(<MatchBehaviorPanel matchId="42" canManage />);

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Cambio de comportamiento' })).not.toBeInTheDocument();
    });
  });

  it('solo lista a los titulares: los suplentes no tienen comportamiento para cambiar', async () => {
    render(<MatchBehaviorPanel matchId="42" canManage />);

    const starterList = await screen.findByRole('list');
    expect(within(starterList).queryByText('Cami Suplente')).not.toBeInTheDocument();
    expect(getMatchBehavior).toHaveBeenCalledTimes(2);
  });

  it('vuelve a pedir el equipo cuando cambia teamVersion (se aplicó una sustitución)', async () => {
    const { rerender } = render(<MatchBehaviorPanel matchId="42" canManage teamVersion={0} />);
    await screen.findByRole('list');
    expect(getMatchTeam).toHaveBeenCalledTimes(1);

    rerender(<MatchBehaviorPanel matchId="42" canManage teamVersion={1} />);

    await waitFor(() => expect(getMatchTeam).toHaveBeenCalledTimes(2));
  });

  it('muestra titulares y comportamientos actuales y carga todas las páginas', async () => {
    getBehaviors
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, index) => ({ id: index + 1, name: `Behavior ${index + 1}` })),
        page: 1,
        pageSize: 50,
        total: 51,
      })
      .mockResolvedValueOnce({
        items: [{ id: 51, name: 'Behavior 51' }],
        page: 2,
        pageSize: 50,
        total: 51,
      });

    render(<MatchBehaviorPanel matchId="42" canManage />);

    const starterList = await screen.findByRole('list');
    expect(within(starterList).getByText('Ada Delantera')).toBeInTheDocument();
    expect(within(starterList).getByText('Ofensivo')).toBeInTheDocument();
    expect(within(starterList).getByText('Bea Mediocampista')).toBeInTheDocument();
    expect(within(starterList).getByText('Defensivo')).toBeInTheDocument();
    expect(getBehaviors).toHaveBeenNthCalledWith(1, '', 1, {
      signal: expect.any(AbortSignal),
      type: 'playerBehavior',
    });
    expect(getBehaviors).toHaveBeenNthCalledWith(2, '', 2, {
      signal: expect.any(AbortSignal),
      type: 'playerBehavior',
    });
  });

  it('confirma y envía el cambio del titular seleccionado', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MatchBehaviorPanel matchId="42" canManage />);

    await screen.findByRole('list');
    fireEvent.change(screen.getByLabelText('Titular'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Nuevo comportamiento'), { target: { value: '13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() => {
      expect(reassignBehavior).toHaveBeenCalledWith('42', { playerId: 2, behaviorId: 13 });
    });
    expect(confirmSpy).toHaveBeenCalledWith(
      '¿Cambiar el comportamiento de Bea Mediocampista a "Equilibrado"?',
    );
    expect(await screen.findByText('· Pendiente: Equilibrado')).toBeInTheDocument();
    expect(screen.getByText('Defensivo')).toBeInTheDocument();
    expect(screen.getByText('Cambio confirmado. Se aplicará desde el siguiente tick.')).toBeInTheDocument();
  });

  it('muestra errores de negocio del servidor', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    reassignBehavior.mockRejectedValue({
      response: { status: 409, data: { code: 'matchNotInProgress' } },
    });
    render(<MatchBehaviorPanel matchId="42" canManage />);

    await screen.findByRole('list');
    fireEvent.change(screen.getByLabelText('Nuevo comportamiento'), { target: { value: '13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El partido no está en curso.');
  });
});
