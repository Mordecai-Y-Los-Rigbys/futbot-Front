import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BehaviorFormDialog from './BehaviorFormDialog';
import { createBehavior, updateBehavior } from '../services/behaviorService';

vi.mock('../services/behaviorService', () => ({ createBehavior: vi.fn(), updateBehavior: vi.fn() }));
vi.mock('./BehaviorCodeEditor', () => import('../test/BehaviorCodeEditorMock'));

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const flush = () => act(async () => {});

const onClose = vi.fn();
const onSaved = vi.fn();
const renderDialog = (props = {}) =>
  render(<BehaviorFormDialog onClose={onClose} onSaved={onSaved} {...props} />);

const fill = (name = 'Atacante', code = 'move = 1') => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Código'), { target: { value: code } });
};

const confirm = () => screen.getByRole('button', { name: 'Confirmar' });

describe('CreateBehaviorDialog', () => {
  beforeEach(() => {
    createBehavior.mockReset();
    updateBehavior.mockReset();
    onClose.mockReset();
    onSaved.mockReset();
  });

  describe('render', () => {
    it('muestra los campos y el botón deshabilitado', () => {
      renderDialog();

      expect(screen.getByRole('dialog', { name: 'Crear comportamiento' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('');
      expect(screen.getByLabelText('Código')).toHaveValue('');
      expect(confirm()).toBeDisabled();
    });

    it('Cancelar, × y Escape cierran el formulario', () => {
      renderDialog();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(3);
    });
  });

  describe('tipo de comportamiento', () => {
    it('no muestra ningún selector de tipo', () => {
      renderDialog();

      expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('siempre envía playerBehavior', async () => {
      createBehavior.mockResolvedValue({ id: 1, name: 'Táctico' });
      renderDialog();

      fill('Táctico');
      fireEvent.click(confirm());
      await flush();

      expect(createBehavior).toHaveBeenCalledWith({
        name: 'Táctico',
        code: 'move = 1',
        type: 'playerBehavior',
      });
    });
  });

  describe('botón deshabilitado', () => {
    it.each([
      ['nombre vacío', '', 'move = 1'],
      ['nombre de solo espacios', '   ', 'move = 1'],
      ['código vacío', 'Atacante', ''],
      ['código de solo espacios', 'Atacante', '  \n '],
    ])('con %s', (_, name, code) => {
      renderDialog();
      fill(name, code);

      expect(confirm()).toBeDisabled();
    });

    it('se habilita con nombre y código válidos', () => {
      renderDialog();
      fill();

      expect(confirm()).toBeEnabled();
    });

    it('se deshabilita si el validador del cliente rechaza el código', () => {
      renderDialog();
      fill('Atacante', 'import os');

      expect(confirm()).toBeDisabled();
    });

    it('con más de 250 líneas deshabilita el botón y avisa', () => {
      renderDialog();
      fill('Atacante', 'x = 1\n'.repeat(251));

      expect(confirm()).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('250 líneas');
    });
  });

  describe('resaltado del código con error', () => {
    it('marca la posición del error y muestra línea y columna', () => {
      renderDialog();
      fill('Atacante', 'x = 1\nimport os\ny = 2');

      expect(screen.getByTestId('code-diagnostic')).toHaveTextContent('2:1');
      expect(screen.getByRole('alert')).toHaveTextContent('Línea 2, columna 1');
    });

    it('marca todos los errores a la vez', () => {
      renderDialog();
      fill('Atacante', 'import os\nclass A:\n  pass');

      expect(screen.getAllByTestId('code-diagnostic')).toHaveLength(2);
      expect(screen.getByRole('alert')).toHaveTextContent('Línea 2, columna 1');
    });

    it('sin errores no hay marcas', () => {
      renderDialog();
      fill();

      expect(screen.queryByTestId('code-diagnostic')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('al corregir el código las marcas desaparecen y se habilita el botón', () => {
      renderDialog();
      fill('Atacante', 'import os');
      expect(screen.getByTestId('code-diagnostic')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'move = 1' } });

      expect(screen.queryByTestId('code-diagnostic')).not.toBeInTheDocument();
      expect(confirm()).toBeEnabled();
    });
  });

  describe('201', () => {
    it('envía POST con el nombre sin espacios sobrantes y avisa con el behavior creado', async () => {
      const created = { id: 5, name: 'Atacante', type: 'playerBehavior', code: 'move = 1' };
      createBehavior.mockResolvedValue(created);
      renderDialog();
      fill('  Atacante  ');

      fireEvent.click(confirm());
      await flush();

      expect(createBehavior).toHaveBeenCalledWith({
        name: 'Atacante',
        code: 'move = 1',
        type: 'playerBehavior',
      });
      expect(onSaved).toHaveBeenCalledWith(created);
    });

    it('mientras envía deshabilita todo y evita envíos dobles', async () => {
      createBehavior.mockReturnValue(new Promise(() => {}));
      renderDialog();
      fill();

      fireEvent.click(confirm());

      expect(screen.getByRole('button', { name: 'Creando…' })).toBeDisabled();
      expect(screen.getByLabelText('Nombre')).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Creando…' }));
      expect(createBehavior).toHaveBeenCalledTimes(1);
    });
  });

  describe('errores', () => {
    it.each([
      ['duplicateName', 'Ya tenés un comportamiento con ese nombre'],
      ['codeTooLong', 'demasiado largo'],
      ['invalidCode', 'no respeta la API'],
    ])('409 %s muestra el motivo sin perder lo escrito', async (code, text) => {
      createBehavior.mockRejectedValue(httpError(409, { code, message: 'x', codeError: null }));
      renderDialog();
      fill('Atacante', 'move = 1');

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.getByLabelText('Nombre')).toHaveValue('Atacante');
      expect(screen.getByLabelText('Código')).toHaveValue('move = 1');
      expect(confirm()).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('409 invalidCode marca la ubicación que informa el servidor', async () => {
      createBehavior.mockRejectedValue(
        httpError(409, {
          code: 'invalidCode',
          message: 'x',
          codeError: {
            rule: 'primitiveAssignmentNotAllowed',
            line: 2,
            column: 1,
            message: 'No se puede asignar a una primitiva.',
          },
        }),
      );
      renderDialog();
      fill('Atacante', 'a = 1\nmove = 1');

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByTestId('code-diagnostic')).toHaveTextContent('2:1');
      expect(screen.getByText(/Línea 2, columna 1: No se puede asignar/)).toBeInTheDocument();
    });

    it('la marca del servidor se va cuando se edita el código', async () => {
      createBehavior.mockRejectedValue(
        httpError(409, {
          code: 'invalidCode',
          message: 'x',
          codeError: { rule: 'primitiveAssignmentNotAllowed', line: 1, column: 1, message: 'm' },
        }),
      );
      renderDialog();
      fill('Atacante', 'move = 1');
      fireEvent.click(confirm());
      await flush();

      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'move = 2' } });

      expect(screen.queryByTestId('code-diagnostic')).not.toBeInTheDocument();
    });

    it.each([
      [400, { message: 'Revisá los campos marcados.' }, 'Revisá los campos marcados.'],
      [401, {}, 'Tu sesión venció'],
      [500, {}, 'No se pudo crear el comportamiento'],
    ])('error HTTP %i muestra un mensaje y conserva el formulario', async (status, data, text) => {
      createBehavior.mockRejectedValue(httpError(status, data));
      renderDialog();
      fill();

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.getByLabelText('Nombre')).toHaveValue('Atacante');
      expect(confirm()).toBeEnabled();
    });

    it('un error de red muestra el mensaje de conexión', async () => {
      createBehavior.mockRejectedValue(new Error('Network Error'));
      renderDialog();
      fill();

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent('conexión');
    });
  });

  describe('edición', () => {
    const current = { id: 7, name: 'Atacante', code: 'go_to(1, 2)' };
    const renderEdit = () => renderDialog({ behavior: current });

    it('abre con los valores actuales cargados y sin selector de tipo', () => {
      renderEdit();

      expect(screen.getByRole('dialog', { name: 'Editar comportamiento' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('Atacante');
      expect(screen.getByLabelText('Código')).toHaveValue('go_to(1, 2)');
      expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(confirm()).toBeEnabled();
    });

    it('envía PUT con id, nombre sin espacios y código, sin tipo, y avisa con el resultado', async () => {
      updateBehavior.mockResolvedValue({ id: 7, name: 'Defensor', code: 'go_to(3, 4)' });
      renderEdit();

      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Defensor  ' } });
      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'go_to(3, 4)' } });
      fireEvent.click(confirm());
      await flush();

      expect(updateBehavior).toHaveBeenCalledWith(7, { name: 'Defensor', code: 'go_to(3, 4)' });
      expect(createBehavior).not.toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledWith({ id: 7, name: 'Defensor', code: 'go_to(3, 4)' });
    });

    it('si el PUT no devuelve body, conserva los valores enviados', async () => {
      updateBehavior.mockResolvedValue(undefined);
      renderEdit();

      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo' } });
      fireEvent.click(confirm());
      await flush();

      expect(onSaved).toHaveBeenCalledWith({ id: 7, name: 'Nuevo', code: 'go_to(1, 2)' });
    });

    it('mientras guarda deshabilita todo y evita envíos dobles', async () => {
      updateBehavior.mockReturnValue(new Promise(() => {}));
      renderEdit();

      fireEvent.click(confirm());

      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
      expect(screen.getByLabelText('Nombre')).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Guardando…' }));
      expect(updateBehavior).toHaveBeenCalledTimes(1);
    });

    it('aplica las mismas validaciones que al crear', () => {
      renderEdit();

      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'import os' } });
      expect(confirm()).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('Línea 1, columna 1');

      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'x = 1\n'.repeat(251) } });
      expect(screen.getByRole('alert')).toHaveTextContent('250 líneas');

      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '   ' } });
      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'go_to(1, 2)' } });
      expect(confirm()).toBeDisabled();
    });

    it.each([
      ['duplicateName', 'Ya tenés un comportamiento con ese nombre'],
      ['codeTooLong', 'demasiado largo'],
      ['invalidCode', 'no respeta la API'],
    ])('409 %s muestra el motivo sin perder lo escrito', async (code, text) => {
      updateBehavior.mockRejectedValue(httpError(409, { code, message: 'x', codeError: null }));
      renderEdit();
      fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otro' } });

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.getByLabelText('Nombre')).toHaveValue('Otro');
      expect(screen.getByLabelText('Código')).toHaveValue('go_to(1, 2)');
      expect(confirm()).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('409 invalidCode marca la ubicación que informa el servidor y se va al editar', async () => {
      updateBehavior.mockRejectedValue(
        httpError(409, {
          code: 'invalidCode',
          message: 'x',
          codeError: { rule: 'primitiveAssignmentNotAllowed', line: 1, column: 1, message: 'No se puede asignar.' },
        }),
      );
      renderEdit();

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByTestId('code-diagnostic')).toHaveTextContent('1:1');
      expect(screen.getByText(/Línea 1, columna 1: No se puede asignar/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'go_to(5, 6)' } });
      expect(screen.queryByTestId('code-diagnostic')).not.toBeInTheDocument();
    });

    it.each([
      [400, { message: 'Revisá los campos marcados.' }, 'Revisá los campos marcados.'],
      [401, {}, 'Tu sesión venció'],
      [403, {}, 'No tenés permiso'],
      [404, { code: 'deletedConcurrently' }, 'eliminado mientras lo editabas'],
      [500, {}, 'No se pudo guardar el comportamiento'],
    ])('error HTTP %i muestra un mensaje y conserva el formulario', async (status, data, text) => {
      updateBehavior.mockRejectedValue(httpError(status, data));
      renderEdit();

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.getByLabelText('Nombre')).toHaveValue('Atacante');
      expect(confirm()).toBeEnabled();
    });

    it('un error de red muestra el mensaje de conexión', async () => {
      updateBehavior.mockRejectedValue(new Error('Network Error'));
      renderEdit();

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent('conexión');
    });

    it('valida el código contra el tipo del behavior, sin mostrarlo', () => {
      renderDialog({ behavior: { id: 9, name: 'DT', type: 'coachBehavior', code: 'x = distance(0, 0, 1, 1)' } });

      expect(confirm()).toBeEnabled();
      expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'kick()' } });

      expect(confirm()).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('Línea 1, columna 1');
    });
  });
});