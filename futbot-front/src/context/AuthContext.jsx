import { createContext, useContext, useState } from 'react';

/*
    * AuthContext es el modulo que provee el estado de sesión a toda la app
*/

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // { id, username, clubName } cuando hay sesión, null cuando no
  const [user, setUser] = useState(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
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