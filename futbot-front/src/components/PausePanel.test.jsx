import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PausePanel from './PausePanel';
import { AuthContext } from '../context/AuthContext.jsx';
import { getNextSubstitutions } from '../services/matchService';

vi.mock('../services/matchService', () => ({ getNextSubstitutions: vi.fn() }));

const roster = { clubs: [{ username: 'yo', name: 'Mi Club' }, { username: 'otro', name: 'Rival FC' }] };
const SUBS = { starterName: 'Messi', substituteName: 'Di María' };

const renderPanel = ({ props = {}, username = 'yo' } = {}) =>
  render(
    <AuthContext.Provider value={{ user: { username } }}>
      <MemoryRouter initialEntries={['/matches/5']}>
        <Routes>
          <Route
            path="/matches/:id"
            element={<PausePanel reason="hydration" remainingSeconds={12} roster={roster} {...props} />}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('PausePanel', () => {
  beforeEach(() => {
    getNextSubstitutions.mockReset();
    getNextSubstitutions.mockResolvedValue({ club1: null, club2: null });
  });

  it('hydration: "Pausa de hidratación" y el tiempo que falta', () => {
    renderPanel();

    expect(screen.getByText('Pausa de hidratación')).toBeInTheDocument();
    expect(screen.getByText('Vuelve en 12 s')).toBeInTheDocument();
  });

  it('halftime: "Entretiempo"', () => {
    renderPanel({ props: { reason: 'halftime' } });

    expect(screen.getByText('Entretiempo')).toBeInTheDocument();
  });

  it('sin motivo: "Partido en pausa" y el tiempo que falta', () => {
    renderPanel({ props: { reason: null, remainingSeconds: 7 } });

    expect(screen.getByText('Partido en pausa')).toBeInTheDocument();
    expect(screen.getByText('Vuelve en 7 s')).toBeInTheDocument();
  });

  it('el tiempo que falta sigue a las props', () => {
    const { rerender } = renderPanel();
    expect(screen.getByText('Vuelve en 12 s')).toBeInTheDocument();

    rerender(
      <AuthContext.Provider value={{ user: { username: 'yo' } }}>
        <MemoryRouter initialEntries={['/matches/5']}>
          <Routes>
            <Route path="/matches/:id" element={<PausePanel reason="hydration" remainingSeconds={11} roster={roster} />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    // rerender con un árbol nuevo remonta; alcanza para verificar el valor mostrado
    expect(screen.getByText('Vuelve en 11 s')).toBeInTheDocument();
  });

  it('consulta los cambios del partido de la URL al montarse', async () => {
    renderPanel();

    await waitFor(() => expect(getNextSubstitutions).toHaveBeenCalledTimes(1));
    expect(getNextSubstitutions.mock.calls[0][0]).toBe('5');
  });

  it('mi cambio a la izquierda y el del rival a la derecha, con entra y sale marcados', async () => {
    getNextSubstitutions.mockResolvedValue({
      club1: SUBS,
      club2: { starterName: 'Otamendi', substituteName: 'Pezzella' },
    });
    renderPanel();

    const mine = await screen.findByTestId('subs-mine');
    const rival = screen.getByTestId('subs-rival');
    expect(within(mine).getByText('Di María')).toBeInTheDocument();
    expect(within(mine).getByLabelText('Entra')).toHaveTextContent('▲');
    expect(within(mine).getByText('Messi')).toBeInTheDocument();
    expect(within(mine).getByLabelText('Sale')).toHaveTextContent('▼');
    expect(within(rival).getByText('Pezzella')).toBeInTheDocument();
    expect(within(rival).getByText('Otamendi')).toBeInTheDocument();
    // izquierda antes que derecha en el DOM
    expect(mine.compareDocumentPosition(rival) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('si soy el club2, mi cambio es el de club2', async () => {
    getNextSubstitutions.mockResolvedValue({ club1: null, club2: SUBS });
    renderPanel({ username: 'otro' });

    const mine = await screen.findByTestId('subs-mine');
    expect(within(mine).getByText('Messi')).toBeInTheDocument();
    expect(within(screen.getByTestId('subs-rival')).queryByRole('listitem')).toBeNull();
  });

  it('un club null no muestra ningún cambio en su lado', async () => {
    getNextSubstitutions.mockResolvedValue({ club1: SUBS, club2: null });
    renderPanel();

    await screen.findByTestId('subs-mine');
    expect(within(screen.getByTestId('subs-rival')).queryByRole('listitem')).toBeNull();
  });

  it('con ambos clubes null no se muestra el panel de cambios', async () => {
    renderPanel();

    await waitFor(() => expect(getNextSubstitutions).toHaveBeenCalled());
    expect(screen.queryByTestId('subs-mine')).toBeNull();
    expect(screen.getByText('Pausa de hidratación')).toBeInTheDocument();
  });

  it.each([401, 403, 404, 409])('si el endpoint responde %i no hay panel y la pausa sigue visible', async (status) => {
    getNextSubstitutions.mockRejectedValue({ response: { status } });
    renderPanel();

    await waitFor(() => expect(getNextSubstitutions).toHaveBeenCalled());
    expect(screen.queryByTestId('subs-mine')).toBeNull();
    expect(screen.getByText('Pausa de hidratación')).toBeInTheDocument();
    expect(screen.getByText('Vuelve en 12 s')).toBeInTheDocument();
  });
});