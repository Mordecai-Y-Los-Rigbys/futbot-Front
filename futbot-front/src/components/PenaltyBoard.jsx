import { TEAM_COLORS } from './Pitch2DCanvas';
import { buildSlots } from '../utils/penalties';

const SIDES = [
  { side: 'club1', number: 1, fallbackName: 'Club 1' },
  { side: 'club2', number: 2, fallbackName: 'Club 2' },
];

// Un cuadradito: verde si fue gol, rojo si no (no se distingue tiempo agotado de pelota
// en el arco propio) y vacío si todavía no se pateó. Es chico a propósito: no muestra ni
// ✓/✗ ni el nombre del pateador. El detalle queda en el aria-label (lectores de pantalla).
function PenaltySlot({ kick, round }) {
  const state = !kick ? 'empty' : kick.scored ? 'scored' : 'missed';
  const label = !kick
    ? `Penal ${round}: sin patear`
    : `Penal ${round}: ${kick.scored ? 'gol' : 'no convertido'}, ${kick.kickerName}`;

  return <li className={`penalty-slot penalty-slot--${state}`} data-state={state} aria-label={label} />;
}

/**
 * Una fila por club (nombre + 5 cuadraditos). Cada penal de `kicks` ocupa el casillero de su
 * `round` en la fila de su club (por lado, nunca por nombre).
 *
 * @param kicks  lista de penales ya ejecutados (`penaltyKicks` o `result.penalties.kicks`)
 * @param clubs  [club1, club2] con `name` (puede faltar: se muestra "Club 1" / "Club 2")
 */
export default function PenaltyBoard({ kicks, clubs }) {
  const slots = buildSlots(kicks);

  return (
    <div className="penalty-board">
      {SIDES.map(({ side, number, fallbackName }, index) => {
        const name = clubs?.[index]?.name ?? fallbackName;
        return (
          <div className="penalty-board__row" key={side} style={{ '--team': TEAM_COLORS[number] }}>
            <span className="penalty-board__club" title={name}>{name}</span>
            <ol className="penalty-board__slots" aria-label={`Penales de ${name}`}>
              {slots[side].map((kick, i) => (
                <PenaltySlot key={i} kick={kick} round={i + 1} />
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
