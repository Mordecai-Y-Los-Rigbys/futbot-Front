import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAvailableFriendlies } from '../services/friendlyService';
import './Friendlies.css';

export default function Friendlies() {
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);

  const fetchMatches = useCallback(async (targetPage, filterName) => {
    let active = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getAvailableFriendlies({
        page: targetPage,
        name: filterName,
      });

      if (active) {
        setMatches(Array.isArray(data.items) ? data.items : []);
        setTotalMatches(data.total || 0);
        setPage(data.page || targetPage);
      }
    } catch (err) {
      if (!active) {
        return;
      }
      if (err.response?.status === 401) {
        navigate('/login');
        return;
      }
      const message = err.response?.data?.message || err.message || 'Error al obtener los partidos amistosos.';
      setError(message);
    } finally {
      if (active) {
        setIsLoading(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    fetchMatches(page, appliedSearch);
  }, [fetchMatches, page, appliedSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchTerm.trim());
  };

  const handleManualRefresh = () => {
    fetchMatches(page, appliedSearch);
  };

  const totalPages = Math.ceil(totalMatches / 50) || 1;

  return (
    <div className="friendlies-container">
      <div className="friendlies-header">
        <h1 className="friendlies-title">Partidos Amistosos Disponibles</h1>
        <div className="friendlies-header-actions">
          <button
            type="button"
            className="friendlies-btn-refresh"
            onClick={handleManualRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Actualizando...' : 'Recargar'}
          </button>
          <Link to="/friendlies/new" className="friendlies-btn-create">
            + Crear Amistoso
          </Link>
        </div>
      </div>

      <form className="friendlies-search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          className="friendlies-search-input"
          placeholder="Buscar por nombre de partido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button type="submit" className="friendlies-btn-search">
          Buscar
        </button>
      </form>

      {error && (
        <div className="friendlies-error-box" role="alert">
          <p>{error}</p>
          <button type="button" className="friendlies-btn-retry" onClick={handleManualRefresh}>
            Reintentar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="friendlies-status-box" data-testid="loading-spinner">
          <p>Cargando partidos disponibles...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="friendlies-status-box">
          {appliedSearch ? (
            <p>No se encontraron amistosos que coincidan con "{appliedSearch}".</p>
          ) : (
            <p>No hay amistosos disponibles en este momento.</p>
          )}
        </div>
      ) : (
        <div className="friendlies-table-wrapper">
          <table className="friendlies-table">
            <thead>
              <tr>
                <th>Partido</th>
                <th>Club Creador</th>
                <th>Usuario</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr key={match.id}>
                  <td><strong>{match.name}</strong></td>
                  <td>{match.club1?.name || 'Club'}</td>
                  <td>@{match.club1?.username || 'usuario'}</td>
                  <td>
                    <Link
                      to={`/friendlies/${match.id}/members`}
                      className="friendlies-btn-join"
                    >
                      Unirse
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && totalMatches > 50 && (
        <div className="friendlies-pagination">
          <span>Página {page} de {totalPages} ({totalMatches} partidos)</span>
          <div className="friendlies-pagination-buttons">
            <button
              type="button"
              className="friendlies-btn-page"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="friendlies-btn-page"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
