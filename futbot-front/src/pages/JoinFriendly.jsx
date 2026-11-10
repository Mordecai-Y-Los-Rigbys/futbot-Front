import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { joinFriendlyMatch } from '../services/friendlyService';
import TeamForm from '../components/TeamForm';
import useTeamOptions from '../hooks/useTeamOptions';

// Mensaje para mostrar en pantalla según el error del servidor. El `notWaiting` (409) se maneja
// aparte: avisa y vuelve al listado.
function describeJoinError(err) {
  if (!err.response) return 'No se pudo conectar con el servidor.';

  const { status, data } = err.response;
  if (status === 409) {
    switch (data?.code) {
      case 'isOwnMatch':
        return 'No puedes unirte a un partido creado por ti mismo.';
      case 'alreadyPlaying':
        return 'Ya te encuentras disputando otro partido.';
      case 'playerOrBehaviorNotOwned':
        return 'Alguno de los jugadores o comportamientos seleccionados no te pertenece.';
      default:
        return data?.message || 'Conflicto al intentar unirte al partido.';
    }
  }
  if (status === 400) {
    return data?.message || 'Alineación inválida. Verifica que sean 6 jugadores únicos y roles requeridos.';
  }
  if (status === 404) return 'El partido amistoso no existe.';
  return data?.message || 'Ocurrió un error en el servidor.';
}

export default function JoinFriendly() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { players, behaviors, isLoading, error: loadError } = useTeamOptions();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (members) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const match = await joinFriendlyMatch(id, members);
      // Éxito 200 OK: matchId obtenido, redirige al partido
      navigate(`/matches/${match.matchId || match.id}`);
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.code === 'notWaiting') {
        alert('El partido ya no admite rival (ya arrancó o fue cancelado).');
        navigate('/friendlies');
        return;
      }
      setErrorMessage(describeJoinError(err));
      setIsSubmitting(false);
    }
  };

  return (
    <TeamForm
      title="Seleccionar Alineación para Partido Amistoso"
      players={players}
      behaviors={behaviors}
      isLoading={isLoading}
      loadError={loadError}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Confirmar y Unirse"
      submittingLabel="Uniéndose..."
      error={errorMessage}
      onCancel={() => navigate('/friendlies')}
    />
  );
}
