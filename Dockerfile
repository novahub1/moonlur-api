FROM node:18-slim

# Instalar dependências necessárias
RUN apt-get update && apt-get install -y \
    git \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Baixar e instalar Luau (versão específica que funciona)
RUN wget https://github.com/luau-lang/luau/releases/download/0.652/luau-ubuntu.zip \
    && unzip luau-ubuntu.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/luau \
    && chmod +x /usr/local/bin/luau-analyze \
    && rm luau-ubuntu.zip

WORKDIR /app

# Clonar o Prometheus com suporte LuaU
RUN git clone https://github.com/wcrddn/Prometheus.git prometheus

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
