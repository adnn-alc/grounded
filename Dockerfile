# Base image pinned to an exact digest so builds are repeatable; Dependabot
# opens a PR when a new node:24-alpine is published. Both stages must match.
# ── Build stage ──────────────────────────────────────────────────────
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS builder
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
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
WORKDIR /app

# su-exec lets the entrypoint drop from root to the unprivileged node user
RUN apk add --no-cache su-exec

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/server       ./server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV DB_PATH=/app/data/grounded.db
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Marks the container unhealthy if the API or database stops responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# The app runs as "node" (uid 1000), not root: the entrypoint gives the data
# folder to node, then drops privileges (see docker-entrypoint.sh)
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.ts"]
