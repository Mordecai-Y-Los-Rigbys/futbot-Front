import { useState } from 'react';
import TeamBuilderForm from './TeamBuilderForm';
import './TeamForm.css';

export const TEAM_SIZE = 6;

const DEFAULT_LOAD_ERROR = 'No pudimos cargar tus jugadores o comportamientos.';

// Lo que falta para poder armar el equipo (se calcula con los datos ya cargados).
function getMissing(players, behaviors) {
  const missing = [];
  if (players.length < TEAM_SIZE) {
    missing.push(`Necesitás al menos ${TEAM_SIZE} jugadores y tenés ${players.length}.`);
  }
  if (behaviors.length === 0) {
    missing.push('Necesitás al menos un comportamiento de jugador y no tenés ninguno.');
  }
  return missing;
}

function ErrorBox({ error }) {
  const { message, details } = typeof error === 'string' ? { message: error } : error;
  return (
    <div className="team-form__error" role="alert">
      <p>{message}</p>
      {details?.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Formulario de equipo: el único que usan crear/unirse a una liga y crear/unirse a un amistoso.
 * Pone el armado del equipo (6 puestos) y el resto del formulario alrededor:
 * estados de carga y de error, faltantes, errores del envío y botones.
 *
 * Los datos propios de cada pantalla (nombre, participantes, contraseña…) entran como `children`
 * y se muestran arriba del equipo. Usá las clases `team-form__field`, `team-form__grid`,
 * `team-form__check` y `team-form__hint` para que se vean igual en todos lados.
 *
 * Props:
 *  - title: título (solo en `layout="page"`; en un modal lo pone el <Modal>).
 *  - layout: 'page' (por defecto) o 'modal'.
 *  - players, behaviors, isLoading, loadError: lo que devuelve useTeamOptions.
 *  - loadErrorMessage: texto cuando no se pudieron cargar los datos.
 *  - onSubmit(members): recibe los 6 miembros ya completos.
 *  - canSubmit: validez del resto del formulario (los `children`). El equipo lo valida TeamForm.
 *  - isSubmitting, submitLabel, submittingLabel.
 *  - error: string o { message, details? } del último envío.
 *  - onCancel, cancelLabel.
 */
export default function TeamForm({
  title,
  layout = 'page',
  players = [],
  behaviors = [],
  isLoading = false,
  loadError = null,
  loadErrorMessage = DEFAULT_LOAD_ERROR,
  loadingMessage = 'Cargando jugadores y comportamientos…',
  onSubmit,
  canSubmit = true,
  isSubmitting = false,
  submitLabel,
  submittingLabel,
  error = null,
  onCancel,
  cancelLabel = 'Cancelar',
  children,
}) {
  // null hasta que los seis puestos están completos (lo informa TeamBuilderForm).
  const [members, setMembers] = useState(null);

  const isModal = layout === 'modal';
  const Shell = isModal ? 'div' : 'main';
  const closeLabel = isModal ? 'Cerrar' : 'Volver';
  const heading = !isModal && title ? <h1>{title}</h1> : null;

  const ready = members !== null && canSubmit && !isSubmitting;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!ready) return;
    onSubmit(members);
  };

  let content;
  if (isLoading) {
    content = <p role="status">{loadingMessage}</p>;
  } else if (loadError) {
    content = (
      <>
        <p role="alert">{loadErrorMessage}</p>
        <div className="team-form__actions">
          <button type="button" className="team-form__btn" onClick={onCancel}>{closeLabel}</button>
        </div>
      </>
    );
  } else if (getMissing(players, behaviors).length > 0) {
    content = (
      <>
        <div role="alert">
          <p>Todavía no podés armar un equipo:</p>
          <ul>
            {getMissing(players, behaviors).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="team-form__actions">
          <button type="button" className="team-form__btn" onClick={onCancel}>{closeLabel}</button>
        </div>
      </>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorBox error={error} />}

        {children && <div className="team-form__details">{children}</div>}

        <TeamBuilderForm
          players={players}
          behaviors={behaviors}
          value={members}
          onChange={setMembers}
        />

        <div className="team-form__actions">
          {onCancel && (
            <button
              type="button"
              className="team-form__btn"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </button>
          )}
          <button className="team-form__btn team-form__btn--primary" type="submit" disabled={!ready}>
            {isSubmitting ? (
              <>
                <span className="team-form__spinner" aria-hidden="true" />
                {submittingLabel ?? submitLabel}
              </>
            ) : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <Shell className={`team-form team-form--${layout}`} aria-busy={isLoading || isSubmitting}>
      {heading}
      {content}
    </Shell>
  );
}
