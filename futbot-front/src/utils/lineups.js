/**
 * Convierte la respuesta de GET /matches/{id}/lineups en el mapa que consume
 * Pitch2DCanvas: playerId -> { name, role, club }. `club` (1 o 2) permite pintar
 * cada jugador con el color de su equipo sin depender del orden del tick.
 * club2 puede ser null (amistoso sin rival).
 */
export function lineupsToPlayers(lineups) {
  const players = {};
  [
    [1, lineups?.club1],
    [2, lineups?.club2],
  ].forEach(([club, list]) => {
    (list ?? []).forEach(({ playerId, name, role }) => {
      players[playerId] = { name, role, club };
    });
  });
  return players;
}