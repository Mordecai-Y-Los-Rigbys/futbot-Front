import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeaguePasswordForm from './LeaguePasswordForm';
import { unlockLeague } from '../services/leagueService';

// Servicio falso: ninguna petición sale de verdad.
vi.mock('../services/leagueService');

const httpError = (status, code) => ({ response: { status, data: { code } } });

function renderForm() {
  const onSuccess = vi.fn();
  const onBack = vi.fn();
  render(
    <MemoryRouter initialEntries={['/leagues/5']}>
      <Routes>
        <Route
          path="/leagues/:id"
          element={
            <LeaguePasswordForm
              leagueId="5"
              leagueName="Liga del barrio"
              onSuccess={onSuccess}
              onBack={onBack}
            />
          }
        />
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route path="/leagues" element={<p>Listado de ligas</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onSuccess, onBack };
}

const campo = () => screen.getByLabelText('Contraseña de la liga');
const botonEntrar = () => screen.getByRole('button', { name: /entrar|entrando/i });

describe('LeaguePasswordForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('muestra el nombre de la liga y un campo de contraseña oculto, obligatorio y de hasta 72 caracteres', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'Liga del barrio' })).toBeInTheDocument();
    expect(campo()).toHaveAttribute('type', 'password');
    expect(campo()).toBeRequired();
    expect(campo()).toHaveAttribute('maxlength', '72');
  });

  it('"Entrar" está deshabilitado con el campo vacío y se habilita al escribir', async () => {
    renderForm();

    expect(botonEntrar()).toBeDisabled();

    await userEvent.type(campo(), 'x');

    expect(botonEntrar()).toBeEnabled();
  });

  it('"Volver" avisa para volver al listado', async () => {
    const { onBack } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('con la contraseña correcta (204) llama a onSuccess y limpia el campo', async () => {
    unlockLeague.mockResolvedValue(undefined);
    const { onSuccess } = renderForm();

    await userEvent.type(campo(), 'secreta');
    await userEvent.click(botonEntrar());

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(unlockLeague).toHaveBeenCalledWith('5', { password: 'secreta' });
    expect(campo()).toHaveValue('');
  });

  it('mientras se envía deshabilita el botón y no permite envíos duplicados', async () => {
    let terminar;
    unlockLeague.mockReturnValue(new Promise((resolve) => { terminar = resolve; }));
    const { onSuccess } = renderForm();

    await userEvent.type(campo(), 'secreta');
    await userEvent.click(botonEntrar());

    const botonEnviando = await screen.findByRole('button', { name: /entrando/i });
    expect(botonEnviando).toBeDisabled();
    await userEvent.click(botonEnviando);
    expect(unlockLeague).toHaveBeenCalledTimes(1);

    terminar();
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('403 invalidLeaguePassword: muestra "Contraseña incorrecta", limpia el campo y sigue en el formulario', async () => {
    unlockLeague.mockRejectedValue(httpError(403, 'invalidLeaguePassword'));
    const { onSuccess } = renderForm();

    await userEvent.type(campo(), 'mala');
    await userEvent.click(botonEntrar());

    expect(await screen.findByText('Contraseña incorrecta')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(campo()).toHaveValue('');
  });

  it('401: redirige al login', async () => {
    unlockLeague.mockRejectedValue(httpError(401));
    renderForm();

    await userEvent.type(campo(), 'secreta');
    await userEvent.click(botonEntrar());

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument();
  });

  it('404: redirige al listado de ligas', async () => {
    unlockLeague.mockRejectedValue(httpError(404));
    renderForm();

    await userEvent.type(campo(), 'secreta');
    await userEvent.click(botonEntrar());

    expect(await screen.findByText('Listado de ligas')).toBeInTheDocument();
  });

  it('otro error: muestra un aviso de error y se puede reintentar', async () => {
    unlockLeague.mockRejectedValue(new Error('Network Error'));
    renderForm();

    await userEvent.type(campo(), 'secreta');
    await userEvent.click(botonEntrar());

    expect(await screen.findByText(/no pudimos verificar la contraseña/i)).toBeInTheDocument();
    await userEvent.type(campo(), 'otra');
    expect(botonEntrar()).toBeEnabled();
  });

  it('la contraseña no se guarda en ningún almacenamiento del navegador', async () => {
    unlockLeague.mockResolvedValue(undefined);
    renderForm();

    await userEvent.type(campo(), 'secreta');
    await userEvent.click(botonEntrar());

    await vi.waitFor(() => expect(unlockLeague).toHaveBeenCalled());
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
