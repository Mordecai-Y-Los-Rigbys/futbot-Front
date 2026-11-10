import { useEffect, useState } from 'react';
import { getBehaviors } from '../services/behaviorService';
import { getPlayers } from '../services/playerService';

const toList = (data, key) => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
};

/**
 * Jugadores y comportamientos de jugador del usuario, para armar un equipo.
 * Lo usan los cuatro formularios de equipo (crear/unirse a liga, crear/unirse a amistoso).
 *
 * `enabled: false` evita pedir los datos (por ejemplo, un modal cerrado).
 * `error` es el error original de la request, para que cada pantalla arme su mensaje.
 */
export default function useTeamOptions({ enabled = true } = {}) {
  const [state, setState] = useState({
    players: [],
    behaviors: [],
    isLoading: enabled,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const { signal } = controller;
    setState((current) => ({ ...current, isLoading: true, error: null }));

    Promise.all([
      getPlayers(1, { signal }),
      // Un equipo solo lleva comportamientos de jugador (no de director técnico).
      getBehaviors('', 1, { signal, type: 'playerBehavior' }),
    ])
      .then(([playersData, behaviorsData]) => {
        if (signal.aborted) return;
        setState({
          players: toList(playersData, 'players'),
          behaviors: toList(behaviorsData, 'items'),
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (signal.aborted) return;
        setState((current) => ({ ...current, isLoading: false, error }));
      });

    return () => controller.abort();
  }, [enabled]);

  return state;
}
