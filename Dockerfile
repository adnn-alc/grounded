# ── Build stage ──────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Build tools, only needed if better-sqlite3 has to compile from source
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop dev dependencies (Vite, fonts — already bundled into dist/) so only
# what the server needs is copied into the runtime image
RUN npm prune --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────
# No compilers here: node_modules (including the compiled better-sqlite3)
# comes ready-made from the build stage, which uses the same base image.
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/server       ./server

ENV DB_PATH=/app/data/grounded.db
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Marks the container unhealthy if the API or database stops responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
