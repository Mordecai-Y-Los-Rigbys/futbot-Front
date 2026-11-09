import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ScoreboardOverlay from './ScoreboardOverlay';

vi.mock('./PausePanel', () => ({ default: () => <div>pausa</div> }));

const baseMeta = {
  score1: 0, score2: 0, elapsedTime: 150, phase: 'countdown', periodNumber: null,
  countdown: null, goal: null, result: null, pauseReason: null, pauseRemaining: null, pauseCount: 0,
};

const renderOverlay = (meta) =>
  render(
    <MemoryRouter>
      <ScoreboardOverlay meta={{ ...baseMeta, ...meta }} roster={null} status="open" onExit={() => {}} />
    </MemoryRouter>,
  );

describe('ScoreboardOverlay', () => {
  it('en la cuenta regresiva sin periodStart muestra "Reanudando…" sin número', () => {
    renderOverlay({});

    expect(screen.getByText('Reanudando…')).toBeInTheDocument();
    expect(screen.queryByText(/Empieza/)).toBeNull();
  });

  it('con periodStart muestra el período y el número', () => {
    renderOverlay({ periodNumber: 2, countdown: { seconds: 5, startedAt: Date.now() } });

    expect(screen.getByText('Empieza el 2.º cuarto')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('en pausa muestra el panel de pausa', () => {
    renderOverlay({ phase: 'paused', pauseCount: 1 });

    expect(screen.getByText('pausa')).toBeInTheDocument();
  });
});