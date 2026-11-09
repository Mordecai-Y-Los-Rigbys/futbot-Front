import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestBehaviorButton from './TestBehaviorButton';
import { getBehaviors } from '../services/behaviorService';
import { getPlayersPage } from '../services/playerService';

vi.mock('../services/behaviorService', () => ({ getBehaviors: vi.fn(), PAGE_SIZE: 50 }));
vi.mock('../services/playerService', () => ({ getPlayersPage: vi.fn() }));
// El modal tiene su propia lógica: acá solo importa que el botón lo abra.
vi.mock('./TestBehaviorModal', () => ({
  default: ({ initialNotice }) => <div role="dialog">Modal de prueba {initialNotice}</div>,
}));

const page = (total) => ({ items: [], page: 1, pageSize: 50, total });

const renderButton = (initialEntries = ['/behaviors']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <TestBehaviorButton />
    </MemoryRouter>,
  );

const testButton = () => screen.getByRole('button', { name: 'Probar comportamientos' });

describe('TestBehaviorButton', () => {
  beforeEach(() => {
    getBehaviors.mockReset();
    getPlayersPage.mockReset();
  });

  it('pide solo los playerBehavior (type en el servidor) y la primera página de jugadores', async () => {
    getBehaviors.mockResolvedValue(page(2));
    getPlayersPage.mockResolvedValue(page(6));
    renderButton();

    await waitFor(() => expect(testButton()).toBeEnabled());
    expect(getBehaviors).toHaveBeenCalledWith('', 1, expect.objectContaining({ type: 'playerBehavior' }));
    expect(getPlayersPage).toHaveBeenCalledWith('', 1, expect.anything());
  });

  it('se habilita con al menos un playerBehavior y 6 jugadores, y abre el formulario', async () => {
    getBehaviors.mockResolvedValue(page(1));
    getPlayersPage.mockResolvedValue(page(6));
    renderButton();

    await waitFor(() => expect(testButton()).toBeEnabled());
    fireEvent.click(testButton());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('queda deshabilitado y explica el motivo si no hay playerBehavior', async () => {
    getBehaviors.mockResolvedValue(page(0));
    getPlayersPage.mockResolvedValue(page(8));
    renderButton();

    expect(await screen.findByText('Necesitás al menos un comportamiento de jugador.')).toBeInTheDocument();
    expect(testButton()).toBeDisabled();
  });

  it('queda deshabilitado con menos de 6 jugadores y ofrece crearlos', async () => {
    getBehaviors.mockResolvedValue(page(3));
    getPlayersPage.mockResolvedValue(page(4));
    renderButton();

    expect(await screen.findByText(/Necesitás al menos 6 jugadores \(tenés 4\)/)).toBeInTheDocument();
    expect(testButton()).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Crear jugadores' })).toHaveAttribute('href', '/players/new');
  });

  it('si no puede verificar, queda deshabilitado y lo informa', async () => {
    getBehaviors.mockRejectedValue(new Error('boom'));
    getPlayersPage.mockResolvedValue(page(6));
    renderButton();

    expect(await screen.findByText('No pudimos verificar tus jugadores y comportamientos.')).toBeInTheDocument();
    expect(testButton()).toBeDisabled();
  });

  it('reabre el formulario con el aviso cuando la pantalla de prueba vuelve "al formulario"', async () => {
    getBehaviors.mockResolvedValue(page(1));
    getPlayersPage.mockResolvedValue(page(6));
    renderButton([{ pathname: '/behaviors', state: { testForm: { notice: 'Algo fue eliminado.' } } }]);

    expect(await screen.findByRole('dialog')).toHaveTextContent('Algo fue eliminado.');
  });
});
