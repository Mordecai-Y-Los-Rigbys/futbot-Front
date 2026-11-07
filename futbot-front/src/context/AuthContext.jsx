import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getCurrentUser } from '../services/authService.js';

export const AuthContext = createContext(null);

// Marca en localStorage de que este navegador ya tuvo sesión (para el aviso de sesión expirada).
const SESSION_FLAG = 'futbot:hadSession';


export function AuthProvider({ children }) {
  // { id, username, clubName } cuando hay sesión, null cuando no
  const [user, setUser] = useState(null);
  // true mientras se consulta si la cookie de sesión sigue vigente
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Al montar la app, preguntamos al backend si la cookie de sesión sigue vigente
  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((data) => {
        if (active) setUser(data);
      })
      .catch(() => {
        if (active) setUser(null); // 401: no hay sesión
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Cuando hay usuario, dejamos marcado que este navegador tuvo sesión.
  // Así, si después nos redirigen al login, sabemos que la sesión venció.
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(SESSION_FLAG, '1');
    } catch {
      // sin localStorage, simplemente no se muestra el aviso de sesión expirada
    }
  }, [user]);


  return (
    <AuthContext.Provider value={{ user, setUser, isCheckingSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para consumirlo cómodo desde cualquier componente
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}