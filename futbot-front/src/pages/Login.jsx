import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Login.module.css';

function LoginScreen({ form, setForm }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Datos que llegan cuando nos redirigieron acá:
  // - from: la página protegida que se intentó abrir (la manda RequireAuth)
  // - sessionExpired: lo manda cualquier pantalla que reciba un 401
  const { from, sessionExpired } = location.state ?? {};
  const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : '/';

    const notice = sessionExpired
    ? 'Tu sesión expiró. Iniciá sesión nuevamente para continuar.'
    : false;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // evita que el navegador recargue y mande los datos por la URL
    setErrorMessage(null);

    // Validación en cliente: el ticket pide no enviar campos vacíos
    if (!form.email.trim() || !form.password) {
      setErrorMessage('Completá el email y la contraseña.');
      return;
    }

    setIsLoading(true);

    // Crear el payload esperado por el backend
    const payload = {
      email: form.email,
      password: form.password,
    };

    try {
      const user = await loginUser(payload);

      setUser(user); // función del AuthContext que guarda el usuario en el estado global
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.response?.status === 401) {
        setErrorMessage('Credenciales inválidas.');
      } else if (err.response) {
        setErrorMessage('Error en el servidor. Intentá nuevamente.');
      } else {
        setErrorMessage('No se pudo establecer conexión con el servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>FutBot</h1>
        <h2 className={styles.subtitle}>Login</h2>

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Email:</span>
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </label>

          <label className={styles.field}>
            <span>Contraseña:</span>
            <input type="password" name="password" value={form.password} onChange={handleChange} />
          </label>

          {errorMessage && (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={isLoading}>
            {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className={styles.footer}>
          ¿Aún no tienes cuenta? <Link to="/register">Regístrate aquí</Link>
        </p>
      </div>
    </main>
  );
}

export default LoginScreen;