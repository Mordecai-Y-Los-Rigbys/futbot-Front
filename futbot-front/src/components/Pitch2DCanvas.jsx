import { useEffect, useRef } from 'react';

// Coordenadas de cancha (ver AsyncAPI): x 0..100, y 0..60, origen abajo a la izquierda.
// Arcos en x = 0 (club1) y x = 100 (club2), entre y = 22 e y = 38.
const PITCH_W = 100;
const PITCH_H = 60;
const GOAL_Y1 = 22;
const GOAL_Y2 = 38;
const GOAL_DEPTH = 3.5;

// Zona visible: la cancha + margen para los arcos y los carteles de los jugadores.
const VIEW_X0 = -6;
const VIEW_W = 112;
const VIEW_Y0 = -4;
const VIEW_H = 68;
const VIEW_Y1 = VIEW_Y0 + VIEW_H;

const PLAYER_R = 2.1;
const BALL_R = 1.1;
const SNAP_DISTANCE = 20; // si algo "salta" más que esto (saque del medio) no se interpola

export const TEAM_COLORS = { 1: '#1e88e5', 2: '#e53935' };

const GRASS_LIGHT = '#4aa84f';
const GRASS_DARK = '#3d9443';
const GRASS_OUTSIDE = '#2c6b31';

const lerp = (a, b, t) => a + (b - a) * t;

function interpolate(p0, p1, alpha) {
  if (!p0 || Math.hypot(p1.x - p0.x, p1.y - p0.y) > SNAP_DISTANCE) return p1;
  return { x: lerp(p0.x, p1.x, alpha), y: lerp(p0.y, p1.y, alpha) };
}

const attributesLabel = (attributes) =>
  Object.entries(attributes ?? {})
    .map(([key, value]) => `${key.slice(0, 3).toUpperCase()} ${value}`)
    .join('  ');

/**
 * Vista cenital de la cancha. No tiene lógica de juego: dibuja lo que llega por
 * el WebSocket, interpolando entre los dos últimos ticks para que se vea fluido.
 *
 * @param streamRef  ref con { prev, curr, currAt, intervalMs } (lo escribe useMatchWebSocket)
 * @param roster     datos estáticos de los jugadores (nombre, atributos, behavior, club)
 */
export default function Pitch2DCanvas({ streamRef, roster }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rosterRef = useRef(roster);
  const ballAngleRef = useRef(0);
  const lastBallRef = useRef(null);

  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    let size = { w: 0, h: 0, dpr: 1 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = (w * VIEW_H) / VIEW_W;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      size = { w, h, dpr };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const draw = (now) => {
      const { w, h, dpr } = size;
      const s = w / VIEW_W; // px por unidad de cancha
      const X = (x) => (x - VIEW_X0) * s;
      const Y = (y) => (VIEW_Y1 - y) * s; // el eje y de la cancha crece hacia arriba

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawPitch(ctx, X, Y, s, w, h);

      const { prev, curr, currAt, intervalMs } = streamRef.current;
      if (!curr) {
        frame = requestAnimationFrame(draw);
        return;
      }

      // alpha = cuánto del camino entre el tick anterior y el actual ya recorrimos.
      const alpha = Math.min(1, Math.max(0, (now - currAt) / intervalMs));
      const prevById = new Map((prev?.players ?? []).map((p) => [p.playerId, p.position]));
      const info = rosterRef.current ?? { players: {} };

      // Jugadores (las etiquetas van después para quedar siempre arriba de todo).
      const drawn = curr.players.map((p, index) => {
        const pos = interpolate(prevById.get(p.playerId), p.position, alpha);
        const data = info.players?.[p.playerId];
        // Sin datos del roster, se asume el orden del tick: 3 del club 1 y 3 del club 2.
        const club = data?.club ?? (index < curr.players.length / 2 ? 1 : 2);
        drawPlayer(ctx, X(pos.x), Y(pos.y), s, club, data?.own);
        return { pos, data, club };
      });

      // Pelota
      const ball = interpolate(prev?.ballPosition, curr.ballPosition, alpha);
      const last = lastBallRef.current;
      if (last) ballAngleRef.current += Math.hypot(ball.x - last.x, ball.y - last.y) * 0.9;
      lastBallRef.current = ball;
      drawBall(ctx, X(ball.x), Y(ball.y), BALL_R * s, ballAngleRef.current);

      drawLabels(ctx, drawn, X, Y, s);

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [streamRef]);

  return (
    <div ref={wrapRef} className="pitch">
      <canvas ref={canvasRef} className="pitch__canvas" role="img" aria-label="Cancha de fútbol vista desde arriba" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

function drawPitch(ctx, X, Y, s, w, h) {
  // Fuera de la cancha
  ctx.fillStyle = GRASS_OUTSIDE;
  ctx.fillRect(0, 0, w, h);

  // Césped cortado en cuadrados de 10x10 que alternan de tono.
  const cell = 10;
  for (let i = 0; i < PITCH_W / cell; i += 1) {
    for (let j = 0; j < PITCH_H / cell; j += 1) {
      ctx.fillStyle = (i + j) % 2 === 0 ? GRASS_LIGHT : GRASS_DARK;
      ctx.fillRect(X(i * cell), Y((j + 1) * cell), cell * s + 0.5, cell * s + 0.5);
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.5, 0.35 * s);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  // Borde. En los lados cortos se deja el hueco del arco: ahí no hay línea.
  ctx.beginPath();
  ctx.moveTo(X(0), Y(GOAL_Y1));
  ctx.lineTo(X(0), Y(0));
  ctx.lineTo(X(PITCH_W), Y(0));
  ctx.lineTo(X(PITCH_W), Y(GOAL_Y1));
  ctx.moveTo(X(PITCH_W), Y(GOAL_Y2));
  ctx.lineTo(X(PITCH_W), Y(PITCH_H));
  ctx.lineTo(X(0), Y(PITCH_H));
  ctx.lineTo(X(0), Y(GOAL_Y2));
  ctx.stroke();

  // Línea del medio, círculo central y punto.
  ctx.beginPath();
  ctx.moveTo(X(PITCH_W / 2), Y(0));
  ctx.lineTo(X(PITCH_W / 2), Y(PITCH_H));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(PITCH_W / 2), Y(PITCH_H / 2), 8 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(X(PITCH_W / 2), Y(PITCH_H / 2), 0.5 * s, 0, Math.PI * 2);
  ctx.fill();

  drawGoal(ctx, X, Y, s, 0, -GOAL_DEPTH);
  drawGoal(ctx, X, Y, s, PITCH_W, GOAL_DEPTH);
}

// Arco hacia atrás de la línea de fondo, abierto del lado de la cancha (sin línea de gol).
function drawGoal(ctx, X, Y, s, goalLineX, depth) {
  const backX = goalLineX + depth;

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(Math.min(X(goalLineX), X(backX)), Y(GOAL_Y2), Math.abs(depth) * s, (GOAL_Y2 - GOAL_Y1) * s);

  // Red
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = GOAL_Y1 + 2; y < GOAL_Y2; y += 2) {
    ctx.moveTo(X(goalLineX), Y(y));
    ctx.lineTo(X(backX), Y(y));
  }
  for (let k = 1; k < 3; k += 1) {
    const x = goalLineX + (depth * k) / 3;
    ctx.moveTo(X(x), Y(GOAL_Y1));
    ctx.lineTo(X(x), Y(GOAL_Y2));
  }
  ctx.stroke();
  ctx.restore();

  // Postes y travesaño trasero (tres lados, el cuarto es la boca del arco).
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, 0.5 * s);
  ctx.beginPath();
  ctx.moveTo(X(goalLineX), Y(GOAL_Y2));
  ctx.lineTo(X(backX), Y(GOAL_Y2));
  ctx.lineTo(X(backX), Y(GOAL_Y1));
  ctx.lineTo(X(goalLineX), Y(GOAL_Y1));
  ctx.stroke();
}

function drawPlayer(ctx, px, py, s, club, own) {
  const r = PLAYER_R * s;

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px + r * 0.15, py + r * 0.25, r, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TEAM_COLORS[club];
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // Los jugadores propios llevan un aro amarillo; los rivales, borde blanco fino.
  ctx.lineWidth = own ? Math.max(2.5, 0.5 * s) : Math.max(1.5, 0.25 * s);
  ctx.strokeStyle = own ? '#ffd54f' : 'rgba(255,255,255,0.85)';
  ctx.stroke();
}

function drawBall(ctx, px, py, r, angle) {
  ctx.save();
  ctx.translate(px, py);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(r * 0.2, r * 0.3, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Parches negros de pelota clásica: pentágono central + 5 alrededor, recortados al círculo.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  for (let k = 0; k < 5; k += 1) {
    const a = (Math.PI * 2 * k) / 5 - Math.PI / 2;
    const x = Math.cos(a) * r * 0.42;
    const y = Math.sin(a) * r * 0.42;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 5; k += 1) {
    const a = (Math.PI * 2 * k) / 5 - Math.PI / 2 + Math.PI / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Nombre + atributos para todos; el behavior activo solo para los propios.
function drawLabels(ctx, drawn, X, Y, s) {
  const fontPx = Math.max(9, 1.7 * s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';

  drawn.forEach(({ pos, data }) => {
    if (!data) return;
    const lines = [];
    lines.push({ text: data.name, bold: true, color: '#ffffff' });
    const attrs = attributesLabel(data.attributes);
    if (attrs) lines.push({ text: attrs, color: '#e8f5e9' });
    if (data.own && data.behavior) lines.push({ text: `▶ ${data.behavior}`, color: '#ffd54f' });
    // Se apilan hacia arriba del jugador: la última línea queda pegada al círculo.
    const x = X(pos.x);
    let y = Y(pos.y) - PLAYER_R * s - 3;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      const size = line.bold ? fontPx : fontPx * 0.85;
      ctx.font = `${line.bold ? 700 : 500} ${size}px system-ui, sans-serif`;
      ctx.strokeText(line.text, x, y);
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, x, y);
      y -= size * 1.15;
    }
  });
}