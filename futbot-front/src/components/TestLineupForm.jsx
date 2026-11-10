import { useMemo, useState } from 'react';
import PagedSelect from './PagedSelect';

// 3 filas fijas por club, una por rol. El orden coincide con members[i] del POST.
export const TEST_SLOTS = [
  { club: 'club1', role: 'forward', label: 'Delantero' },
  { club: 'club1', role: 'midfield', label: 'Mediocampista' },
  { club: 'club1', role: 'defense', label: 'Defensor' },
  { club: 'club2', role: 'forward', label: 'Delantero' },
  { club: 'club2', role: 'midfield', label: 'Mediocampista' },
  { club: 'club2', role: 'defense', label: 'Defensor' },
];
export const CLUB_TITLES = { club1: 'Aliados', club2: 'Rivales' };

const createEmptyRows = () => TEST_SLOTS.map(() => ({ player: null, behavior: null }));

/**
 * Armado de la alineación de prueba (3 aliados + 3 rivales, sin suplentes ni DT).
 * Siempre arranca vacío: el formulario se monta nuevo cada vez que se abre el modal.
 *
 * @param fetchPlayers    (name, page) => Promise<{ items, total }>   (GET /players/me)
 * @param fetchBehaviors  (name, page) => Promise<{ items, total }>   (GET /behaviors/me?type=playerBehavior)
 * @param errors          errores del servidor por campo: 'members.<i>.playerId' | 'members.<i>.behaviorId' | ...
 * @param onChange        recibe { members, playerNames } cuando está completo, o null si no
 */
export default function TestLineupForm({ fetchPlayers, fetchBehaviors, errors = {}, onChange }) {
  const [rows, setRows] = useState(createEmptyRows);

  const update = (index, field, option) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: option } : row));
    setRows(next);

    const complete = next.every((r) => r.player && r.behavior);
    const distinct = new Set(next.filter((r) => r.player).map((r) => r.player.id)).size === next.filter((r) => r.player).length;
    if (!complete || !distinct) return onChange(null);

    onChange({
      members: next.map((r, i) => ({
        playerId: r.player.id,
        club: TEST_SLOTS[i].club,
        role: TEST_SLOTS[i].role,
        behaviorId: r.behavior.id,
      })),
      playerNames: Object.fromEntries(next.map((r) => [r.player.id, r.player.name])),
    });
  };

  const usedPlayerIds = useMemo(() => rows.flatMap((r) => (r.player ? [r.player.id] : [])), [rows]);

  const renderClub = (club) => (
    <div className="test-lineup__section" key={club}>
      <h3>{CLUB_TITLES[club]}</h3>
      {TEST_SLOTS.map((slot, index) =>
        slot.club !== club ? null : (
          <div className="test-lineup__slot" key={`${club}-${slot.role}`}>
            <strong>{slot.label}</strong>
            <div className="test-lineup__row">
              <PagedSelect
                label="Jugador"
                value={rows[index].player}
                onChange={(option) => update(index, 'player', option)}
                fetchPage={fetchPlayers}
                disabledIds={usedPlayerIds}
                error={errors[`members.${index}.playerId`]}
              />
              <PagedSelect
                label="Comportamiento"
                value={rows[index].behavior}
                onChange={(option) => update(index, 'behavior', option)}
                fetchPage={fetchBehaviors}
                error={errors[`members.${index}.behaviorId`]}
              />
            </div>
            {(errors[`members.${index}.club`] || errors[`members.${index}.role`]) && (
              <p className="paged-select__error" role="alert">
                {errors[`members.${index}.club`] ?? errors[`members.${index}.role`]}
              </p>
            )}
          </div>
        ),
      )}
    </div>
  );

  return (
    <section className="test-lineup" aria-label="Armado de la prueba">
      {renderClub('club1')}
      {renderClub('club2')}
    </section>
  );
}
