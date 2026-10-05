import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamBuilderForm from './TeamBuilderForm';

const players = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  name: `Jugador ${index + 1}`,
}));
const behaviors = [{ id: 11, name: 'Ofensivo' }];

const selectMember = (index, playerId, behaviorId = 11) => {
  fireEvent.change(screen.getByLabelText('Jugador', { selector: `select[id$="player-${index}"]` }), {
    target: { value: String(playerId) },
  });
  fireEvent.change(screen.getByLabelText('Comportamiento', { selector: `select[id$="behavior-${index}"]` }), {
    target: { value: String(behaviorId) },
  });
};

describe('TeamBuilderForm', () => {
  it('emite null hasta que los seis puestos estén completos', () => {
    const onChange = vi.fn();
    render(<TeamBuilderForm players={players} behaviors={behaviors} value={null} onChange={onChange} />);

    selectMember(0, 1);

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('emite los seis miembros con roles fijos cuando el equipo está completo', () => {
    const onChange = vi.fn();
    render(<TeamBuilderForm players={players} behaviors={behaviors} value={null} onChange={onChange} />);

    for (let index = 0; index < 6; index += 1) {
      selectMember(index, index + 1);
    }

    expect(onChange).toHaveBeenLastCalledWith([
      { playerId: 1, role: 'forward', behaviorId: 11 },
      { playerId: 2, role: 'midfield', behaviorId: 11 },
      { playerId: 3, role: 'defense', behaviorId: 11 },
      { playerId: 4, role: 'substitute', behaviorId: 11 },
      { playerId: 5, role: 'substitute', behaviorId: 11 },
      { playerId: 6, role: 'substitute', behaviorId: 11 },
    ]);
  });

  it('no permite elegir un jugador ya asignado a otro puesto', () => {
    render(<TeamBuilderForm players={players} behaviors={behaviors} value={null} onChange={vi.fn()} />);

    selectMember(0, 1);

    const disabledOptions = screen.getAllByRole('option', { name: 'Jugador 1 (Seleccionado)' });
    expect(disabledOptions).toHaveLength(5);
    disabledOptions.forEach((option) => expect(option).toBeDisabled());
  });

  it('conserva el equipo recibido en value', () => {
    const value = [
      { playerId: 1, role: 'forward', behaviorId: 11 },
      { playerId: 2, role: 'midfield', behaviorId: 11 },
      { playerId: 3, role: 'defense', behaviorId: 11 },
      { playerId: 4, role: 'substitute', behaviorId: 11 },
      { playerId: 5, role: 'substitute', behaviorId: 11 },
      { playerId: 6, role: 'substitute', behaviorId: 11 },
    ];
    render(<TeamBuilderForm players={players} behaviors={behaviors} value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Jugador', { selector: 'select[id$="player-0"]' })).toHaveValue('1');
    expect(screen.getByLabelText('Comportamiento', { selector: 'select[id$="behavior-5"]' })).toHaveValue('11');
  });
});
