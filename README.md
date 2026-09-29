\# Guía del front

\##  Inicio

Levantar el proyecto que ya existe (para el resto del grupo)

### 1. Clonar el repo y abrir PowerShell en la carpeta que contiene `futbot-front`

```powershell
cd "C:\ruta\al\repo\front futbot"
```

(La carpeta donde **ves** la carpeta `futbot-front` adentro.)

### 2. Bajá la imagen y creá el contenedor

```powershell
docker pull node:24-slim
docker run -it --name node-dev -p 5173:5173 -v "${PWD}:/app" -w /app/futbot-front --entrypoint sh node:24-slim
```

Fijate que acá `-w` es `/app/futbot-front`, así ya entrás parado en la carpeta del proyecto.

### 3. Instalá dependencias y levantá

```sh
npm install
npm run dev
```

### 4. Abrí http://localhost:5173/

---

## Uso del día a día

Cuando ya tenés el contenedor creado, **no vuelvas a correr `docker run`** (te va a decir que el nombre ya existe). Usá:

```powershell
docker start -ai node-dev
```

Y adentro:

```sh
cd futbot-front    # solo si no entraste directo a la carpeta del proyecto
npm run dev
```

Si el contenedor ya está corriendo y querés abrir otra terminal:

```powershell
docker exec -it node-dev sh
```

Si agregaron dependencias nuevas al proyecto (alguien hizo `npm install algo`), después de hacer `git pull` corré de nuevo `npm install` adentro del contenedor.

## Comandos útiles

```powershell
docker ps -a            # ver contenedores (incluso detenidos)
docker stop node-dev    # detenerlo
docker rm node-dev      # borrarlo (tu código NO se pierde, está en tu carpeta)
```