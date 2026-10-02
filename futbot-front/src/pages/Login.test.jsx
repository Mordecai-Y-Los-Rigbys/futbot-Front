import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from './Login';
import { AuthContext } from '../context/AuthContext.jsx';
import { loginUser } from '../services/authService';

// Servicio falso: no se hace ninguna petición real
vi.mock('../services/authService');

// useNavigate falso para poder verificar la redirección
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const setUser = vi.fn();

// En la app el estado del form lo da AppRoutes; acá lo simulamos
function LoginConEstado() {
  const [form, setForm] = useState({ email: '', password: '' });
  return <Login form={form} setForm={setForm} />;
}

function renderLogin() {
  render(
    <AuthContext.Provider value={{ user: null, setUser }}>
      <MemoryRouter>
        <LoginConEstado />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

async function completarYEnviar() {
  await userEvent.type(screen.getByLabelText(/email/i), 'santi@mail.com');
  await userEvent.type(screen.getByLabelText(/contraseña/i), 'secreta123');
  await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
}

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no envía si hay campos vacíos', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it('envío exitoso: llama al servicio, guarda el usuario y redirige', async () => {
    const user = { id: 1, username: 'santi', clubName: 'FC Santi' };
    loginUser.mockResolvedValue(user);

    renderLogin();
    await completarYEnviar();

    expect(loginUser).toHaveBeenCalledWith({ email: 'santi@mail.com', password: 'secreta123' });
    expect(setUser).toHaveBeenCalledWith(user);
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('error 401: muestra el mensaje y no borra el email', async () => {
    loginUser.mockRejectedValue({ response: { status: 401 } });

    renderLogin();
    await completarYEnviar();

    expect(await screen.findByText(/credenciales inválidas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('santi@mail.com');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('fallo de red: muestra un mensaje de error sin romper la app', async () => {
    loginUser.mockRejectedValue(new Error('Network Error')); // sin err.response

    renderLogin();
    await completarYEnviar();

    expect(await screen.findByText(/conexión/i)).toBeInTheDocument();
  });
});