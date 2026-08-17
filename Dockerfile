# SDF tools need a JRE for the Java-backed `suitecloud` CLI — Render's native Node runtime has
# no system package access, so this project must be deployed via Render's Docker runtime.
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/httpServer.js"]
