# syntax=docker/dockerfile:1
# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY public ./public

# Banco SQLite e uploads persistem em /app/data (monte um volume).
VOLUME ["/app/data"]
EXPOSE 3000
# node:sqlite exige --experimental-sqlite no Node 22.x (no-op no Node 24+).
CMD ["node", "--no-warnings", "--experimental-sqlite", "dist/server.js"]
