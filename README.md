\# Guía del front

\##  Inicio

Descargar node.js

\# Descarga la imagen de Docker de Node.js:

`docker pull node:24-slim`

\# Crea un contenedor de Node.js e inicia una sesión shell:

`docker run -it --name node-dev --entrypoint sh node:24-slim`

Esto crea un contenedor que una vez aplicado `exit` corta su ejecución

\# Verifica la versión de Node.js:

node -v # Debería mostrar "v24.21.0".

\# Verifica versión de npm:

npm -v # Debería mostrar "11.19.0".

\# Reiniciar la ejecución del contenedor (Frenado con `exit`):

`docker start -ai node-dev`