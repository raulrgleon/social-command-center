FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=postgresql://mesa:mesa@127.0.0.1:5432/mesa
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["sh", "docker/start.sh"]
