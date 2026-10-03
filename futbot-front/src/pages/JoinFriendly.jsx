import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlayers } from '../services/playerService';
import { getBehaviors } from '../services/behaviorService';
import { joinFriendlyMatch } from '../services/friendlyService';
import './JoinFriendly.css';

const INITIAL_MEMBERS = [
  { role: 'forward', label: 'Titular Delantero', playerId: '', behaviorId: '' },
  { role: 'midfield', label: 'Titular Mediocampista', playerId: '', behaviorId: '' },
  { role: 'defense', label: 'Titular Defensor', playerId: '', behaviorId: '' },
  { role: 'substitute', label: 'Suplente 1', playerId: '', behaviorId: '' },
  { role: 'substitute', label: 'Suplente 2', playerId: '', behaviorId: '' },
  { role: 'substitute', label: 'Suplente 3', playerId: '', behaviorId: '' },
];

export default function JoinFriendly() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState([]);
  const [behaviors, setBehaviors] = useState([]);
  const [members, setMembers] = useState(INITIAL_MEMBERS);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getPlayers(1, { signal: controller.signal }),
      getBehaviors('', 1, { signal: controller.signal }),
    ])
      .then(([playersData, behaviorsData]) => {
        setPlayers(playersData);
        const behaviorsList = Array.isArray(behaviorsData) ? behaviorsData : (behaviorsData?.items ?? []);
        setBehaviors(behaviorsList);
        setIsLoadingData(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setErrorMessage('No pudimos cargar tus jugadores o comportamientos.');
        setIsLoadingData(false);
      });

    return () => controller.abort();
  }, []);

  const handleMemberChange = (index, field, value) => {
    setMembers((prev) => {
      const updated = [...prev];
      const parsedValue = value === '' ? '' : parseInt(value, 10);
      updated[index] = { ...updated[index], [field]: parsedValue };
      return updated;
    });
  };

  const selectedPlayerIds = members
    .map((m) => m.playerId)
    .filter((pid) => pid !== '');

  const isFormComplete =
    members.every((m) => m.playerId !== '' && m.behaviorId !== '') &&
    new Set(selectedPlayerIds).size === 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormComplete || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const payload = members.map((m) => ({
      playerId: m.playerId,
      role: m.role,
      behaviorId: m.behaviorId,
    }));

    try {
      const match = await joinFriendlyMatch(id, payload);
      // Éxito 200 OK: matchId obtenido, redirige al partido
      const targetMatchId = match.matchId || match.id;
      navigate(`/matches/${targetMatchId}`);
    } catch (err) {
      if (err.response) {
        const { status, data } = err.response;
        const code = data?.code;

        if (status === 409) {
          switch (code) {
            case 'notWaiting':
              alert('El partido ya no admite rival (ya arrancó o fue cancelado).');
              navigate('/friendlies');
              return;
            case 'isOwnMatch':
              setErrorMessage('No puedes unirte a un partido creado por ti mismo.');
              break;
            case 'alreadyPlaying':
              setErrorMessage('Ya te encuentras disputando otro partido.');
              break;
            case 'playerOrBehaviorNotOwned':
              setErrorMessage('Alguno de los jugadores o comportamientos seleccionados no te pertenece.');
              break;
            default:
              setErrorMessage(data?.message || 'Conflicto al intentar unirte al partido.');
          }
        } else if (status === 400) {
          setErrorMessage(data?.message || 'Alineación inválida. Verifica que sean 6 jugadores únicos y roles requeridos.');
        } else if (status === 404) {
          setErrorMessage('El partido amistoso no existe.');
        } else {
          setErrorMessage(data?.message || 'Ocurrió un error en el servidor.');
        }
      } else {
        setErrorMessage('No se pudo conectar con el servidor.');
      }
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando jugadores y comportamientos…</div>;
  }

  return (
    <main className="join-friendly">
      <h2>Seleccionar Alineación para Partido Amistoso</h2>

      {errorMessage && <div className="join-friendly__error">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className="join-friendly__section">
          <h3>Titulares</h3>
          {members.slice(0, 3).map((member, idx) => (
            <div key={member.label} className="join-friendly__slot">
              <strong>{member.label}</strong>
              <div className="join-friendly__row">
                <div className="join-friendly__field">
                  <label htmlFor={`player-${idx}`}>Jugador</label>
                  <select
                    id={`player-${idx}`}
                    value={member.playerId}
                    onChange={(e) => handleMemberChange(idx, 'playerId', e.target.value)}
                  >
                    <option value="">-- Seleccionar Jugador --</option>
                    {players.map((p) => {
                      const isTakenElsewhere =
                        selectedPlayerIds.includes(p.id) && member.playerId !== p.id;
                      return (
                        <option key={p.id} value={p.id} disabled={isTakenElsewhere}>
                          {p.name} {isTakenElsewhere ? '(Seleccionado)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="join-friendly__field">
                  <label htmlFor={`behavior-${idx}`}>Comportamiento</label>
                  <select
                    id={`behavior-${idx}`}
                    value={member.behaviorId}
                    onChange={(e) => handleMemberChange(idx, 'behaviorId', e.target.value)}
                  >
                    <option value="">-- Seleccionar Comportamiento --</option>
                    {behaviors.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="join-friendly__section">
          <h3>Suplentes</h3>
          {members.slice(3, 6).map((member, i) => {
            const idx = i + 3;
            return (
              <div key={member.label} className="join-friendly__slot">
                <strong>{member.label}</strong>
                <div className="join-friendly__row">
                  <div className="join-friendly__field">
                    <label htmlFor={`player-${idx}`}>Jugador</label>
                    <select
                      id={`player-${idx}`}
                      value={member.playerId}
                      onChange={(e) => handleMemberChange(idx, 'playerId', e.target.value)}
                    >
                      <option value="">-- Seleccionar Jugador --</option>
                      {players.map((p) => {
                        const isTakenElsewhere =
                          selectedPlayerIds.includes(p.id) && member.playerId !== p.id;
                        return (
                          <option key={p.id} value={p.id} disabled={isTakenElsewhere}>
                            {p.name} {isTakenElsewhere ? '(Seleccionado)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="join-friendly__field">
                    <label htmlFor={`behavior-${idx}`}>Comportamiento</label>
                    <select
                      id={`behavior-${idx}`}
                      value={member.behaviorId}
                      onChange={(e) => handleMemberChange(idx, 'behaviorId', e.target.value)}
                    >
                      <option value="">-- Seleccionar Comportamiento --</option>
                      {behaviors.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="join-friendly__actions">
          <button
            type="button"
            className="join-friendly__btn-cancel"
            onClick={() => navigate('/friendlies')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="join-friendly__btn-submit"
            disabled={!isFormComplete || isSubmitting}
          >
            {isSubmitting ? 'Uniéndose...' : 'Confirmar y Unirse'}
          </button>
        </div>
      </form>
    </main>
  );
}
