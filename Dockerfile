FROM node:18-slim

# Instalar dependências
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Baixar e compilar Luau do Roblox
RUN git clone https://github.com/luau-lang/luau.git /tmp/luau \
    && cd /tmp/luau \
    && cmake . -DCMAKE_BUILD_TYPE=Release \
    && cmake --build . --target Luau.Repl.CLI --config Release \
    && cp luau /usr/local/bin/luau \
    && chmod +x /usr/local/bin/luau \
    && cd / \
    && rm -rf /tmp/luau

# Clonar Prometheus (repositório correto)
RUN git clone https://github.com/levno-710/Prometheus.git prometheus

# Copiar arquivos da aplicação
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
