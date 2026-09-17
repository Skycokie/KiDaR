# Worker (`@kidar/worker`)

Railway / Linux process for async publish pipeline stages:

- `popout_build` (M4.2) — Node cutout → extruded GLB → public `models/.../popout.glb`
- `mind_compile` (M4.3) — MindAR `OfflineCompiler` → public `targets/.../targets.mind`

## Status

Linux fixture validation passed in the worker Docker image for the tracked
real-photo fixture. The Pop-out stage produced a 363,156-byte optimized GLB,
and the MindAR stage produced a 231,205-byte `targets.mind` file. Public
artifact publishing and consumer AR delivery remain unimplemented pending R2
configuration and M4.4b.

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
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | Public artifact store |
| `WORKER_POLL_INTERVAL_MS` | Poll interval (default `1000`; idle backoff ≤15s) |

Public artifacts **must** use R2 (or a future separate public Appwrite bucket).
Never point public storage at `source-drawings`.

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
# From repo root on Linux / Railway one-off / Docker
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

## Local scripts

```bash
pnpm -C apps/worker test
pnpm -C apps/worker start          # poll loop
pnpm -C apps/worker start -- --once
pnpm -C apps/worker fixture:popout
pnpm -C apps/worker fixture:mind
pnpm -C apps/worker fixtures:linux
```
