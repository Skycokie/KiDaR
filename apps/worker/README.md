# Worker (`@kidar/worker`)

Linux process (Hetzner CX22 Docker Compose, or Railway) for async publish pipeline stages:

- `popout_build` (M4.2) — Node cutout → extruded GLB → public `models/.../popout.glb`
- `mind_compile` (M4.3) — MindAR `OfflineCompiler` → public `targets/.../targets.mind`
- `page_render` (M4.4b) — static AR HTML + QR + A4 PDF → `pages/...` + `/ar/{slug}` pointer

## Status

Linux fixture validation passed in the worker Docker image for the tracked
real-photo fixture. The Pop-out stage produced a 363,156-byte optimized GLB,
and the MindAR stage produced a 231,205-byte `targets.mind` file. `page_render`
writes public HTML/QR/PDF through the R2 adapter. Live R2 delivery is confirmed
only after an owner-approved `pnpm storage:r2:verify --write` probe. Until then,
do not treat M4.4b as production-complete.

Dependency strategy: publish enqueues `popout_build` (pop-out only),
`mind_compile`, and `page_render`. The worker skips claiming `page_render`
until upstream jobs with the same `inputHash` are `done` and expose a public URL.

Recorded report (`status: linux_fixtures_passed`, Docker `linux/x64`,
2026-09-17, `e2e/fixtures/test-photo.jpg`):

| Stage | Verdict | Metrics |
| --- | --- | --- |
| popout | pass | coverage `0.15564727783203125`; GLB raw `398892` B; optimized `363156` B (`dedup`/`weld`/`prune`); under 1.5 MB; report SHA-256 `a9f94a5f1d5c53e9ad433fc9daf6162f6cf88fa1c2ed2d795194bdfb63bfa1d2` |
| mind | pass | `targets.mind` `231205` B; SHA-256 `9965113bd51c81334eeec9d31eadec6cd0ea917c4e654e4f49fe49c13f9c9b4c` |

The fixture JSON does not currently emit vertex/triangle counts.

## Required non-secret configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` / `APPWRITE_ENDPOINT` | Appwrite API |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` / `APPWRITE_PROJECT_ID` | Project id |
| `APPWRITE_API_KEY` | Server key (runtime secret; never bake into Docker layers) |
| `APPWRITE_DATABASE_ID` | Default `kidar` |
| `APPWRITE_JOBS_COLLECTION` | Default `jobs` |
| `APPWRITE_PROJECTS_COLLECTION` | Default `projects` |
| `APPWRITE_SOURCE_BUCKET` | Private sources only (`source-drawings`) |
| `R2_ACCOUNT_ID` | Cloudflare account id (server-side) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Bucket-scoped Object Read & Object Write token (server-side; never `NEXT_PUBLIC_*`) |
| `R2_BUCKET` | Dedicated public bucket (example `kidar-public-ar`); never `source-drawings` |
| `R2_ENDPOINT` | Optional S3 API origin `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_BASE_URL` | HTTPS CDN/custom domain origin for unsigned consumer URLs |
| `WORKER_POLL_INTERVAL_MS` | Poll interval (default `1000`; idle backoff ≤15s) |

Public artifacts **must** use R2. Never point public storage at `source-drawings`.
Do not enable an Appwrite public-bucket fallback on the single-bucket Free plan.

Immutable objects use `Cache-Control: public, max-age=31536000, immutable`.
That is safe only for content-addressed keys (`…/<inputHash>/…`).

Verify config (no bucket writes):

```bash
pnpm storage:r2:verify
```

Non-destructive probe (creates and deletes only `__kidar_verify__/<unique>.txt`):

```bash
pnpm storage:r2:verify --write
```

R2 integration includes `page_render` HTML/QR/PDF writes. Live public delivery
still requires the owner-approved `__kidar_verify__/` probe.

## MindAR compiler (M4.3)

Pinned:

- `mind-ar@1.2.5`
- `canvas@2.11.2` (native cairo stack on Linux)
- Entry: `mind-ar/src/image-target/offline-compiler.js` + `canvas.loadImage`
- Same path as upstream `examples/nodejs/createImageTargetLibrary.js`
- **No Puppeteer / Chromium** for compile

Artifact key: `targets/<projectId>/<inputHash>/targets.mind`

## Linux / Railway fixture validation (M4.2 + M4.3)

Single non-destructive entry that runs both fixtures and prints a structured
report (raw/optimized GLB sizes, `targets.mind` size, SHA-256, pass/fail):

```bash
# From repo root on Linux / Hetzner / Docker
pnpm install
pnpm -C apps/worker fixtures:linux
```

Equivalent manual pair:

```bash
pnpm -C apps/worker tsx src/popout/run-fixture.ts
pnpm -C apps/worker tsx src/mindar/run-fixture.ts
```

Docker (from repo root; no secrets required for fixtures):

```bash
docker build -f apps/worker/Dockerfile -t kidar-worker .
docker run --rm -w /app kidar-worker pnpm -C apps/worker fixtures:linux
```

The image `WORKDIR` is `/app/apps/worker`. The `-w /app` override is required
for `pnpm -C apps/worker`. Without that override, `pnpm fixtures:linux` also
works because it already runs from the image workdir.

Record from the structured report:

- `popout.rawBytes`, `popout.optimizedBytes`
- `mind.mindBytes`, `mind.sha256`
- `verdict.popout` / `verdict.mind`

## Hetzner CX22 (always-on worker)

Use a CX22 (2 vCPU / 4 GB / 40 GB, Falkenstein or Helsinki). Do not expose
HTTP ports. Firewall: inbound SSH only; outbound HTTPS to Appwrite and R2.

On the server (Ubuntu 24.04):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Copy the repo and `.env.local` (never bake secrets into the image), then:

```bash
docker compose up -d --build
docker compose logs -f worker
docker compose exec worker pnpm storage:r2:verify
```

First image build needs several GB free. After deploy, stop the Railway worker
so two pollers do not claim the same jobs.

## Local scripts

```bash
pnpm -C apps/worker test
pnpm -C apps/worker start          # poll loop
pnpm -C apps/worker start -- --once
pnpm -C apps/worker fixture:popout
pnpm -C apps/worker fixture:mind
pnpm -C apps/worker fixtures:linux
```
