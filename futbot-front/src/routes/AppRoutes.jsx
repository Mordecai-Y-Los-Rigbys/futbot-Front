import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import Behaviors from '../pages/Behaviors';
import BehaviorDetail from '../pages/BehaviorDetail';
import Register from '../pages/Register';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* El detalle es una ruta anidada: se dibuja como popup encima de la lista
            (Behaviors renderiza un <Outlet />), que sigue montada detrás. */}
        <Route path="/behaviors" element={<Behaviors />}>
          <Route path=":id" element={<BehaviorDetail />} />
        </Route>
        <Route path="/registro" element={<Register />} />
        <Route path="/login" element={<div style={{ padding: '20px' }}>Pantalla de Login</div>} />
      </Routes>
    </BrowserRouter>
  );
}