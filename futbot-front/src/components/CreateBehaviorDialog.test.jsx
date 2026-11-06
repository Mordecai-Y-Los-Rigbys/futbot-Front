import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateBehaviorDialog from './CreateBehaviorDialog';
import { createBehavior } from '../services/behaviorService';

vi.mock('../services/behaviorService', () => ({ createBehavior: vi.fn() }));
vi.mock('./BehaviorCodeEditor', () => import('../test/BehaviorCodeEditorMock'));

const httpError = (status, data = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const flush = () => act(async () => {});

const onClose = vi.fn();
const onCreated = vi.fn();

const renderDialog = () => render(<CreateBehaviorDialog onClose={onClose} onCreated={onCreated} />);

const fill = (name = 'Atacante', code = 'move = 1') => {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Código'), { target: { value: code } });
};

const confirm = () => screen.getByRole('button', { name: 'Confirmar' });

describe('CreateBehaviorDialog', () => {
  beforeEach(() => {
    createBehavior.mockReset();
    onClose.mockReset();
    onCreated.mockReset();
  });

  describe('render', () => {
    it('muestra los campos, el selector de tipo y el botón deshabilitado', () => {
      renderDialog();

      expect(screen.getByRole('dialog', { name: 'Crear comportamiento' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('');
      expect(screen.getByLabelText('Código')).toHaveValue('');
      expect(screen.getByLabelText('Tipo')).toHaveValue('playerBehavior');
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

  describe('selección de tipo', () => {
    it('permite elegir jugador o DT y envía el tipo elegido', async () => {
      createBehavior.mockResolvedValue({ id: 1, name: 'Táctico' });
      renderDialog();
      expect(screen.getAllByRole('option').map((o) => o.value)).toEqual([
        'playerBehavior',
        'coachBehavior',
      ]);

      fill('Táctico');
      fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'coachBehavior' } });
      fireEvent.click(confirm());
      await flush();

      expect(createBehavior).toHaveBeenCalledWith({
        name: 'Táctico',
        code: 'move = 1',
        type: 'coachBehavior',
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
        fill('Atacante', 'for i in x:\n  pass');
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
      expect(onCreated).toHaveBeenCalledWith(created);
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
      fill('Atacante', 'move = 1', 'coachBehavior');
      fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'coachBehavior' } });

      fireEvent.click(confirm());
      await flush();

      expect(screen.getByRole('alert')).toHaveTextContent(text);
      expect(screen.getByLabelText('Nombre')).toHaveValue('Atacante');
      expect(screen.getByLabelText('Código')).toHaveValue('move = 1');
      expect(screen.getByLabelText('Tipo')).toHaveValue('coachBehavior');
      expect(confirm()).toBeEnabled();
      expect(onCreated).not.toHaveBeenCalled();
    });

    it('409 invalidCode marca la ubicación que informa el servidor', async () => {
    createBehavior.mockRejectedValue(
        httpError(409, {
        code: 'invalidCode',
        message: 'x',
        codeError: { rule: 'primitiveAssignmentNotAllowed', line: 2, column: 1, message: 'No se puede asignar a una primitiva.' },
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
});