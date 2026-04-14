# ============================================
# Stage 1: Build do frontend React/Vite
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências primeiro (melhor cache do Docker)
COPY package.json package-lock.json ./

# Instalar dependências
RUN npm ci

# Copiar o restante do código-fonte
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js eslint.config.js components.json ./
COPY src/ ./src/
COPY public/ ./public/

# Build de produção
RUN npm run build

# ============================================
# Stage 2: Servir com Nginx
# ============================================
FROM nginx:alpine

# Remover configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada do Nginx
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos buildados do stage anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta 80
EXPOSE 80

CMD ["sh", "-c", "sleep 5 && nginx -g 'daemon off;'"]
