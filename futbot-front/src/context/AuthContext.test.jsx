import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext.jsx';
import RequireAuth from '../components/RequireAuth.jsx';
import { getCurrentUser } from '../services/authService.js';

vi.mock('../services/authService.js', () => ({ getCurrentUser: vi.fn() }));

const renderApp = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<p>LOGIN</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/private" element={<p>PRIVADA</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

describe('AuthProvider + RequireAuth', () => {
  it('espera al chequeo de sesión y deja pasar si hay usuario (sin pasar por /login)', async () => {
    getCurrentUser.mockResolvedValue({ id: 1, username: 'santi', clubName: 'FC Santi' });
    renderApp();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(await screen.findByText('PRIVADA')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN')).not.toBeInTheDocument();
  });

  it('sin sesión (401) redirige a /login', async () => {
    getCurrentUser.mockRejectedValue({ response: { status: 401 } });
    renderApp();

    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
  });
});
