import MatchCard from './MatchCard';
import './LeagueFixture.css';

export default function LeagueFixture({ matches, isLoading, error, onRetry }) {
  if (isLoading) return <p className="league-fixture__status" role="status">Cargando fixture…</p>;

  if (error) {
    return (
      <div className="league-fixture__status" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return <p className="league-fixture__status">No hay partidos en el fixture.</p>;
  }

  const active  = matches.filter((m) => m.status === 'started' || m.status === 'scheduled');
  const played  = matches.filter((m) => m.status === 'finished' || m.status === 'cancelled');

  return (
    <section className="league-fixture">
      {active.length > 0 && (
        <>
          <h2 className="league-fixture__heading">Próximos y en curso</h2>
          <ul className="league-fixture__list">
            {active.map((m) => (
              <li key={m.id}><MatchCard match={m} /></li>
            ))}
          </ul>
        </>
      )}
      {played.length > 0 && (
        <>
          <h2 className="league-fixture__heading">Jugados</h2>
          <ul className="league-fixture__list">
            {played.map((m) => (
              <li key={m.id}><MatchCard match={m} /></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
