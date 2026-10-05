import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import MainLayout from '../components/MainLayout';
import RequireAuth from '../components/RequireAuth';

import Home from '../pages/Home';
import Register from '../pages/Register';
import LoginScreen from '../pages/Login';
import Behaviors from '../pages/Behaviors';
import BehaviorDetail from '../pages/BehaviorDetail';
import Leagues from '../pages/Leagues';
import CreateLeague from '../pages/CreateLeague';
import Friendlies from '../pages/Friendlies';
import CreateFriendly from '../pages/CreateFriendly';
import JoinFriendly from '../pages/JoinFriendly';
import Players from '../pages/Players';
import CreatePlayerPage from '../pages/CreatePlayerPage';

// CreateFriendly es un modal: acá lo usamos como página y "Cancelar" vuelve al listado.
// Va como componente aparte porque useNavigate solo funciona dentro del <BrowserRouter>.
function CreateFriendlyPage() {
  const navigate = useNavigate();
  return <CreateFriendly isOpen onClose={() => navigate('/friendlies')} />;
}

export default function AppRoutes() {
  // El estado vive acá para que no se pierda al navegar entre pantallas
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas, sin header */}
        <Route path="/login" element={<LoginScreen form={loginForm} setForm={setLoginForm} />} />
        <Route path="/register" element={<Register />} />

        {/* Protegidas: sin sesión redirigen a /login. */}
        <Route element={<RequireAuth />}>
          {/* Con header: cada pantalla se dibuja en el <Outlet /> de MainLayout. */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />

            {/* El detalle es una ruta anidada: se dibuja como popup encima de la lista
                (Behaviors renderiza un <Outlet />), que sigue montada detrás. */}
            <Route path="/behaviors" element={<Behaviors />}>
              <Route path=":id" element={<BehaviorDetail />} />
            </Route>

            {/* Ligas */}
            <Route path="/leagues" element={<Leagues />} />
            <Route path="/leagues/create" element={<CreateLeague />} />
            {/* TODO: reemplazar por las pantallas reales cuando existan */}
            <Route path="/leagues/:id" element={<p>Detalle de liga (pendiente)</p>} />
            <Route path="/leagues/:id/lobby" element={<p>Lobby de liga (pendiente)</p>} />

            {/* Amistosos */}
            <Route path="/friendlies" element={<Friendlies />} />
            <Route path="/friendlies/new" element={<CreateFriendlyPage />} />
            <Route path="/friendlies/:id/members" element={<JoinFriendly />} />

            {/* Jugadores */}
            <Route path="/players" element={<Players />} />
            <Route path="/players/new" element={<CreatePlayerPage />} />
          </Route>
        </Route>

        {/* Cualquier otra URL va a "/": si no hay sesión, RequireAuth la manda a /login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}