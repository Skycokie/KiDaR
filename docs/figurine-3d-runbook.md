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
3. Hetzner worker: upload → submit → persist `providerTaskId` → poll → download → validate → R2 `figurine.glb`.
4. Publish remains explicit via `/api/publish`.

## Rollout order

1. Deploy worker Go C on Hetzner (with `TRIPO_*` already set).
2. Deploy web with `FIGURINE_3D_ENABLED=false` (or unset).
3. Internal test project (cost-limited, no auto-publish).
4. Set `FIGURINE_3D_ENABLED=true` on Vercel → **redeploy**.
5. Open to users per plan/quota rules.

## Guards

- One active figurine job per project; max 3 ready assets.
- Reclaim/retry reuses `providerTaskId`.
- Failures preserve source; Pop-out fallback is user-selected only.
- No live Tripo calls in tests/CI.

## Recovery

```bash
cd /opt/kidar
docker compose logs --tail=100 worker
docker compose exec worker sh -c 'test -n "$TRIPO_API_KEY" && echo TRIPO_KEY_OK || echo TRIPO_KEY_MISSING'
```
