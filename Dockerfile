FROM node:18-slim

# Instalar apenas o essencial
RUN apt-get update && apt-get install -y \
    git \
    lua5.1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clonar Prometheus
RUN git clone https://github.com/levno-710/Prometheus.git prometheus

# Copiar arquivos
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
