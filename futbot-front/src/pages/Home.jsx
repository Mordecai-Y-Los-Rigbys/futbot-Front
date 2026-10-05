import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Home.module.css';

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
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.notice ?? false);

  return (
    <main className={styles.home}>
      {notice && (
        <div className={styles.notice} role="alert">
          {notice}
        </div>
      )}

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