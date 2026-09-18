# Stage 1: Build the TypeScript backend with esbuild
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY server.ts ./
COPY firebase-config.json ./
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-config.json ./firebase-config.json

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
