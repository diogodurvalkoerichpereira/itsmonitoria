# Usa uma imagem oficial leve do Node.js (versao 22)
FROM node:22-alpine

# Define o diretorio de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependencia primeiro (aproveita cache do Docker)
COPY package.json package-lock.json ./

# Instala as dependencias completas para permitir o build
RUN npm ci

# Copia o restante do codigo da aplicacao
COPY . .

# Faz o build da aplicacao (Vite frontend + TypeScript backend)
RUN npm run build

# Remove as dependencias de desenvolvimento para deixar a imagem menor (opcional)
RUN npm prune --omit=dev

# Expoe a porta que a aplicacao vai rodar
EXPOSE 3000

# Define variaveis de ambiente padrao (serao sobrescritas pelo Coolify/Docker Compose)
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicializacao
CMD ["npm", "start"]
