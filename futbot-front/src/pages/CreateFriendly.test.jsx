import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import CreateFriendly from './CreateFriendly';
import * as playerService from '../services/playerService';
import * as behaviorService from '../services/behaviorService';
import * as friendlyService from '../services/friendlyService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPlayers = [
  { id: 1, name: 'Lionel Messi' },
  { id: 2, name: 'Rodrigo De Paul' },
  { id: 3, name: 'Cristian Romero' },
  { id: 4, name: 'Emiliano Martínez' },
  { id: 5, name: 'Ángel Di María' },
  { id: 6, name: 'Julián Álvarez' },
  { id: 7, name: 'Alexis Mac Allister' },
];

const mockBehaviors = {
  items: [
    { id: 101, name: 'Ofensivo' },
    { id: 102, name: 'Defensivo' },
    { id: 103, name: 'Equilibrado' },
  ],
  page: 1,
  pageSize: 50,
  total: 3,
};

// [label del jugador, label del comportamiento, jugador, comportamiento]
const SLOTS = [
  ['Delantero', 'Delantero - Comportamiento', '1', '101'],
  ['Mediocampista', 'Mediocampista - Comportamiento', '2', '102'],
  ['Defensor', 'Defensor - Comportamiento', '3', '103'],
  ['Suplente 1', 'Suplente 1 - Comportamiento', '4', '101'],
  ['Suplente 2', 'Suplente 2 - Comportamiento', '5', '102'],
  ['Suplente 3', 'Suplente 3 - Comportamiento', '6', '103'],
];

const renderComponent = (onClose = vi.fn()) =>
  render(
    <BrowserRouter>
      <CreateFriendly isOpen={true} onClose={onClose} />
    </BrowserRouter>
  );

// Los labels de jugador y comportamiento comparten la palabra del puesto,
// por eso se usa match exacto (string) y no regex.
const fillPlayers = () => {
  SLOTS.forEach(([playerLabel, , playerId]) => {
    fireEvent.change(screen.getByLabelText(playerLabel), { target: { value: playerId } });
  });
};

const fillBehaviors = () => {
  SLOTS.forEach(([, behaviorLabel, , behaviorId]) => {
    fireEvent.change(screen.getByLabelText(behaviorLabel), { target: { value: behaviorId } });
  });
};

const waitForForm = () =>
  waitFor(() => expect(screen.getByLabelText(/nombre del partido/i)).toBeInTheDocument());

describe('CreateFriendly (SCRUM-89)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(playerService, 'getPlayers').mockResolvedValue(mockPlayers);
    vi.spyOn(behaviorService, 'getBehaviors').mockResolvedValue(mockBehaviors);
  });

  it('carga jugadores y comportamientos al abrirse', async () => {
    renderComponent();
    await waitForForm();

    expect(playerService.getPlayers).toHaveBeenCalledTimes(1);
    expect(behaviorService.getBehaviors).toHaveBeenCalledTimes(1);
  });

  it('muestra un selector de comportamiento por cada una de las 6 posiciones', async () => {
    renderComponent();
    await waitForForm();

    SLOTS.forEach(([, behaviorLabel]) => {
      const select = screen.getByLabelText(behaviorLabel);
      expect(select.querySelector('option[value="101"]')).toHaveTextContent('Ofensivo');
      expect(select.querySelector('option[value="102"]')).toHaveTextContent('Defensivo');
      expect(select.querySelector('option[value="103"]')).toHaveTextContent('Equilibrado');
    });
  });

  it('deshabilita el botón de crear si no están las 6 posiciones asignadas o el nombre está vacío', async () => {
    renderComponent();
    await waitForForm();

    expect(screen.getByRole('button', { name: /crear partido/i })).toBeDisabled();
  });

  it('mantiene el botón deshabilitado si faltan los comportamientos', async () => {
    renderComponent();
    await waitForForm();

    fireEvent.change(screen.getByLabelText(/nombre del partido/i), { target: { value: 'Amistoso Test' } });
    fillPlayers();

    expect(screen.getByRole('button', { name: /crear partido/i })).toBeDisabled();
  });

  it('mantiene el botón deshabilitado si falta un solo comportamiento', async () => {
    renderComponent();
    await waitForForm();

    fireEvent.change(screen.getByLabelText(/nombre del partido/i), { target: { value: 'Amistoso Test' } });
    fillPlayers();
    fillBehaviors();
    fireEvent.change(screen.getByLabelText('Suplente 3 - Comportamiento'), { target: { value: '' } });

    expect(screen.getByRole('button', { name: /crear partido/i })).toBeDisabled();
  });

  it('deshabilita la opción de un jugador en otros selectores cuando ya fue seleccionado', async () => {
    renderComponent();
    await waitForForm();

    fireEvent.change(screen.getByLabelText('Delantero'), { target: { value: '1' } });

    const midfieldSelect = screen.getByLabelText('Mediocampista');
    expect(midfieldSelect.querySelector('option[value="1"]')).toBeDisabled();
  });

  it('permite repetir el mismo comportamiento en varias posiciones', async () => {
    renderComponent();
    await waitForForm();

    fireEvent.change(screen.getByLabelText('Delantero - Comportamiento'), { target: { value: '101' } });

    const midfieldBehavior = screen.getByLabelText('Mediocampista - Comportamiento');
    expect(midfieldBehavior.querySelector('option[value="101"]')).not.toBeDisabled();
  });

  it('crea el partido con los comportamientos elegidos y navega a la vista de espera', async () => {
    const createSpy = vi
      .spyOn(friendlyService, 'createFriendlyMatch')
      .mockResolvedValue({ id: 100, status: 'scheduled' });
    const onCloseMock = vi.fn();

    renderComponent(onCloseMock);
    await waitForForm();

    fireEvent.change(screen.getByLabelText(/nombre del partido/i), { target: { value: 'Amistoso Test' } });
    fillPlayers();
    fillBehaviors();

    const submitBtn = screen.getByRole('button', { name: /crear partido/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/matches/100');
    });

    expect(createSpy).toHaveBeenCalledWith({
      name: 'Amistoso Test',
      members: [
        { playerId: 1, role: 'forward', behaviorId: 101 },
        { playerId: 2, role: 'midfield', behaviorId: 102 },
        { playerId: 3, role: 'defense', behaviorId: 103 },
        { playerId: 4, role: 'substitute', behaviorId: 101 },
        { playerId: 5, role: 'substitute', behaviorId: 102 },
        { playerId: 6, role: 'substitute', behaviorId: 103 },
      ],
    });
  });

  it('muestra el mensaje del backend si falla la creación y no navega', async () => {
    vi.spyOn(friendlyService, 'createFriendlyMatch').mockRejectedValue({
      response: { data: { message: 'Ya estás disputando otro partido.' } },
    });

    renderComponent();
    await waitForForm();

    fireEvent.change(screen.getByLabelText(/nombre del partido/i), { target: { value: 'Amistoso Test' } });
    fillPlayers();
    fillBehaviors();
    fireEvent.click(screen.getByRole('button', { name: /crear partido/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya estás disputando otro partido.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('muestra un error si no se pueden cargar los comportamientos', async () => {
    behaviorService.getBehaviors.mockRejectedValue(new Error('Fallo de red'));

    renderComponent();

    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo de red');
  });
});