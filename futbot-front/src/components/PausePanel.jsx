import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getNextSubstitutions } from '../services/matchService.js';
import './PausePanel.css';

const PAUSE_TITLES = {
  hydration: 'Pausa de hidratación',
  halftime: 'Entretiempo',
};

function SubstitutionColumn({ testId, title, substitution }) {
  return (
    <div className="pause__side" data-testid={testId}>
      <h3>{title}</h3>
      {substitution && (
        <ul className="pause__list">
          <li className="pause__player">
            <span>{substitution.substituteName}</span>
            <span className="pause__arrow pause__arrow--in" role="img" aria-label="Entra">▲</span>
          </li>
          <li className="pause__player">
            <span>{substitution.starterName}</span>
            <span className="pause__arrow pause__arrow--out" role="img" aria-label="Sale">▼</span>
          </li>
        </ul>
      )}
    </div>
  );
}

/**
 * Cartel de pausa. Se monta cuando empieza `phase: paused` y se desmonta al terminar:
 * cada pausa pide los cambios de nuevo (el back borra la sustitución al terminar la pausa).
 * Cualquier error del endpoint (401, 403, 404, 409, red) solo oculta el panel de cambios;
 * el cartel de pausa sigue mostrándose.
 */
export default function PausePanel({ reason, remainingSeconds, roster }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [substitutions, setSubstitutions] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getNextSubstitutions(id, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setSubstitutions(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSubstitutions(null);
      });
    return () => controller.abort();
  }, [id]);

  const title = PAUSE_TITLES[reason] ?? 'Partido en pausa';

  // club1 va a la izquierda salvo que yo sea el club2.
  const [club1, club2] = roster?.clubs ?? [];
  const mineIsClub2 = !!user && club2?.username === user.username && club1?.username !== user.username;

  const hasSubstitutions = substitutions && (substitutions.club1 || substitutions.club2);
  const mine = mineIsClub2 ? substitutions?.club2 : substitutions?.club1;
  const rival = mineIsClub2 ? substitutions?.club1 : substitutions?.club2;

  return (
    <div className="pause" role="status">
      <p className="pause__title">{title}</p>
      {remainingSeconds != null && <p className="pause__remaining">Vuelve en {remainingSeconds} s</p>}

      {hasSubstitutions && (
        <div className="pause__subs">
          <SubstitutionColumn testId="subs-mine" title="Mi equipo" substitution={mine} />
          <SubstitutionColumn testId="subs-rival" title="Rival" substitution={rival} />
        </div>
      )}
    </div>
  );
}