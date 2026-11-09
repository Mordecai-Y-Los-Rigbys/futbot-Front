import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScoreboardOverlay from './ScoreboardOverlay';
import { INITIAL_META } from '../hooks/useMatchWebSocket';

const roster = {
  clubs: [
    { id: 10, name: 'La Scaloneta FC', username: 'scaloni' },
    { id: 11, name: 'Manchester City', username: 'guardiola' },
  ],
  players: {},
};

const kick = (club, round, scored, kickerName = `${club}-${round}`) => ({
  club,
  kickerId: club === 'club1' ? round : 10 + round,
  kickerName,
  round,
  scored,
});

const CURRENT = { club: 'club1', kickerId: 1, kickerName: 'Messi', defenderId: 11, defenderName: 'Foden' };

const shootoutMeta = (overrides = {}) => ({
  ...INITIAL_META,
  score1: 1,
  score2: 1,
  elapsedTime: 600,
  phase: 'penalties',
  penaltyCurrent: CURRENT,
  penaltyRemainingSeconds: 8,
  ...overrides,
});

const renderOverlay = (meta, props = {}) =>
  render(<ScoreboardOverlay meta={meta} roster={roster} status="open" onExit={() => {}} {...props} />);

const slotsOf = (clubName) => within(screen.getByRole('list', { name: `Penales de ${clubName}` })).getAllByRole('listitem');
const states = (clubName) => slotsOf(clubName).map((li) => li.dataset.state);

describe('ScoreboardOverlay: tanda de penales', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('con el partido en juego no muestra nada de la tanda', () => {
    renderOverlay({ ...INITIAL_META, phase: 'playing', elapsedTime: 30, periodNumber: 1 });

    expect(screen.queryByRole('region', { name: 'Tanda de penales' })).toBeNull();
    expect(screen.queryByText(/Penales \d/)).toBeNull();
  });

  it('inicio de la tanda: marcador de penales en 0 - 0, 5 casilleros vacíos por club y cuenta previa', () => {
    renderOverlay(shootoutMeta({ penaltyCountdownSeconds: 3, penaltyRemainingSeconds: 8 }));

    expect(screen.getByText('Penales 0 - 0')).toBeInTheDocument();
    expect(states('La Scaloneta FC')).toEqual(Array(5).fill('empty'));
    expect(states('Manchester City')).toEqual(Array(5).fill('empty'));
    expect(screen.getByRole('timer', { name: 'Cuenta previa del penal' })).toHaveTextContent('3');
    // Mientras corre la cuenta previa todavía no corren los 8 segundos.
    expect(screen.queryByRole('timer', { name: 'Tiempo restante del penal' })).toBeNull();
  });

  it('el reloj del partido queda reemplazado por “Penales”', () => {
    renderOverlay(shootoutMeta());

    expect(screen.getByRole('banner')).toHaveTextContent('Penales');
    expect(screen.getByRole('banner')).not.toHaveTextContent('10:00');
  });

  it('penal en curso: muestra quién patea, quién defiende y los segundos restantes', () => {
    renderOverlay(shootoutMeta({ penaltyCountdownSeconds: null, penaltyRemainingSeconds: 6 }));

    expect(screen.getByText('Messi')).toBeInTheDocument();
    expect(screen.getByText('Foden')).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Tiempo restante del penal' })).toHaveTextContent('6 s');
    expect(screen.queryByRole('timer', { name: 'Cuenta previa del penal' })).toBeNull();
  });

  it('gol: el casillero queda en verde con el nombre del pateador y suma al marcador de penales', () => {
    renderOverlay(
      shootoutMeta({ penaltyScore1: 1, penaltyKicks: [kick('club1', 1, true, 'Messi')], penaltyCurrent: null }),
    );

    expect(screen.getByText('Penales 1 - 0')).toBeInTheDocument();
    expect(states('La Scaloneta FC')).toEqual(['scored', 'empty', 'empty', 'empty', 'empty']);
    expect(screen.getByLabelText('Penal 1: gol, Messi')).toBeInTheDocument();
  });

  it('penal errado (por tiempo o pelota en el arco propio): casillero en rojo', () => {
    renderOverlay(
      shootoutMeta({
        penaltyKicks: [kick('club1', 1, true), kick('club2', 1, false, 'Haaland')],
        penaltyScore1: 1,
        penaltyCurrent: null,
      }),
    );

    expect(states('Manchester City')).toEqual(['missed', 'empty', 'empty', 'empty', 'empty']);
    expect(screen.getByLabelText('Penal 1: no convertido, Haaland')).toBeInTheDocument();
  });

  it('cada penal va en la fila de su club (por lado, aunque los nombres se repitan)', () => {
    renderOverlay(
      shootoutMeta({
        penaltyKicks: [kick('club2', 1, true, 'Igual'), kick('club1', 1, false, 'Igual')],
        penaltyCurrent: null,
      }),
    );

    expect(states('La Scaloneta FC')[0]).toBe('missed');
    expect(states('Manchester City')[0]).toBe('scored');
  });

  it('tanda cortada antes de los 5 penales: los casilleros sin patear quedan vacíos', () => {
    const kicks = [1, 2, 3].flatMap((r) => [kick('club1', r, true), kick('club2', r, false)]);
    renderOverlay(shootoutMeta({ penaltyKicks: kicks, penaltyScore1: 3, penaltyScore2: 0, penaltyCurrent: null }));

    expect(states('La Scaloneta FC')).toEqual(['scored', 'scored', 'scored', 'empty', 'empty']);
    expect(states('Manchester City')).toEqual(['missed', 'missed', 'missed', 'empty', 'empty']);
  });

  it('reconexión a mitad de la tanda: se reconstruye todo desde el estado del tick, sin cartel', () => {
    const kicks = [kick('club1', 1, true), kick('club2', 1, true), kick('club1', 2, false)];
    renderOverlay(
      shootoutMeta({ penaltyKicks: kicks, penaltyScore1: 1, penaltyScore2: 1, penaltiesBanner: null }),
    );

    expect(screen.getByText('Penales 1 - 1')).toBeInTheDocument();
    expect(states('La Scaloneta FC')).toEqual(['scored', 'missed', 'empty', 'empty', 'empty']);
    expect(screen.queryByText('Tanda de penales', { selector: '.shootout-banner__word' })).toBeNull();
  });

  it('el cartel “Tanda de penales” aparece con penaltiesStart y desaparece a los 3 segundos', () => {
    const { rerender } = renderOverlay(shootoutMeta());
    rerender(
      <ScoreboardOverlay
        meta={shootoutMeta({ penaltiesBanner: { id: 1 } })}
        roster={roster}
        status="open"
        onExit={() => {}}
      />,
    );

    expect(document.querySelector('.shootout-banner__word')).toHaveTextContent('Tanda de penales');

    act(() => vi.advanceTimersByTime(3100));

    expect(document.querySelector('.shootout-banner__word')).toBeNull();
  });

  it('pantalla final con tanda: resultado, (pen. x - y), ganador y los penales de cada club', () => {
    const kicks = [1, 2, 3, 4, 5].flatMap((r) => [kick('club1', r, r !== 5), kick('club2', r, r === 1 || r > 2 ? r !== 5 : false)]);
    const penalties = { score1: 4, score2: 3, winner: 'club1', kicks };
    renderOverlay({
      ...INITIAL_META,
      score1: 1,
      score2: 1,
      phase: 'finished',
      penaltyKicks: kicks,
      result: { score1: 1, score2: 1, penalties },
    });

    const final = screen.getByText('Partido finalizado').closest('.final');
    expect(final).toHaveTextContent('1 : 1 (pen. 4 - 3)');
    expect(within(final).getByText('Gana La Scaloneta FC')).toBeInTheDocument();
    expect(within(final).getByRole('list', { name: 'Penales de La Scaloneta FC' })).toBeInTheDocument();
    expect(within(final).getByRole('list', { name: 'Penales de Manchester City' })).toBeInTheDocument();
  });

  it('el ganador sale del lado (club2), no de un nombre', () => {
    renderOverlay({
      ...INITIAL_META,
      phase: 'finished',
      result: { score1: 0, score2: 0, penalties: { score1: 2, score2: 3, winner: 'club2', kicks: [] } },
    });

    expect(screen.getByText('Gana Manchester City')).toBeInTheDocument();
  });

  it('tanda empatada: indica que se definió por sorteo', () => {
    renderOverlay({
      ...INITIAL_META,
      phase: 'finished',
      result: { score1: 0, score2: 0, penalties: { score1: 3, score2: 3, winner: 'club2', kicks: [] } },
    });

    expect(screen.getByText('Gana Manchester City (definido por sorteo)')).toBeInTheDocument();
  });

  it('partido sin tanda: pantalla final como siempre, sin penales ni ganador', () => {
    renderOverlay({
      ...INITIAL_META,
      score1: 2,
      score2: 1,
      phase: 'finished',
      result: { score1: 2, score2: 1, penalties: null },
    });

    const final = screen.getByText('Partido finalizado').closest('.final');
    expect(final).toHaveTextContent('2 : 1');
    expect(final).not.toHaveTextContent('pen.');
    expect(within(final).queryByText(/^Gana /)).toBeNull();
    expect(screen.queryByRole('list', { name: /Penales de/ })).toBeNull();
  });

  it('sin datos del club muestra “Club 1” / “Club 2”', () => {
    renderOverlay(shootoutMeta(), { roster: { clubs: [null, null], players: {} } });

    expect(screen.getByRole('list', { name: 'Penales de Club 1' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Penales de Club 2' })).toBeInTheDocument();
  });
});
