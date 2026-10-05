import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createMatchConnection } from '../services/matchService';
import './MatchWaitingRoom.css';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export default function MatchWaitingRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [connectionStatus, setConnectionStatus] = useState('getting_token'); // getting_token | waiting | countdown | playing | error | expired
  const [errorMessage, setErrorMessage] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(null);

  const socketRef = useRef(null);
  const tokenWsRef = useRef(null);
  const isTerminalRef = useRef(false);

  useEffect(() => {
    let isSubscribed = true;

    const setupConnection = async () => {
      try {
        setConnectionStatus('getting_token');
        setErrorMessage('');

        const data = await createMatchConnection(id);
        if (!isSubscribed) {
          return;
        }

        tokenWsRef.current = data.tokenWs;

        if (USE_MOCKS) {
          setConnectionStatus('waiting');
          return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const socketUrl = `${wsProtocol}//${wsHost}/ws/matches/${id}?token=${data.tokenWs}`;

        const ws = new WebSocket(socketUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isSubscribed) return;
          setConnectionStatus('waiting');
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.phase === 'countdown') {
              setConnectionStatus('countdown');
              if (payload.countdownSeconds !== undefined) {
                setCountdownSeconds(payload.countdownSeconds);
              }
            } else if (payload.phase === 'playing') {
              setConnectionStatus('playing');
            }
          } catch {
            // Ignorar frames no JSON o pings de control
          }
        };

        ws.onclose = (event) => {
          if (!isSubscribed) return;

          if (event.code === 1000 && event.reason === 'waitExpired') {
            isTerminalRef.current = true;
            setConnectionStatus('expired');
            setErrorMessage('El tiempo de espera de 15 minutos venció sin que se uniera un rival. El partido fue cancelado.');
            return;
          }

          if (event.code === 4409) {
            isTerminalRef.current = true;
            setConnectionStatus('error');
            setErrorMessage('El partido ya no se encuentra disponible (finalizado o cancelado).');
            return;
          }

          if (event.code === 4429) {
            isTerminalRef.current = true;
            setConnectionStatus('error');
            setErrorMessage('Has alcanzado el límite máximo de conexiones simultáneas para este partido.');
            return;
          }

          if (event.code === 4401 || event.code === 4403 || event.code === 4404) {
            isTerminalRef.current = true;
            setConnectionStatus('error');
            setErrorMessage('Error de validación al conectar con la transmisión del partido.');
            return;
          }

          if (!isTerminalRef.current) {
            setConnectionStatus('error');
            setErrorMessage('Se perdió la conexión con el servidor.');
          }
        };

        ws.onerror = () => {
          if (!isSubscribed) return;
          if (!isTerminalRef.current) {
            setConnectionStatus('error');
            setErrorMessage('Ocurrió un error en la conexión WebSocket.');
          }
        };
      } catch (err) {
        if (!isSubscribed) return;

        if (err.response?.status === 401) {
          navigate('/login');
          return;
        }

        const msg = err.response?.data?.message || err.message || 'No se pudo obtener la autorización para el partido.';
        setConnectionStatus('error');
        setErrorMessage(msg);
      }
    };

    setupConnection();

    return () => {
      isSubscribed = false;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [id, navigate]);

  return (
    <main className="match-waiting-room">
      <h1 className="match-waiting-room__title">Sala de Partido</h1>
      <p className="match-waiting-room__match-id">Identificador del partido: #{id}</p>

      {connectionStatus === 'getting_token' && (
        <div className="match-waiting-room__card">
          <div className="match-waiting-room__spinner" data-testid="token-spinner" />
          <p className="match-waiting-room__status-text">Conectando con el servidor...</p>
        </div>
      )}

      {connectionStatus === 'waiting' && (
        <div className="match-waiting-room__card">
          <div className="match-waiting-room__spinner" data-testid="waiting-spinner" />
          <p className="match-waiting-room__status-text">Esperando rival...</p>
          <p className="match-waiting-room__subtext">
            Tu partido está listo. En cuanto otro usuario elija sumarse a este amistoso, comenzará la cuenta regresiva.
          </p>
        </div>
      )}

      {connectionStatus === 'countdown' && (
        <div className="match-waiting-room__card">
          <p className="match-waiting-room__status-text">¡Rival encontrado! Comenzando en:</p>
          <div className="match-waiting-room__countdown">{countdownSeconds ?? 10}</div>
          <p className="match-waiting-room__subtext">Preparando el terreno y sincronizando alineaciones...</p>
        </div>
      )}

      {connectionStatus === 'playing' && (
        <div className="match-waiting-room__card">
          <p className="match-waiting-room__status-text">¡Partido en juego!</p>
          <p className="match-waiting-room__subtext">El encuentro ha comenzado.</p>
        </div>
      )}

      {connectionStatus === 'expired' && (
        <div className="match-waiting-room__expired-box" role="alert">
          <h2>Tiempo de espera agotado</h2>
          <p>{errorMessage}</p>
          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/friendlies" className="match-waiting-room__btn">
              Volver a Amistosos
            </Link>
          </div>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="match-waiting-room__error-box" role="alert">
          <h2>Error de conexión</h2>
          <p>{errorMessage}</p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/friendlies" className="match-waiting-room__btn match-waiting-room__btn--secondary">
              Volver a Amistosos
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
