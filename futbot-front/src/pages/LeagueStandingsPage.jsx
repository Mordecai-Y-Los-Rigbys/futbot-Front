import { useParams } from 'react-router-dom';
import LeagueStandings from '../components/LeagueStandings';
import useLeagueSocket from '../hooks/useLeagueSocket';
import './LeagueStandingsPage.css';

export default function LeagueStandingsPage() {
  const { id } = useParams();
  const { message, status, closeInfo, retry } = useLeagueSocket(id, 'ranking');

  const isLoading = status === 'connecting' || status === 'reconnecting';
  const error = (status === 'closed' && closeInfo)
    ? 'No pudimos cargar el ranking. Revisá tu conexión e intentá de nuevo.'
    : null;

  const entries = message?.ranking ?? null;

  return (
    <main className="league-standings-page">
      <h1>Ranking de liga</h1>
      <LeagueStandings
        entries={entries}
        isLoading={isLoading && !entries}
        error={error}
        onRetry={error ? retry : null}
      />
    </main>
  );
}
