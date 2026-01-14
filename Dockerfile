FROM node:18-slim

# Instalar dependências necessárias
RUN apt-get update && apt-get install -y \
    git \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Baixar e instalar Luau
RUN wget https://github.com/Roblox/luau/releases/latest/download/luau-linux.zip \
    && unzip luau-linux.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/luau \
    && rm luau-linux.zip

WORKDIR /app

# Clonar o Prometheus com suporte LuaU
RUN git clone https://github.com/wcrddn/Prometheus.git prometheus

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
