import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import Behaviors from '../pages/Behaviors';
import BehaviorDetail from '../pages/BehaviorDetail';
import { useState } from 'react';
import Register from '../pages/Register';
import LoginScreen from '../pages/Login';
import Match from '../pages/Match';

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
        <Route path="/matches/:id" element={<Match />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/login" element={<LoginScreen form={loginForm} setForm={setLoginForm} />} />
      </Routes>
    </BrowserRouter>
  );
}