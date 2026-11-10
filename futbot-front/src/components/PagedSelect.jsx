import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { PAGE_SIZE } from '../services/behaviorService';

const DEBOUNCE_MS = 400;
const CLEAR_ROW = { id: null, clear: true };

/**
 * Combobox alimentado por una API paginada (50 por página) con filtro por nombre.
 * Un solo campo hace de desplegable y de buscador: al hacer foco se puede escribir para
 * filtrar en el servidor, y la lista se abre debajo. "Cargar más" va al final de la lista.
 *
 * @param fetchPage    (name, page) => Promise<{ items: {id, name}[], total: number | null }>
 * @param value        opción elegida ({ id, name }) o null
 * @param disabledIds  ids que no se pueden elegir en este selector (jugadores ya usados)
 */
export default function PagedSelect({ label, value, onChange, fetchPage, disabledIds = [], error }) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const wrapRef = useRef(null);
  const activeRef = useRef(null);
  const requestRef = useRef(0);

  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loaded, setLoaded] = useState({ items: [], page: 0, total: null, lastCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (name, page, append) => {
      const requestId = ++requestRef.current;
      setIsLoading(true);
      setFailed(false);
      try {
        const data = await fetchPage(name, page);
        if (requestId !== requestRef.current) return; // llegó una respuesta vieja
        setLoaded((prev) => ({
          items: append ? [...prev.items, ...data.items] : data.items,
          page,
          total: data.total ?? null,
          lastCount: data.items.length,
        }));
      } catch {
        if (requestId === requestRef.current) setFailed(true);
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    },
    [fetchPage],
  );

  // Primera página al montar (o al cambiar el fetcher, o sea al refrescar) y búsqueda con debounce.
  useEffect(() => {
    const timer = setTimeout(() => load(search, 1, false), search ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  const hasMore =
    loaded.total !== null ? loaded.items.length < loaded.total : loaded.lastCount >= PAGE_SIZE;

  // La opción elegida siempre figura aunque no esté en la página cargada.
  const options = [...loaded.items];
  if (value && !options.some((o) => o.id === value.id)) options.unshift(value);

  // Con algo elegido se ofrece "-- Seleccionar --" para volver a dejarlo vacío.
  const rows = value ? [CLEAR_ROW, ...options] : options;
  const isTaken = (row) => !row.clear && disabledIds.includes(row.id) && row.id !== value?.id;

  const placeholder = `-- Seleccionar ${label} --`;

  const close = () => {
    setIsOpen(false);
    setSearch('');
    setActiveIndex(-1);
  };

  const open = () => {
    if (isOpen) return;
    setIsOpen(true);
    const selected = rows.findIndex((row) => !row.clear && row.id === value?.id);
    setActiveIndex(selected);
  };

  const selectRow = (row) => {
    if (isTaken(row)) return;
    onChange(row.clear ? null : row);
    close();
  };

  const move = (step) => {
    if (!rows.length) return;
    let next = activeIndex;
    for (let i = 0; i < rows.length; i += 1) {
      next = (next + step + rows.length) % rows.length;
      if (!isTaken(rows[next])) break;
    }
    setActiveIndex(next);
  };

  // Mantiene visible la opción activa al moverse con el teclado.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) open();
      else move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) open();
      else move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault(); // dentro de un <form>: no enviar
      if (isOpen && rows[activeIndex]) selectRow(rows[activeIndex]);
    } else if (event.key === 'Escape' && isOpen) {
      // Cierra solo la lista, no el modal que la contiene.
      event.nativeEvent.stopPropagation();
      close();
    }
  };

  const handleBlur = (event) => {
    if (!wrapRef.current?.contains(event.relatedTarget)) close();
  };

  const keepFocus = (event) => event.preventDefault(); // clics en la lista no le sacan el foco al campo

  const showRetry = failed;

  return (
    <div className="paged-select" ref={wrapRef} onBlur={handleBlur}>
      <label htmlFor={inputId}>{label}</label>
      <div className="paged-select__control">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && activeIndex >= 0 ? `${uid}-opt-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          value={isOpen ? search : (value?.name ?? '')}
          placeholder={isOpen && value ? value.name : isLoading && !options.length ? 'Cargando…' : placeholder}
          onFocus={open}
          onClick={open}
          onChange={(event) => {
            setSearch(event.target.value);
            setActiveIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />

        {isOpen && (
          <ul className="paged-select__list" id={listId} role="listbox" aria-label={label} onMouseDown={keepFocus}>
            {rows.map((row, index) => {
              const taken = isTaken(row);
              const selected = !row.clear && row.id === value?.id;
              return (
                <li
                  key={row.clear ? 'clear' : row.id}
                  id={`${uid}-opt-${index}`}
                  ref={index === activeIndex ? activeRef : null}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={taken || undefined}
                  className={[
                    'paged-select__option',
                    index === activeIndex ? 'paged-select__option--active' : '',
                    selected ? 'paged-select__option--selected' : '',
                    taken ? 'paged-select__option--disabled' : '',
                    row.clear ? 'paged-select__option--clear' : '',
                  ].join(' ').trim()}
                  onClick={() => selectRow(row)}
                  onMouseMove={() => !taken && setActiveIndex(index)}
                >
                  {row.clear ? placeholder : `${row.name}${taken ? ' (Seleccionado)' : ''}`}
                </li>
              );
            })}

            {!options.length && (
              <li className="paged-select__status" role="presentation">
                {isLoading ? 'Cargando…' : 'Sin resultados'}
              </li>
            )}

            {hasMore && (
              <li className="paged-select__more" role="presentation">
                <button type="button" onClick={() => load(search, loaded.page + 1, true)} disabled={isLoading}>
                  Cargar más
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {showRetry && (
        <p className="paged-select__error" role="alert">
          No pudimos cargar la lista.{' '}
          <button type="button" onClick={() => load(search, Math.max(1, loaded.page), loaded.page > 1)}>
            Reintentar
          </button>
        </p>
      )}
      {error && <p className="paged-select__error" role="alert">{error}</p>}
    </div>
  );
}
