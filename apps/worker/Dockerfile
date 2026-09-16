# kidAR worker (M4.2 popout + M4.3 MindAR OfflineCompiler)
#
# Pinned runtime:
#   Node 22.14.0 (bookworm)
#   mind-ar 1.2.5 (OfflineCompiler + CPU kernels)
#   canvas 2.11.2 (native cairo deps via apt)
#
# No Chromium / Puppeteer for MindAR compile.
# Do not bake secrets into build args or layers — inject at runtime.

FROM node:22.14.0-bookworm-slim

WORKDIR /app

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

RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY apps/worker/package.json apps/worker/tsconfig.json ./apps/worker/
COPY e2e/fixtures ./e2e/fixtures

# Linux has cairo prebuilds / source build for canvas@2.11.2 on Node 22.
RUN pnpm install --filter @kidar/worker... --frozen-lockfile \
  && pnpm rebuild canvas

COPY packages/core ./packages/core
COPY apps/worker ./apps/worker

WORKDIR /app/apps/worker

ENV NODE_ENV=production
ENV WORKER_POLL_INTERVAL_MS=1000

# Runtime secrets (Appwrite / R2) must be provided by the orchestrator.
CMD ["pnpm", "start"]
