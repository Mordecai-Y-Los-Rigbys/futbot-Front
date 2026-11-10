import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamForm from './TeamForm';

const players = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Jugador ${index + 1}` }));
const behaviors = [{ id: 11, name: 'Ofensivo' }];

const fillTeam = () => {
  for (let index = 0; index < 6; index += 1) {
    fireEvent.change(screen.getByLabelText('Jugador', { selector: `select[id$="player-${index}"]` }), {
      target: { value: String(index + 1) },
    });
    fireEvent.change(screen.getByLabelText('Comportamiento', { selector: `select[id$="behavior-${index}"]` }), {
      target: { value: '11' },
    });
  }
};

const renderForm = (props = {}) =>
  render(
    <TeamForm
      title="Mi formulario"
      players={players}
      behaviors={behaviors}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      submitLabel="Enviar"
      submittingLabel="Enviando…"
      {...props}
    />,
  );

describe('TeamForm', () => {
  it('muestra el estado de carga y no el formulario', () => {
    renderForm({ isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando jugadores y comportamientos');
    expect(screen.queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument();
  });

  it('avisa lo que falta si no alcanzan los jugadores o los comportamientos', () => {
    renderForm({ players: players.slice(0, 4), behaviors: [] });

    expect(screen.getByText(/necesitás al menos 6 jugadores y tenés 4/i)).toBeInTheDocument();
    expect(screen.getByText(/al menos un comportamiento de jugador/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument();
  });

  it('solo habilita el envío con el equipo completo y los datos extra válidos', () => {
    const { rerender } = renderForm({ canSubmit: false });
    fillTeam();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();

    rerender(
      <TeamForm
        title="Mi formulario"
        players={players}
        behaviors={behaviors}
        onSubmit={vi.fn()}
        submitLabel="Enviar"
        canSubmit
      />,
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  });

  it('envía los seis miembros y muestra el error del servidor con sus detalles', () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit, error: { message: 'Revisá los datos.', details: ['members: invalidTeam'] } });

    fillTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).toHaveBeenCalledWith([
      { playerId: 1, role: 'forward', behaviorId: 11 },
      { playerId: 2, role: 'midfield', behaviorId: 11 },
      { playerId: 3, role: 'defense', behaviorId: 11 },
      { playerId: 4, role: 'substitute', behaviorId: 11 },
      { playerId: 5, role: 'substitute', behaviorId: 11 },
      { playerId: 6, role: 'substitute', behaviorId: 11 },
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent('Revisá los datos.');
    expect(screen.getByText('members: invalidTeam')).toBeInTheDocument();
  });

  it('con envío en curso bloquea los botones y muestra el texto de carga', () => {
    renderForm({ isSubmitting: true });

    expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
