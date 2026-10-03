import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Register from '../pages/Register';
import LoginScreen from '../pages/Login';
import Behaviors from '../pages/Behaviors';
import Players from '../pages/Players';
import CreatePlayerPage from '../pages/CreatePlayerPage';

export default function AppRoutes() {
  // El estado vive acá para que no se pierda al navegar entre pantallas
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div style={{ padding: '20px' }}>Página de Inicio</div>} />
        <Route path="/registro" element={<Register />} />
        <Route path="/login" element={<LoginScreen form={loginForm} setForm={setLoginForm} />} />
        <Route path="/behaviors" element={<Behaviors />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/new" element={<CreatePlayerPage />} />
      </Routes>
    </BrowserRouter>
  );
}