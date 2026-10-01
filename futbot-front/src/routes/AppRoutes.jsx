import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import Behaviors from '../pages/Behaviors';
import Register from '../pages/Register';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div style={{ padding: '20px' }}>Página de Inicio</div>} />
        <Route path="/registro" element={<Register />} />
        <Route path="/login" element={<div style={{ padding: '20px' }}>Pantalla de Login</div>} />
        <Route path="/behaviors" element={<Behaviors />} />
      </Routes>
    </BrowserRouter>
  );
}
