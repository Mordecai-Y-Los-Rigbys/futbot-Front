# Guía del frontend

## Requisitos

- Docker Desktop instalado y en ejecución (incluye Docker Compose).
- El repositorio clonado en tu computadora.

## Iniciar el entorno de desarrollo

Abrí una terminal en la raíz del repositorio con docker desktop abierto o el servicio de docker andando, donde están `Dockerfile` y `docker-compose.yml`, y ejecutá:

```powershell
docker compose up
```

La primera vez Docker descargará Node.js e instalará las dependencias; puede tardar unos minutos. Cuando Vite indique que está listo, abrí <http://localhost:5173/>. Los cambios que guardes en el código se reflejarán en el navegador mediante Hot Reload.

Para detener el entorno, presioná `Ctrl+C` en la terminal. También podés iniciarlo en segundo plano con `docker compose up -d` y detenerlo con `docker compose down`.

## Estructura relevante

- `futbot-front/`: aplicación React y configuración de Vite.
- `Dockerfile`: imagen del entorno de desarrollo.
- `docker-compose.yml`: servicio, puerto y volúmenes del frontend.
- `.dockerignore`: archivos que no se envían al construir la imagen.
