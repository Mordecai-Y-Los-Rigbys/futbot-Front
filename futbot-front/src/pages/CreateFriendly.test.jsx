import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import CreateFriendly from './CreateFriendly';
import * as playerService from '../services/playerService';
import * as friendlyService from '../services/friendlyService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPlayers = [
  { id: 1, name: 'Lionel Messi', defaultBehaviorId: 10 },
  { id: 2, name: 'Rodrigo De Paul', defaultBehaviorId: 11 },
  { id: 3, name: 'Cristian Romero', defaultBehaviorId: 12 },
  { id: 4, name: 'Emiliano Martínez', defaultBehaviorId: 13 },
  { id: 5, name: 'Ángel Di María', defaultBehaviorId: 14 },
  { id: 6, name: 'Julián Álvarez', defaultBehaviorId: 15 },
  { id: 7, name: 'Alexis Mac Allister', defaultBehaviorId: 16 },
];

describe('CreateFriendly (SCRUM-89)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(playerService, 'getPlayers').mockResolvedValue(mockPlayers);
  });

  it('deshabilita el botón de crear si no están las 6 posiciones asignadas o el nombre está vacío', async () => {
    render(
      <BrowserRouter>
        <CreateFriendly isOpen={true} onClose={vi.fn()} />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Crear Partido')).toBeInTheDocument());

    const submitBtn = screen.getByRole('button', { name: /crear partido/i });
    expect(submitBtn).toBeDisabled();
  });

  it('deshabilita la opción de un jugador en otros selectores cuando ya fue seleccionado', async () => {
    render(
      <BrowserRouter>
        <CreateFriendly isOpen={true} onClose={vi.fn()} />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByLabelText(/delantero/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/delantero/i), { target: { value: '1' } });

    const midfieldSelect = screen.getByLabelText(/mediocampista/i);
    const player1Option = midfieldSelect.querySelector('option[value="1"]');
    expect(player1Option).toBeDisabled();
  });

  it('crea el partido exitosamente y navega a la vista de espera con el ID correspondiente', async () => {
    vi.spyOn(friendlyService, 'createFriendlyMatch').mockResolvedValue({ id: 100, status: 'scheduled' });
    const onCloseMock = vi.fn();

    render(
      <BrowserRouter>
        <CreateFriendly isOpen={true} onClose={onCloseMock} />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByLabelText(/nombre del partido/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/nombre del partido/i), { target: { value: 'Amistoso Test' } });
    fireEvent.change(screen.getByLabelText(/delantero/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/mediocampista/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/defensor/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/suplente 1/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/suplente 2/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/suplente 3/i), { target: { value: '6' } });

    const submitBtn = screen.getByRole('button', { name: /crear partido/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/matches/100');
    });
  });
});