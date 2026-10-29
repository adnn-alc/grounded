# ── Build stage ──────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Install build deps for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copy only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend and server
COPY --from=builder /app/dist      ./dist
COPY --from=builder /app/server    ./server

ENV DB_PATH=/app/data/grounded.db
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "server/index.js"]
