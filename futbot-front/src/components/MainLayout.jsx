import { Outlet } from 'react-router-dom';
import Header from './Header';

// Layout de las pantallas con header. Se monta una sola vez en AppRoutes:
// el header queda fijo y <Outlet /> dibuja la pantalla que corresponda a la URL.
export default function MainLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}