# Guía del frontend

## Requisitos

- Docker Desktop instalado y en ejecución (incluye Docker Compose).
- El repositorio clonado en tu computadora.

## Iniciar el entorno de desarrollo

Con Docker Desktop en marcha, abrir una terminal en la carpeta del repositorio.

Para levantar los servicios y conectarte a la consola del frontend:

```powershell
docker compose up -d
docker compose attach frontend
```

La primera vez puede tardar un poco mientras Docker prepara la imagen. Después, entrá a <http://localhost:5173/>.Para apagar los servicios, usá `docker compose down`.

Si se quiere levantar solo el frontend:

```powershell
docker compose run --rm --service-ports --name front-dev frontend
```

Con `--rm`, el contenedor se borra al detenerse. `--service-ports` publica el puerto de Vite; `front-dev` es solo el nombre del contenedor y puede ser cambiarlo.

## Estructura relevante

- `futbot-front/`: aplicación React y configuración de Vite.
- `Dockerfile`: imagen del entorno de desarrollo.
- `docker-compose.yml`: servicio, puerto y volúmenes del frontend.
- `.dockerignore`: archivos que no se envían al construir la imagen.
