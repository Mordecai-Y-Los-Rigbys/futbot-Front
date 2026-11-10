import './LeagueStandings.css';

function formatGoalDiff(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

export default function LeagueStandings({ entries, isLoading, error, onRetry }) {
  if (isLoading) return <p className="league-standings__status" role="status">Cargando ranking…</p>;

  if (error) {
    return (
      <div className="league-standings__status" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return <p className="league-standings__status">El ranking todavía no está disponible.</p>;
  }

  return (
    <div className="league-standings">
      <table className="league-standings__table">
        <thead>
          <tr>
            <th>#</th>
            <th className="league-standings__club-col">Club</th>
            <th title="Partidos jugados">PJ</th>
            <th title="Ganados">PG</th>
            <th title="Empatados">PE</th>
            <th title="Perdidos">PP</th>
            <th title="Diferencia de gol">DG</th>
            <th title="Puntos">Pts</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.name}>
              <td>{i + 1}</td>
              <td className="league-standings__club-col">{entry.name}</td>
              <td>{entry.played}</td>
              <td>{entry.won}</td>
              <td>{entry.drawn}</td>
              <td>{entry.lost}</td>
              <td>{formatGoalDiff(entry.goalDifference)}</td>
              <td className="league-standings__pts">{entry.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
