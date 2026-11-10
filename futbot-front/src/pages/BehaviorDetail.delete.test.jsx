import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BehaviorDetail from './BehaviorDetail';
import { deleteBehavior, getBehaviorById } from '../services/behaviorService';

vi.mock('../services/behaviorService', () => ({
  getBehaviorById: vi.fn(),
  updateBehavior: vi.fn(),
  deleteBehavior: vi.fn(),
}));
vi.mock('../components/BehaviorCodeEditor', () => import('../test/BehaviorCodeEditorMock'));

const CODE = 'go_to(1, 2)';
const behavior = { id: 7, name: 'Atacante', type: 'playerBehavior', code: CODE, deletable: true };
const inUse = { ...behavior, deletable: false };

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const onBehaviorUpdated = vi.fn();
const onBehaviorRemoved = vi.fn();
const ListLayout = () => (
  <>
    <p>PAGINA LISTA</p>
    <Outlet context={{ onBehaviorUpdated, onBehaviorRemoved }} />
  </>
);

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/behaviors/7']}>
      <Routes>
        <Route path="/behaviors" element={<ListLayout />}>
          <Route path=":id" element={<BehaviorDetail />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const flush = () => act(async () => {});
const pending = () => new Promise(() => {});

// Con la confirmación abierta, el detalle queda aria-hidden: estos helpers
// buscan en lo que está accesible en cada momento.
const deleteButton = () => screen.getByRole('button', { name: 'Eliminar' });

const loadDetail = async (data = behavior) => {
  getBehaviorById.mockResolvedValue(data);
  renderAt();
  await screen.findByText(CODE);
};

const openConfirm = async (data = behavior) => {
  await loadDetail(data);
  fireEvent.click(deleteButton());
  return screen.getByRole('alertdialog');
};

const confirmDelete = async () => {
  const dialog = screen.getByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
  await flush();
};

const expectPopupClosedOverList = () => {
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('PAGINA LISTA')).toBeInTheDocument();
};

describe('BehaviorDetail: eliminar', () => {
  beforeEach(() => {
    getBehaviorById.mockReset();
    deleteBehavior.mockReset();
    onBehaviorUpdated.mockReset();
    onBehaviorRemoved.mockReset();
  });

  describe('botón "Eliminar"', () => {
    it('siempre está visible en el pie, también mientras carga y deshabilitado', () => {
      getBehaviorById.mockReturnValue(pending());
      renderAt();

      expect(deleteButton()).toHaveAttribute('aria-disabled', 'true');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('también está visible (deshabilitado) si el detalle no pudo cargar', async () => {
      getBehaviorById.mockRejectedValue(httpError(404));
      renderAt();
      await screen.findByRole('alert');

      expect(deleteButton()).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(deleteButton());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('con deletable: true está habilitado y sin motivo', async () => {
      await loadDetail();

      expect(deleteButton()).toHaveAttribute('aria-disabled', 'false');
      expect(deleteButton()).not.toHaveAttribute('aria-describedby');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('con deletable: false está deshabilitado y muestra el motivo (tooltip asociado, alcanzable con foco)', async () => {
      await loadDetail(inUse);

      const button = deleteButton();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      // No usa el atributo `disabled`: así recibe foco y el motivo se lee con teclado.
      expect(button).not.toBeDisabled();
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('El comportamiento está en uso y no se puede eliminar.');
      expect(button).toHaveAttribute('aria-describedby', tooltip.id);

      button.focus();
      expect(button).toHaveFocus();
    });

    it('deshabilitado, hacer clic no abre la confirmación', async () => {
      await loadDetail(inUse);

      fireEvent.click(deleteButton());

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(deleteBehavior).not.toHaveBeenCalled();
    });
  });

  describe('confirmación', () => {
    it('pide confirmar con el nombre y los botones "Eliminar" y "Cancelar"', async () => {
      const dialog = await openConfirm();

      expect(dialog).toHaveAccessibleName('¿Eliminar "Atacante"? No se puede deshacer.');
      expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeEnabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      expect(deleteBehavior).not.toHaveBeenCalled();
    });

    it('"Cancelar" no envía nada, cierra la confirmación y deja el detalle', async () => {
      const dialog = await openConfirm();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Atacante' })).toBeInTheDocument();
      expect(deleteBehavior).not.toHaveBeenCalled();
      expect(deleteButton()).toHaveFocus();
    });

    it('Escape cierra solo la confirmación, no el detalle', async () => {
      await openConfirm();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Atacante' })).toBeInTheDocument();
      expect(deleteBehavior).not.toHaveBeenCalled();
    });

    it('hacer clic en el fondo de la confirmación la cancela sin enviar nada', async () => {
      await openConfirm();

      fireEvent.click(screen.getByTestId('confirm-overlay'));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Atacante' })).toBeInTheDocument();
      expect(deleteBehavior).not.toHaveBeenCalled();
    });
  });

  describe('204', () => {
    it('envía DELETE con el id, cierra el detalle y avisa "Comportamiento eliminado"', async () => {
      deleteBehavior.mockResolvedValue(undefined);
      await openConfirm();

      await confirmDelete();

      expect(deleteBehavior).toHaveBeenCalledTimes(1);
      expect(deleteBehavior).toHaveBeenCalledWith('7');
      expect(onBehaviorRemoved).toHaveBeenCalledExactlyOnceWith('Comportamiento eliminado');
      expectPopupClosedOverList();
    });

    it('mientras elimina deshabilita todo, evita envíos dobles y Escape no cancela', async () => {
      deleteBehavior.mockReturnValue(pending());
      const dialog = await openConfirm();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
      await flush();

      const busy = within(dialog).getByRole('button', { name: 'Eliminando…' });
      expect(busy).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      fireEvent.click(busy);
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.click(screen.getByTestId('confirm-overlay'));

      expect(deleteBehavior).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('errores', () => {
    it.each([
      ['behaviorInLeagueTeam', 'El comportamiento está siendo usado en un equipo.'],
      ['behaviorInMatch', 'El comportamiento está siendo usado en un partido en curso.'],
    ])('409 %s muestra su mensaje, vuelve a pedir el detalle y bloquea el botón', async (code, text) => {
      deleteBehavior.mockRejectedValue(httpError(409, { code, message: 'x' }));
      await openConfirm();
      getBehaviorById.mockResolvedValue(inUse); // el refresco ya trae deletable: false

      await confirmDelete();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Atacante' })).toBeInTheDocument();
      expect(getBehaviorById).toHaveBeenCalledTimes(2);
      expect(deleteButton()).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(onBehaviorRemoved).not.toHaveBeenCalled();
    });

    it('un 409 con un código desconocido usa el mensaje general de "en uso"', async () => {
      deleteBehavior.mockRejectedValue(httpError(409, { code: 'otraCosa' }));
      await openConfirm();

      await confirmDelete();

      expect(screen.getByRole('alert')).toHaveTextContent('El comportamiento está en uso y no se puede eliminar.');
    });

    it('403 muestra el aviso de permiso y vuelve al listado', async () => {
      deleteBehavior.mockRejectedValue(httpError(403));
      await openConfirm();

      await confirmDelete();

      expect(onBehaviorRemoved).toHaveBeenCalledExactlyOnceWith(
        'No tenés permiso para eliminar este comportamiento.',
      );
      expectPopupClosedOverList();
    });

    it('404 muestra "El comportamiento ya no existe." y vuelve al listado', async () => {
      deleteBehavior.mockRejectedValue(httpError(404));
      await openConfirm();

      await confirmDelete();

      expect(onBehaviorRemoved).toHaveBeenCalledExactlyOnceWith('El comportamiento ya no existe.');
      expectPopupClosedOverList();
    });

    it.each([
      [401, {}, 'Tu sesión expiró'],
      [500, {}, 'No pudimos eliminar el comportamiento'],
    ])('error HTTP %i muestra un mensaje y deja el detalle abierto', async (status, data, text) => {
      deleteBehavior.mockRejectedValue(httpError(status, data));
      await openConfirm();

      await confirmDelete();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.getByRole('dialog', { name: 'Atacante' })).toBeInTheDocument();
      expect(deleteButton()).toHaveAttribute('aria-disabled', 'false');
      expect(onBehaviorRemoved).not.toHaveBeenCalled();
    });

    it('un error de red muestra el mensaje de conexión y permite reintentar', async () => {
      deleteBehavior.mockRejectedValueOnce(new Error('Network Error'));
      await openConfirm();

      await confirmDelete();

      expect(screen.getByRole('alert')).toHaveTextContent('conexión');

      deleteBehavior.mockResolvedValueOnce(undefined);
      fireEvent.click(deleteButton());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // el error viejo se limpia
      await confirmDelete();

      expect(deleteBehavior).toHaveBeenCalledTimes(2);
      expect(onBehaviorRemoved).toHaveBeenCalledWith('Comportamiento eliminado');
    });
  });
});
