# Futbot - Frontend

Frontend de Futbot, la aplicación web donde cada usuario gestiona su club de jugadores, visualiza y calibra atributos, consulta sus scripts de comportamiento táctico y sigue partidos 3 vs 3 simulados en tiempo real sobre una cancha 2D interactiva.

Trabajo para Ingeniería del Software (FAMAF, UNC), Laboratorio 2026. El backend se desarrolla en un repositorio aparte.

## Qué hace

- **Autenticación y sesión**: registro de usuario e inicio de sesión persistente mediante contexto global (`AuthContext`), consumiendo la cookie de sesión `session_id` (`credentials: include` vía Axios).
- **Gestión y creación de jugadores**: interfaz (`CreatePlayerPage`, `Players`) para calibrar atributos PACSS (`power`, `agility`, `control`, `strength`, `speed`) con validación en cliente de suma exacta de 300 puntos y rango permitido.
- **Comportamientos**: exploración y detalle de scripts de comportamiento de los jugadores (`Behaviors`, `BehaviorDetail`).
- **Lobbies, Ligas y Amistosos**: creación y listado de ligas (`Leagues`, `CreateLeague`) y amistosos en espera (`Friendlies`, `CreateFriendly`), así como la unión a amistosos abiertos (`JoinFriendly`) armando la alineación con `TeamBuilderForm`.
- **Visualizador de partidos 2D en vivo**: pantalla de partido (`Match`) que renderiza la cancha en un canvas nativo (`Pitch2DCanvas`) y superpone el marcador (`ScoreboardOverlay`). Se conecta al WebSocket mediante el hook `useMatchWebSocket`, procesando los 20 ticks por segundo enviados por el motor determinista.
- **Entorno de desarrollo desacoplado**: cuenta con un servidor de simulación mock (`mock-server/matchSimulator.mjs`, `mockMatchServer.mjs`) y soporte para Service Worker de MSW (`mockServiceWorker.js`) que permite probar flujos y partidos sin necesidad de correr el backend real.

## Stack

- React 19 y React DOM (`^19.2.8`)
- React Router DOM 7 (`^7.18.4`)
- Vite 8 con plugin `@vitejs/plugin-react`
- Axios con `withCredentials` para manejo de sesiones por cookie HttpOnly
- Canvas API 2D nativo y CSS modular por pantalla/componente
- Oxlint para linting estático de alta velocidad
- Vitest 5 y React Testing Library con JSDOM para tests unitarios y de componentes
- Mock Service Worker (MSW) y Node WebSocket (`ws`) para mocks en tests y simulación
- Docker y Docker Compose para despliegue y desarrollo containerizado

## Cómo levantar el proyecto

Requisitos: Node.js (v20+ recomendado) y npm, o Docker y Docker Compose.

### Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo con Vite
npm run dev
```

Una vez levantado:

- Aplicación: http://localhost:5173
- Vite escucha en `0.0.0.0` (modo host habilitado para Docker y redes locales).

### Con Docker

```bash
docker compose up --build
```

### Simulación de partido local (Mock Server)

Para probar la pantalla de partido en vivo sin levantar el backend, se incluye un servidor mock que simula el endpoint REST y el WebSocket a 20 ticks por segundo:

```bash
# Iniciar el servidor mock de partidos (escucha en http://localhost:8001 y ws://localhost:8001)
node mock-server/mockMatchServer.mjs
```

Con el servidor corriendo y el frontend iniciado (`npm run dev`), ingresá a http://localhost:5173/matches/1.

IDs especiales para testing de errores:

- `/matches/403` o `/matches/409`: simula rechazo en la llamada REST inicial.
- `/matches/404`: simula cierre por WebSocket `4404 matchNotFound`.
- `/matches/999`: simula cierre por WebSocket `4409 matchFinished`.
- `/matches/777`: simula 5 s de espera sin rival y cierre `1000 waitExpired`.

### Variables de entorno

El proyecto lee variables a través de `.env` o `.env.local`:

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API REST del backend (por defecto `http://localhost:8000`). |
| `VITE_WS_URL` | URL base del servidor WebSocket (por defecto `ws://localhost:8000`). |
| `VITE_USE_MOCKS` | Activa la simulación local mediante mocks en servicios (`true` / `false`). |

> **Nota sobre autenticación:** todas las peticiones HTTP vía Axios están configuradas con `withCredentials: true` para transmitir y recibir la cookie `session_id` de forma automática.

## Tests

La suite de pruebas utiliza Vitest configurado con entorno `jsdom` y setup en `src/test/setup.js`:
Se ejecuta con el `VITE_USE_MOCKS=true` en el archivo `/futbot-Front/futbot-front/.env.local`
```bash
docker compose run --rm frontend npm run test  --run
```

## Estructura del proyecto

El código organiza las vistas, lógica de red y estado de forma desacoplada:

```
futbot-front/
├── mock-server/        # Servidor mock standalone para simular partidos y WebSockets
├── public/             # Assets estáticos y mockServiceWorker.js
├── src/
│   ├── assets/         # Íconos e imágenes estáticas
│   ├── components/     # Componentes compartidos y canvas (Pitch2DCanvas, ScoreboardOverlay, TeamBuilderForm)
│   ├── context/        # Contexto global de autenticación (AuthContext.jsx)
│   ├── hooks/          # Hooks reutilizables (useMatchWebSocket.js)
│   ├── pages/          # Pantallas de la aplicación (Auth, Players, Behaviors, Friendlies, Leagues, Match)
│   ├── routes/         # Definición de rutas del sistema (AppRoutes.jsx)
│   ├── services/       # Clientes HTTP (Axios), adaptadores de API y mocks para tests
│   ├── test/           # Configuración global de pruebas (setup.js)
│   ├── App.jsx         # Componente raíz
│   ├── index.css       # Estilos globales base
│   └── main.jsx        # Montaje en el DOM
├── docker-compose.yml  # Definición del contenedor frontend
├── Dockerfile          # Imagen Docker para el build/servidor
├── package.json        # Dependencias y scripts
└── vite.config.js      # Configuración de Vite, servidor y Vitest
```

## Flujo de conexión con el Backend

### REST (`src/services/`)

- Centralizado en `api.js`.
- Servicios modulares: `authService`, `playerService`, `behaviorService`, `friendlyService`, `leagueService`, `matchService`.
- Cada servicio cuenta con su par de mocks (`*Mocks.js`) y tests unitarios de contrato (`*Service.test.js`).
- Manejo de respuestas y errores bajo las convenciones de contrato acordadas con backend (401, 404, 400, 403, 409).

### WebSocket en vivo (`useMatchWebSocket`)

- Para presenciar o jugar un partido, primero se obtiene el token temporal invocando `POST /matches/{id}/connections` a través de `matchService`.
- El hook establece la conexión contra `/ws/matches/{id}?token=...` y alimenta los frames de coordenadas directamente al canvas 2D (`Pitch2DCanvas`) a 20 ticks por segundo.