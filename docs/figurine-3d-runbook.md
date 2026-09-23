# Figurină 3D (Tripo) — operational runbook

## Security split

| Mediu | Variabilă | Valoare | De ce |
| --- | --- | --- | --- |
| **Hetzner worker** | `TRIPO_API_KEY` | cheia reală Tripo | Singurul loc care apelează Tripo |
| **Hetzner worker** | `TRIPO_BASE_URL` | `https://openapi.tripo3d.ai/v3` | Endpoint server-to-server |
| **Vercel web** | `FIGURINE_3D_ENABLED` | `true` / omit | Flag non-secret pentru UI |
| **Vercel web** | `TRIPO_API_KEY` | **nu adăuga** | Nu e nevoie; mărește suprafața de expunere |
| **Vercel web** | `TRIPO_BASE_URL` | nu e necesar | Web-ul nu apelează Tripo |

Never use `NEXT_PUBLIC_TRIPO_*`. Never log the key, `Authorization` headers, or short-lived signed URLs.

## Web availability

- `GET /api/features/figurine-3d` → `{ enabled, available [, reason] }` — only reads `FIGURINE_3D_ENABLED`.
- Project Studio uses `GET/POST /api/projects/:id/figurine` with the same flag + source/quota checks.
- If Tripo is missing on the worker, the **job** fails closed (`TRIPO_CONFIG_MISSING`); the web app does not probe the key.

## Lifecycle

1. Studio `POST /api/projects/:id/figurine` with `{ confirm: true }` (auth + ownership + feature flag).
2. Mode `figurine_3d`; `figurine_build` enqueued (idempotent on inputHash).
3. Hetzner worker (**Go D**):
   - upload → Image-to-3D → persist `providerTaskId` → poll to success
   - **do not** accept the high-poly GLB
   - `POST /mesh/decimate` (`model=v2.0`, `face_limit=20000`, `bake=true`) → persist `retopoTaskId`
   - poll retopo → download **only** low-poly GLB → validate (≤50k tri / ≤150k vert) → R2 `figurine.glb`
4. Publish remains explicit via `/api/publish`.

## Mobile budgets (Go D)

| Limit | Value | Role |
| --- | --- | --- |
| Retopo `face_limit` | 20_000 | Tripo smart retopology target |
| Accept triangles | ≤ 50_000 | KidAR validation gate |
| Accept vertices | ≤ 150_000 | KidAR validation gate |

Do **not** raise accept limits to let high-poly through. Pipeline label: `figurine-tripo-v2`.

Generation poll timeout: 5 minutes. Retopo poll timeout: **15 minutes** (`FIGURINE_RETOPO_TIMEOUT_MS`). On retryable failure, worker re-reads persisted `providerTaskId` / `retopoTaskId` so reclaim does not submit a second Image-to-3D.

## Rollout order

1. Deploy worker Go C on Hetzner (with `TRIPO_*` already set).
2. Deploy web with `FIGURINE_3D_ENABLED=false` (or unset).
3. Internal test project (cost-limited, no auto-publish).
4. Set `FIGURINE_3D_ENABLED=true` on Vercel → **redeploy**.
5. Open to users per plan/quota rules.

Related: the **internal Figure AR staging pilot** (manual job → private R2 → `/internal/ar` → iPhone Quick Look) passed on 2026-09-23. See [figure-ar-staging-pilot.md](./figure-ar-staging-pilot.md). That path does **not** approve Publish Go B2 or production AR.

## Guards

- One active figurine job per project; max 3 ready assets.
- Reclaim/retry reuses `providerTaskId` **and** `retopoTaskId` (no duplicate paid Tripo submits).
- Failures preserve source; Pop-out fallback is user-selected only.
- No live Tripo calls in tests/CI.

## Recovery

```bash
cd /opt/kidar
docker compose logs --tail=100 worker
docker compose exec worker sh -c 'test -n "$TRIPO_API_KEY" && echo TRIPO_KEY_OK || echo TRIPO_KEY_MISSING'
```
