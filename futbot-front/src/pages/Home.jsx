import { useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function Home() {
  // Mensaje que deja otra pantalla al redirigir (ej: el partido se cerró o falló la conexión).
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.notice ?? null);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {notice && (
        <div
          role="alert"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '560px',
            margin: '0 auto 1.5rem',
            padding: '12px 16px',
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-bg)',
            borderRadius: '6px',
            color: 'var(--text-h)',
            textAlign: 'left',
          }}
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}
      <h1>FutBot</h1>
      <p>Bienvenido a la plataforma de simulación de fútbol 3v3.</p>
      <h2>Prueba Hot Reload Docker</h2>
    </main>
  );
}