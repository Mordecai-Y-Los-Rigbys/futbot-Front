import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Home from '../pages/Home';
import Behaviors from '../pages/Behaviors';
import BehaviorDetail from '../pages/BehaviorDetail';
import Register from '../pages/Register';
import Leagues from '../pages/Leagues';
import CreateLeague from '../pages/CreateLeague';
import LoginScreen from '../pages/Login';
import Match from '../pages/Match';
import Players from '../pages/Players';
import CreatePlayerPage from '../pages/CreatePlayerPage';
import JoinFriendly from '../pages/JoinFriendly'
import CreateFriendly from '../pages/CreateFriendly';
import Friendlies from '../pages/Friendlies';

export default function AppRoutes() {
  // El estado vive acá para que no se pierda al navegar entre pantallas
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* El detalle es una ruta anidada: se dibuja como popup encima de la lista
            (Behaviors renderiza un <Outlet />), que sigue montada detrás. */}
        <Route path="/behaviors" element={<Behaviors />}>
          <Route path=":id" element={<BehaviorDetail />} />
        </Route>
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/login" element={<LoginScreen form={loginForm} setForm={setLoginForm} />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/new" element={<CreatePlayerPage />} />
        <Route path="/leagues/create" element={<CreateLeague />} />
        <Route path="/friendlies/new" element={<CreateFriendly />} />
        <Route path="/friendlies/:id/members" element={<JoinFriendly />} />
        <Route path="/friendlies" element={<Friendlies />} />
      </Routes>
    </BrowserRouter>
  );
}