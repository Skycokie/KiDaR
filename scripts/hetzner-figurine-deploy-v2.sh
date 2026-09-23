#!/usr/bin/env bash
set -euo pipefail
cd /opt/kidar
cp -a .env.local /tmp/kidar.env.local.bak.go-d
git fetch origin
git reset --hard origin/main
cp -a /tmp/kidar.env.local.bak.go-d .env.local
chmod 600 .env.local
echo "HEAD:"
git log -1 --oneline
echo "STATUS:"
git status -sb
test -f docker-compose.yml
test -f apps/worker/src/figurine/stage.ts
test -f apps/worker/src/tripo/config.ts
grep -q 'figurine-tripo-v2' packages/core/src/figurine.ts && echo PIPELINE_V2_OK || echo PIPELINE_V2_MISSING
grep -q 'submitMeshDecimate\|/mesh/decimate\|retopologizing' apps/worker/src/figurine/stage.ts && echo RETOPO_STAGE_OK || echo RETOPO_STAGE_MISSING
if grep -q '^TRIPO_API_KEY=.' .env.local; then echo TRIPO_ENV_PRESENT; else echo TRIPO_ENV_MISSING; fi
if grep -q '^FIGURINE_3D_ENABLED=true' .env.local 2>/dev/null; then echo WARN_LOCAL_FLAG_TRUE; else echo LOCAL_FLAG_NOT_TRUE; fi
QUEUED_BEFORE=$(docker compose exec -T worker sh -c 'echo skip' >/dev/null 2>&1; echo ok)
echo "PRECHECK=$QUEUED_BEFORE"
docker compose up -d --build --force-recreate --no-deps --scale worker=1 worker
sleep 8
echo "PS:"
docker compose ps
echo "COUNT=$(docker ps -q --filter name=kidar-worker | wc -l)"
docker ps --filter name=kidar-worker --format '{{.Names}} {{.Status}}'
echo "KEYCHECK:"
docker compose exec -T worker sh -c 'if [ -n "$TRIPO_API_KEY" ]; then echo TRIPO_KEY_OK; else echo TRIPO_KEY_MISSING; fi'
echo "IN_CONTAINER_V2:"
docker compose exec -T worker sh -c 'grep -q figurine-tripo-v2 /app/packages/core/src/figurine.ts && echo IN_IMAGE_V2_OK || echo IN_IMAGE_V2_MISSING'
docker compose exec -T worker sh -c 'grep -q submitMeshDecimate /app/apps/worker/src/figurine/stage.ts && echo IN_IMAGE_RETOPO_OK || echo IN_IMAGE_RETOPO_MISSING'
echo "LOGS:"
docker compose logs --tail=40 worker
