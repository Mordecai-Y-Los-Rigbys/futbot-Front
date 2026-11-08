// Reglas del pedido de sustitución (ver PUT /matches/{id}/substitutions y el tick del AsyncAPI).

export const STARTER_ROLES = ['forward', 'midfield', 'defense'];

export const ROLE_LABELS = {
  forward: 'Delantero',
  midfield: 'Mediocampista',
  defense: 'Defensor',
  substitute: 'Suplente',
};

/**
 * ¿Se puede pedir una sustitución ahora? Se decide con el rol de la conexión y el ÚLTIMO tick
 * (`meta`): un cliente que se conecta o reconecta aplica la misma regla desde su primer tick.
 * - Solo jugadores (`role === 'player'`).
 * - Sin ticks todavía (amistoso esperando rival): no.
 * - Cuenta regresiva inicial (`phase: countdown` con `pausesLeft === 3`): no.
 * - `pausesLeft === 0` (3.ª pausa, período 4, tanda de penales, finished): no.
 * El 409 `matchNotStarted` del PUT queda como red de seguridad.
 */
export function canRequestSubstitution(role, meta) {
  if (role !== 'player') return false;
  if (!meta || meta.phase === null || meta.phase === undefined) return false;
  const { pausesLeft, phase } = meta;
  if (!Number.isInteger(pausesLeft) || pausesLeft <= 0) return false;
  if (phase === 'countdown' && pausesLeft === 3) return false;
  return true;
}

/** Separa el equipo (GET /matches/{id}/team) en titulares y suplentes, conservando el orden. */
export function splitTeam(team) {
  const members = Array.isArray(team?.members) ? team.members : [];
  return {
    starters: members.filter((m) => STARTER_ROLES.includes(m.role)),
    substitutes: members.filter((m) => m.role === 'substitute'),
  };
}
