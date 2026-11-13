FROM oven/bun:1.4.4 AS builder
WORKDIR /app

# Copy dependency manifests first to take advantage of cached installs
COPY package.json bun.lock tsconfig.base.json tsconfig.json ./
COPY api/package.json ./api/package.json
COPY client/package.json ./client/package.json
COPY core/package.json ./core/package.json
COPY dal/package.json ./dal/package.json

# Install workspace dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application source
COPY . .

# Compile the Bun executable for the current platform
RUN bun run compile


FROM debian:bookworm-slim AS runtime
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl tzdata && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /app/data

# Copy the compiled Bun binary
COPY --from=builder /app/.dist/netminder /app/netminder

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/app/data/netminder.sqlite3

EXPOSE 8080

CMD ["/app/netminder"]
