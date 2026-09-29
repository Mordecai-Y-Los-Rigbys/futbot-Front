FROM node:24-slim

WORKDIR /app/futbot-front

# Copy manifests first so dependency installation can be cached between builds.
COPY futbot-front/package*.json ./
RUN npm install

COPY futbot-front/ ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]