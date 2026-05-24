# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Remove dev files
RUN rm -f .env.example

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine

# Create non-root user
RUN addgroup -S fishcall && adduser -S fishcall -G fishcall

WORKDIR /app

# Copy from build stage
COPY --from=base --chown=fishcall:fishcall /app /app

# Create persistent directories
RUN mkdir -p /data /app/public/uploads /app/logs \
    && chown -R fishcall:fishcall /data /app/public/uploads /app/logs

USER fishcall

ENV NODE_ENV=production \
    PORT=3000 \
    DB_DIR=/data \
    UPLOADS_DIR=/app/public/uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/catch/current || exit 1

CMD ["node", "server.js"]
