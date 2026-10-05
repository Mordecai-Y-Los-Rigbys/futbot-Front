import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers } from '../services/playerService';
import { createFriendlyMatch } from '../services/friendlyService';
import './CreateFriendly.css';

const TITULARES = [
  { key: 'forward', label: 'Delantero', role: 'forward' },
  { key: 'midfield', label: 'Mediocampista', role: 'midfield' },
  { key: 'defense', label: 'Defensor', role: 'defense' },
];

const SUPLENTES = [
  { key: 'sub1', label: 'Suplente 1', role: 'substitute' },
  { key: 'sub2', label: 'Suplente 2', role: 'substitute' },
  { key: 'sub3', label: 'Suplente 3', role: 'substitute' },
];

export default function CreateFriendly({ isOpen = true, onClose }) {
  const navigate = useNavigate();

  const [matchName, setMatchName] = useState('');
  const [players, setPlayers] = useState([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedPositions, setSelectedPositions] = useState({
    forward: '',
    midfield: '',
    defense: '',
    sub1: '',
    sub2: '',
    sub3: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingPlayers(true);
    setErrorMessage('');

    getPlayers()
      .then((data) => {
        if (isMounted) {
          setPlayers(Array.isArray(data) ? data : data.players || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err.response?.data?.message || err.message || 'Error al cargar jugadores.';
          setErrorMessage(msg);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlayers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const occupiedPlayerIds = useMemo(() => {
    return new Set(
      Object.values(selectedPositions)
        .filter(Boolean)
        .map(Number)
    );
  }, [selectedPositions]);

  const handlePositionChange = (positionKey, playerId) => {
    setSelectedPositions((prev) => ({
      ...prev,
      [positionKey]: playerId,
    }));
    setErrorMessage('');
  };

  const isFormComplete = useMemo(() => {
    const trimmedName = matchName.trim();
    const hasValidName = trimmedName.length > 0 && trimmedName.length <= 20;
    const allPositionsFilled = Object.values(selectedPositions).every((val) => val !== '');
    return hasValidName && allPositionsFilled && occupiedPlayerIds.size === 6;
  }, [matchName, selectedPositions, occupiedPlayerIds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormComplete || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const allRoles = [...TITULARES, ...SUPLENTES];
    const membersPayload = allRoles.map(({ key, role }) => {
      const pId = Number(selectedPositions[key]);
      const playerObj = players.find((p) => p.id === pId);
      return {
        playerId: pId,
        role: role,
        behaviorId: playerObj?.behaviorId || playerObj?.defaultBehaviorId || 1,
      };
    });

    try {
      const match = await createFriendlyMatch({
        name: matchName.trim(),
        members: membersPayload,
      });

      if (onClose) onClose();
      navigate(`/matches/${match.id}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al crear el amistoso.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderSelector = ({ key, label }) => {
    const currentVal = selectedPositions[key];
    return (
      <div key={key} className="create-friendly-field">
        <label htmlFor={`select-${key}`}>{label}</label>
        <select
          id={`select-${key}`}
          value={currentVal}
          onChange={(e) => handlePositionChange(key, e.target.value)}
          disabled={isSubmitting}
        >
          <option value="">Seleccionar jugador</option>
          {players.map((player) => {
            const isTakenElsewhere = occupiedPlayerIds.has(player.id) && Number(currentVal) !== player.id;
            return (
              <option key={player.id} value={player.id} disabled={isTakenElsewhere}>
                {player.name} {isTakenElsewhere ? '(Ocupado)' : ''}
              </option>
            );
          })}
        </select>
      </div>
    );
  };

  return (
    <div className="create-friendly-backdrop" role="dialog" aria-modal="true">
      <div className="create-friendly-card">
        <h2 className="create-friendly-title">Crear Partido Amistoso</h2>

        {errorMessage && (
          <div className="create-friendly-error" role="alert">
            {errorMessage}
          </div>
        )}

        {isLoadingPlayers ? (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando jugadores disponibles...</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="create-friendly-group">
              <label htmlFor="friendly-name">Nombre del partido (hasta 20 caracteres)</label>
              <input
                id="friendly-name"
                type="text"
                maxLength={20}
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                disabled={isSubmitting}
                placeholder="Ej: Clásico amistoso"
              />
              <span className="create-friendly-char-count">{matchName.length}/20 caracteres</span>
            </div>

            <div className="create-friendly-columns">
              {/* Columna 1: Titulares */}
              <div className="create-friendly-col">
                <div className="create-friendly-section-title">Titulares</div>
                {TITULARES.map(renderSelector)}
              </div>

              {/* Columna 2: Suplentes */}
              <div className="create-friendly-col">
                <div className="create-friendly-section-title">Suplentes</div>
                {SUPLENTES.map(renderSelector)}
              </div>
            </div>

            <div className="create-friendly-actions">
              {onClose && (
                <button
                  type="button"
                  className="create-friendly-btn-cancel"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="create-friendly-btn-submit"
                disabled={!isFormComplete || isSubmitting}
              >
                {isSubmitting ? 'Creando...' : 'Crear Partido'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}