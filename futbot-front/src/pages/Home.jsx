import { Link } from 'react-router-dom';
import styles from './Home.module.css';

// Accesos rápidos de la pantalla de inicio. Para sumar una sección, agregar un item.
const SECCIONES = [
  {
    to: '/leagues',
    titulo: 'Ligas',
    descripcion: 'Explorá las ligas disponibles, uníte a una o creá la tuya.',
  },
  {
    to: '/friendlies',
    titulo: 'Amistosos',
    descripcion: 'Buscá un rival, uníte a un partido o armá uno nuevo.',
  },
];

export default function Home() {
  return (
    <main className={styles.home}>
      <nav className={styles.cards} aria-label="Secciones">
        {SECCIONES.map((seccion) => (
          <Link key={seccion.to} to={seccion.to} className={styles.card}>
            <h2>{seccion.titulo}</h2>
            <p>{seccion.descripcion}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}