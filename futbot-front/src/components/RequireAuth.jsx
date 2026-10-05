import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Envuelve las rutas que necesitan sesión. Con usuario deja pasar (<Outlet />);
// sin usuario redirige a /login.
export default function RequireAuth() {
  const { user, isCheckingSession } = useAuth();
  const location = useLocation();

  // Hasta que no termina el chequeo inicial de sesión (GET /users/me) no sabemos si
  // hay usuario; redirigir antes mandaría a /login incluso con la cookie vigente.
  if (isCheckingSession) return <p role="status">Cargando…</p>;

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <Outlet />;
}