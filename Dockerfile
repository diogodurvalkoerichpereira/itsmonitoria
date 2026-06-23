# syntax=docker/dockerfile:1
# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vite.config.js ./
COPY src ./src
COPY client ./client
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# dist/ ja contem o servidor (dist/*.js) e o frontend Vite (dist/client/).
COPY --from=build /app/dist ./dist

# Banco SQLite e uploads persistem em /app/data (monte um volume).
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "--no-warnings", "dist/server.js"]
