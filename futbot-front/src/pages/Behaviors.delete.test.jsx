import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Behaviors from './Behaviors';
import { getBehaviors } from '../services/behaviorService';

vi.mock('../services/behaviorService', () => ({
  getBehaviors: vi.fn(),
  createBehavior: vi.fn(),
  updateBehavior: vi.fn(),
  PAGE_SIZE: 50,
}));
vi.mock('../components/BehaviorCodeEditor', () => import('../test/BehaviorCodeEditorMock'));
vi.mock('../components/TestBehaviorButton', () => ({ default: () => null }));

const response = (items) => ({ items, page: 1, pageSize: 50, total: items.length });
const flush = () => act(async () => {});

// Hace de detalle: avisa a la lista como lo hace BehaviorDetail al borrar.
function RemoveStub({ message }) {
  const { onBehaviorRemoved } = useOutletContext();
  return (
    <button type="button" onClick={() => onBehaviorRemoved(message)}>
      simular borrado
    </button>
  );
}

const renderList = (message = 'Comportamiento eliminado') =>
  render(
    <MemoryRouter initialEntries={['/behaviors/1']}>
      <Routes>
        <Route path="/behaviors" element={<Behaviors />}>
          <Route path=":id" element={<RemoveStub message={message} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('Behaviors: aviso al eliminar desde el detalle', () => {
  beforeEach(() => {
    getBehaviors.mockReset();
  });

  it('muestra el aviso y vuelve a pedir el listado, que ya no trae el eliminado', async () => {
    getBehaviors.mockResolvedValueOnce(
      response([
        { id: 1, name: 'Defensor' },
        { id: 2, name: 'Atacante' },
      ]),
    );
    renderList();
    await flush();
    expect(screen.getByRole('link', { name: 'Defensor' })).toBeInTheDocument();

    getBehaviors.mockResolvedValueOnce(response([{ id: 2, name: 'Atacante' }]));
    fireEvent.click(screen.getByRole('button', { name: 'simular borrado' }));
    await flush();

    expect(screen.getByRole('status')).toHaveTextContent('Comportamiento eliminado');
    expect(getBehaviors).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('link', { name: 'Defensor' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Atacante' })).toBeInTheDocument();
  });

  it('también muestra los demás avisos que manda el detalle (ej: ya no existe)', async () => {
    getBehaviors.mockResolvedValue(response([{ id: 2, name: 'Atacante' }]));
    renderList('El comportamiento ya no existe.');
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'simular borrado' }));
    await flush();

    expect(screen.getByRole('status')).toHaveTextContent('El comportamiento ya no existe.');
  });
});
