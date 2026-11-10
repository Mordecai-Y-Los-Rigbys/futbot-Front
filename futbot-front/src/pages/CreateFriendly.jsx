import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFriendlyMatch } from '../services/friendlyService';
import TeamForm from '../components/TeamForm';
import useTeamOptions from '../hooks/useTeamOptions';

const NAME_MAX_LENGTH = 20;

// Se usa como página (/friendlies/new). Si se le pasa `onClose`, "Cancelar" y el éxito lo llaman.
// `isOpen` queda por compatibilidad: con false no se monta ni se piden datos.
export default function CreateFriendly({ isOpen = true, onClose }) {
  const navigate = useNavigate();
  const { players, behaviors, isLoading, error: loadError } = useTeamOptions({ enabled: isOpen });

  const [matchName, setMatchName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleClose = onClose ?? (() => navigate('/friendlies'));

  if (!isOpen) return null;

  const trimmedName = matchName.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX_LENGTH;

  const handleSubmit = async (members) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const match = await createFriendlyMatch({ name: trimmedName, members });

      // Solo onClose (no handleClose): si es ruta, no hay que ir al listado antes de ir al partido.
      if (onClose) onClose();
      navigate(`/matches/${match.id}`);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Error al crear el amistoso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TeamForm
      title="Crear Partido Amistoso"
      players={players}
      behaviors={behaviors}
      isLoading={isLoading}
      loadError={loadError}
      loadErrorMessage={
        loadError?.response?.data?.message || loadError?.message || 'Error al cargar jugadores.'
      }
      onSubmit={handleSubmit}
      canSubmit={nameValid}
      isSubmitting={isSubmitting}
      submitLabel="Crear Partido"
      submittingLabel="Creando..."
      error={errorMessage}
      onCancel={handleClose}
    >
      <div className="team-form__field">
        <label htmlFor="friendly-name">Nombre del partido (hasta {NAME_MAX_LENGTH} caracteres)</label>
        <input
          id="friendly-name"
          type="text"
          maxLength={NAME_MAX_LENGTH}
          value={matchName}
          onChange={(event) => {
            setMatchName(event.target.value);
            setErrorMessage('');
          }}
          placeholder="Ej: Clásico amistoso"
        />
        <small className="team-form__hint team-form__hint--end">
          {matchName.length}/{NAME_MAX_LENGTH} caracteres
        </small>
      </div>
    </TeamForm>
  );
}
