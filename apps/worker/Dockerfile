# kidAR worker (M4.2 popout + M4.3 MindAR OfflineCompiler)
#
# Pinned runtime:
#   Node 22.14.0 (bookworm)
#   mind-ar 1.2.5 (OfflineCompiler + CPU kernels)
#   canvas 2.11.2 (native cairo deps via apt)
#
# No Chromium / Puppeteer for MindAR compile.
# Do not bake secrets into build args or layers — inject at runtime.
#
# OS base is debian:bookworm-slim (not node:*-slim) because some Docker Desktop
# pulls of node:22.14.0-bookworm-slim ship empty /etc/passwd and /etc/group, which
# makes fontconfig-config postinst fail (`chown root:staff`). Node is copied from
# the official image; cairo/pango still come from Debian apt.

FROM node:22.14.0-bookworm-slim AS nodebin

FROM debian:bookworm-slim

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH=/usr/local/bin:$PATH

COPY --from=nodebin /usr/local /usr/local

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    python3 \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable pnpm \
  && corepack prepare pnpm@10.28.2 --activate \
  && pnpm --version

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core ./packages/core
COPY apps/worker ./apps/worker
COPY e2e/fixtures ./e2e/fixtures

# Install after full sources so workspace links in apps/worker and packages/core
# are not overwritten by a later COPY.
RUN pnpm install --filter @kidar/worker... --frozen-lockfile \
  && pnpm rebuild canvas

WORKDIR /app/apps/worker

ENV NODE_ENV=production
ENV WORKER_POLL_INTERVAL_MS=1000

# Runtime secrets (Appwrite / R2) must be provided by the orchestrator.
CMD ["pnpm", "start"]
