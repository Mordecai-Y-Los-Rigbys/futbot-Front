import { useId, useState } from 'react';
import './TeamBuilderForm.css';

const TEAM_SLOTS = [
  { role: 'forward', label: 'Titular Delantero' },
  { role: 'midfield', label: 'Titular Mediocampista' },
  { role: 'defense', label: 'Titular Defensor' },
  { role: 'substitute', label: 'Suplente 1' },
  { role: 'substitute', label: 'Suplente 2' },
  { role: 'substitute', label: 'Suplente 3' },
];

const createEmptyTeam = () =>
  TEAM_SLOTS.map((slot) => ({ ...slot, playerId: '', behaviorId: '' }));

const createTeamFromValue = (value) =>
  TEAM_SLOTS.map((slot, index) => ({
    ...slot,
    playerId: value?.[index]?.playerId ?? '',
    behaviorId: value?.[index]?.behaviorId ?? '',
  }));

const isCompleteTeam = (team) =>
  team.length === TEAM_SLOTS.length &&
  team.every((member) => member.playerId !== '' && member.behaviorId !== '') &&
  new Set(team.map((member) => member.playerId)).size === TEAM_SLOTS.length;

export default function TeamBuilderForm({ players, behaviors, value, onChange }) {
  const [team, setTeam] = useState(() => (value ? createTeamFromValue(value) : createEmptyTeam()));
  const idPrefix = useId();

  const updateMember = (index, field, rawValue) => {
    const updatedTeam = team.map((member, memberIndex) =>
      memberIndex === index
        ? { ...member, [field]: rawValue === '' ? '' : Number(rawValue) }
        : member,
    );
    setTeam(updatedTeam);

    if (isCompleteTeam(updatedTeam)) {
      onChange(updatedTeam.map(({ playerId, role, behaviorId }) => ({ playerId, role, behaviorId })));
    } else {
      onChange(null);
    }
  };

  const selectedPlayerIds = team.map((member) => member.playerId).filter((id) => id !== '');

  return (
    <section className="team-builder" aria-label="Armado de equipo">
      <div className="team-builder__section">
        <h3>Titulares</h3>
        {team.slice(0, 3).map((member, index) => (
          <MemberSlot
            key={member.label}
            idPrefix={idPrefix}
            member={member}
            index={index}
            players={players}
            behaviors={behaviors}
            selectedPlayerIds={selectedPlayerIds}
            onChange={updateMember}
          />
        ))}
      </div>
      <div className="team-builder__section">
        <h3>Suplentes</h3>
        {team.slice(3).map((member, offset) => {
          const index = offset + 3;
          return (
            <MemberSlot
              key={member.label}
              idPrefix={idPrefix}
              member={member}
              index={index}
              players={players}
              behaviors={behaviors}
              selectedPlayerIds={selectedPlayerIds}
              onChange={updateMember}
            />
          );
        })}
      </div>
    </section>
  );
}

function MemberSlot({ idPrefix, member, index, players, behaviors, selectedPlayerIds, onChange }) {
  const playerId = `${idPrefix}-player-${index}`;
  const behaviorId = `${idPrefix}-behavior-${index}`;

  return (
    <div className="team-builder__slot">
      <strong>{member.label}</strong>
      <div className="team-builder__row">
        <div className="team-builder__field">
          <label htmlFor={playerId}>Jugador</label>
          <select
            id={playerId}
            value={member.playerId}
            onChange={(event) => onChange(index, 'playerId', event.target.value)}
          >
            <option value="">-- Seleccionar Jugador --</option>
            {players.map((player) => {
              const selectedElsewhere =
                selectedPlayerIds.includes(player.id) && member.playerId !== player.id;
              return (
                <option key={player.id} value={player.id} disabled={selectedElsewhere}>
                  {player.name} {selectedElsewhere ? '(Seleccionado)' : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div className="team-builder__field">
          <label htmlFor={behaviorId}>Comportamiento</label>
          <select
            id={behaviorId}
            value={member.behaviorId}
            onChange={(event) => onChange(index, 'behaviorId', event.target.value)}
          >
            <option value="">-- Seleccionar Comportamiento --</option>
            {behaviors.map((behavior) => (
              <option key={behavior.id} value={behavior.id}>{behavior.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
