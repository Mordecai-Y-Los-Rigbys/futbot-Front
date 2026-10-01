import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BehaviorDetail from './BehaviorDetail';
import { getBehaviorById } from '../services/behaviorService';

vi.mock('../services/behaviorService', () => ({
  getBehaviorById: vi.fn(),
}));

const CODE = 'if (hasBall) { shoot(); }';
const behavior = { id: 7, name: 'Atacante', code: CODE };

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

// Imita a la página de la lista: el detalle se dibuja en su <Outlet />, encima de ella.
const ListLayout = () => (
  <>
    <p>PAGINA LISTA</p>
    <Outlet />
  </>
);

const renderAt = (path = '/behaviors/7') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/behaviors" element={<ListLayout />}>
          <Route path=":id" element={<BehaviorDetail />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const pending = () => new Promise(() => {});

const expectPopupClosedOverList = () => {
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('PAGINA LISTA')).toBeInTheDocument();
};

describe('BehaviorDetail (popup)', () => {
  beforeEach(() => {
    getBehaviorById.mockReset();
    getBehaviorById.mockResolvedValue(behavior);
  });

  describe('carga', () => {
    it('se abre como popup encima de la lista, que sigue visible', async () => {
      renderAt('/behaviors/7');

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('PAGINA LISTA')).toBeInTheDocument();
    });

    it('toma el id de la URL y lo manda al servicio con un signal para cancelar', async () => {
      renderAt('/behaviors/7');

      await screen.findByText(CODE);

      expect(getBehaviorById).toHaveBeenCalledTimes(1);
      expect(getBehaviorById).toHaveBeenCalledWith('7', { signal: expect.any(AbortSignal) });
    });

    it('muestra el skeleton mientras espera la respuesta', () => {
      getBehaviorById.mockReturnValue(pending());

      renderAt();

      expect(screen.getByRole('status', { name: 'Cargando comportamiento' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('cancela la request si el popup se desmonta', () => {
      let signal;
      getBehaviorById.mockImplementation((id, options) => {
        signal = options.signal;
        return pending();
      });

      const { unmount } = renderAt();
      expect(signal.aborted).toBe(false);

      unmount();

      expect(signal.aborted).toBe(true);
    });
  });

  describe('respuesta exitosa', () => {
    it('muestra el nombre y el código del comportamiento', async () => {
      renderAt();

      expect(await screen.findByText(CODE)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Atacante' })).toBeInTheDocument();
    });

    it('oculta el skeleton una vez cargado', async () => {
      renderAt();

      await screen.findByText(CODE);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('errores', () => {
    it.each([
      [404, 'Recurso no encontrado'],
      [403, 'No tenés permiso'],
      [401, 'Tu sesión expiró'],
      [500, 'No pudimos cargar el comportamiento'],
    ])('con un %i muestra un mensaje claro y no el código', async (status, text) => {
      getBehaviorById.mockRejectedValue(httpError(status));

      renderAt();

      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(CODE)).not.toBeInTheDocument();
    });

    it('un error de red (sin respuesta) muestra el mensaje genérico sin romper la app', async () => {
      getBehaviorById.mockRejectedValue(new Error('Network Error'));

      renderAt();

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el comportamiento');
      expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    });
  });

  describe('cerrar el popup', () => {
    it('"Volver" cierra el popup y deja la lista', async () => {
      renderAt();
      await screen.findByText(CODE);

      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

      expectPopupClosedOverList();
    });

    it('"Volver" funciona también si hubo un error', async () => {
      getBehaviorById.mockRejectedValue(httpError(404));
      renderAt();
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

      expectPopupClosedOverList();
    });

    it('el botón de cerrar (×) funciona incluso durante la carga', () => {
      getBehaviorById.mockReturnValue(pending());
      renderAt();

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

      expectPopupClosedOverList();
    });

    it('el botón de cerrar (×) también funciona con el código ya cargado', async () => {
      renderAt();
      await screen.findByText(CODE);

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

      expectPopupClosedOverList();
    });

    it('la tecla Escape cierra el popup', async () => {
      renderAt();
      await screen.findByText(CODE);

      fireEvent.keyDown(document, { key: 'Escape' });

      expectPopupClosedOverList();
    });

    it('hacer clic en el fondo oscuro cierra el popup', async () => {
      renderAt();
      await screen.findByText(CODE);

      fireEvent.click(screen.getByTestId('behavior-overlay'));

      expectPopupClosedOverList();
    });

    it('hacer clic dentro de la ventana NO la cierra', async () => {
      renderAt();
      await screen.findByText(CODE);

      fireEvent.click(screen.getByRole('dialog'));
      fireEvent.click(screen.getByText(CODE));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});