import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  it('muestra un diálogo con su título y su contenido', () => {
    render(
      <Modal title="Abandonar liga" onClose={vi.fn()}>
        <p>Contenido</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Abandonar liga' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('se cierra con Escape', async () => {
    const onClose = vi.fn();
    render(<Modal title="Título" onClose={onClose} />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no se cierra con Escape mientras está ocupado (request en curso)', async () => {
    const onClose = vi.fn();
    render(<Modal title="Título" onClose={onClose} isBusy />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });
});
