import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MatchWaitingRoom from './MatchWaitingRoom';
import * as matchService from '../services/matchService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    MockWebSocket.instances.push(this);

    setTimeout(() => {
      if (this.onopen) {
        this.onopen();
      }
    }, 10);
  }

  close(code = 1000, reason = '') {
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

describe('MatchWaitingRoom Component', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });

  const renderComponent = (matchId = '123') => {
    return render(
      <MemoryRouter initialEntries={[`/matches/${matchId}`]}>
        <Routes>
          <Route path="/matches/:id" element={<MatchWaitingRoom />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('obtiene el token por REST, abre el WebSocket y muestra estado esperando rival', async () => {
    vi.spyOn(matchService, 'createMatchConnection').mockResolvedValue({
      tokenWs: 'fake_token_123',
    });

    renderComponent('123');

    expect(screen.getByTestId('token-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Esperando rival.../i)).toBeInTheDocument();
      expect(screen.getByText(/Identificador del partido: #123/i)).toBeInTheDocument();
    });

    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain('/ws/matches/123?token=fake_token_123');
  });

  it('cambia a estado countdown cuando recibe un tick con fase countdown', async () => {
    vi.spyOn(matchService, 'createMatchConnection').mockResolvedValue({
      tokenWs: 'fake_token_123',
    });

    renderComponent('123');

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.onmessage({
        data: JSON.stringify({
          phase: 'countdown',
          countdownSeconds: 8,
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/¡Rival encontrado! Comenzando en:/i)).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('muestra mensaje de expiración ante un cierre 1000 con waitExpired', async () => {
    vi.spyOn(matchService, 'createMatchConnection').mockResolvedValue({
      tokenWs: 'fake_token_123',
    });

    renderComponent('123');

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.close(1000, 'waitExpired');
    });

    await waitFor(() => {
      expect(screen.getByText(/Tiempo de espera agotado/i)).toBeInTheDocument();
      expect(screen.getByText(/15 minutos/i)).toBeInTheDocument();
    });
  });

  it('muestra mensaje de error si falla la llamada al endpoint de conexiones', async () => {
    vi.spyOn(matchService, 'createMatchConnection').mockRejectedValue({
      response: {
        status: 409,
        data: { message: 'El partido ya terminó o fue cancelado.' },
      },
    });

    renderComponent('456');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('El partido ya terminó o fue cancelado.')).toBeInTheDocument();
    });
  });

  it('redirige a /login ante un error 401 en la obtención del token', async () => {
    vi.spyOn(matchService, 'createMatchConnection').mockRejectedValue({
      response: { status: 401 },
    });

    renderComponent('789');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});
