// Utilidades de la tanda de penales (ver AsyncAPI: `penaltyKicks`, `penaltyCurrent`, `PenaltyShootout`).
// Los clubes se identifican por lado (club1/club2), nunca por nombre: dos clubes pueden llamarse igual.

export const PENALTY_ROUNDS = 5;

export const EMPTY_KICKS = [];

/** 'club1' -> 1, 'club2' -> 2 (el número que usan los colores y el roster). */
export const sideNumber = (side) => (side === 'club2' ? 2 : 1);

const sameKick = (a, b) =>
  a.club === b.club &&
  a.kickerId === b.kickerId &&
  a.kickerName === b.kickerName &&
  a.round === b.round &&
  a.scored === b.scored;

/**
 * Compara dos listas de penales por contenido. Cada tick llega como JSON nuevo, así que
 * sin esto la lista sería "distinta" 20 veces por segundo y React re-renderizaría siempre.
 */
export const sameKicks = (a, b) => a === b || (a.length === b.length && a.every((kick, i) => sameKick(kick, b[i])));

/** Compara dos `penaltyCurrent` por contenido (ambos pueden ser null). */
export const sameCurrent = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.club === b.club &&
    a.kickerId === b.kickerId &&
    a.kickerName === b.kickerName &&
    a.defenderId === b.defenderId &&
    a.defenderName === b.defenderName
  );
};

/**
 * Casilleros de la tanda: 5 por club. Cada penal ocupa el casillero de su `round` en la
 * fila de su club; los que todavía no se patearon (o no se patearon nunca, si la tanda
 * terminó antes) quedan en null.
 * @returns {{ club1: Array<object|null>, club2: Array<object|null> }}
 */
export const buildSlots = (kicks) => {
  const empty = () => Array.from({ length: PENALTY_ROUNDS }, () => null);
  const slots = { club1: empty(), club2: empty() };
  (kicks ?? []).forEach((kick) => {
    const row = slots[kick.club];
    if (row && kick.round >= 1 && kick.round <= PENALTY_ROUNDS) row[kick.round - 1] = kick;
  });
  return slots;
};

/**
 * Durante la tanda `players` trae solo al pateador y al defensor. Con `penaltyCurrent` se
 * sabe quién es quién (y de qué club) sin depender del orden del tick.
 * @returns {{ club: 1|2, name: string, role: 'kicker'|'defender' } | null}
 */
export const penaltyPlayerInfo = (playerId, current) => {
  if (!current) return null;
  const kickerClub = sideNumber(current.club);
  if (playerId === current.kickerId) return { club: kickerClub, name: current.kickerName, role: 'kicker' };
  if (playerId === current.defenderId) {
    return { club: kickerClub === 1 ? 2 : 1, name: current.defenderName, role: 'defender' };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Textos. Se centralizan acá para que el calendario del fixture (SCRUM-166) lea
// exactamente igual que la pantalla final del partido.
// ---------------------------------------------------------------------------

/** La tanda terminó empatada: el ganador se definió por sorteo 50/50. */
export const isDrawnByLot = (penalties) => penalties.score1 === penalties.score2;

/** “pen. 4 - 3” */
export const shootoutLabel = (penalties) => `pen. ${penalties.score1} - ${penalties.score2}`;

/** “Gana {club}” o “Gana {club} (definido por sorteo)”. */
export const winnerLabel = (penalties, clubName) =>
  `Gana ${clubName}${isDrawnByLot(penalties) ? ' (definido por sorteo)' : ''}`;
