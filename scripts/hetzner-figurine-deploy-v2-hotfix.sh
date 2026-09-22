#!/usr/bin/env bash
set -euo pipefail
cd /opt/kidar
cp -a .env.local /tmp/kidar.env.local.bak.go-d-hotfix
git fetch origin
git reset --hard origin/main
cp -a /tmp/kidar.env.local.bak.go-d-hotfix .env.local
chmod 600 .env.local
echo "HEAD:"
git log -1 --oneline
echo "STATUS:"
git status -sb
grep -q 'FIGURINE_RETOPO_TIMEOUT_MS = 15 \* 60_000' packages/core/src/figurine.ts && echo RETOPO_TIMEOUT_15M_OK || echo RETOPO_TIMEOUT_15M_MISSING
grep -q 'Re-read from Appwrite' apps/worker/src/figurine/stage.ts && echo FAIL_PRESERVE_IDS_OK || echo FAIL_PRESERVE_IDS_MISSING
grep -q 'figurine-tripo-v2' packages/core/src/figurine.ts && echo PIPELINE_V2_OK || echo PIPELINE_V2_MISSING
if grep -q '^TRIPO_API_KEY=.' .env.local; then echo TRIPO_ENV_PRESENT; else echo TRIPO_ENV_MISSING; fi
docker compose up -d --build --force-recreate --no-deps --scale worker=1 worker
sleep 8
echo "PS:"
docker compose ps
echo "COUNT=$(docker ps -q --filter name=kidar-worker | wc -l)"
docker ps --filter name=kidar-worker --format '{{.Names}} {{.Status}}'
echo "KEYCHECK:"
docker compose exec -T worker sh -c 'if [ -n "$TRIPO_API_KEY" ]; then echo TRIPO_KEY_OK; else echo TRIPO_KEY_MISSING; fi'
echo "IN_IMAGE:"
docker compose exec -T worker sh -c 'grep -q "FIGURINE_RETOPO_TIMEOUT_MS = 15 \* 60_000" /app/packages/core/src/figurine.ts && echo IN_IMAGE_TIMEOUT_OK || echo IN_IMAGE_TIMEOUT_MISSING'
docker compose exec -T worker sh -c 'grep -q "Re-read from Appwrite" /app/apps/worker/src/figurine/stage.ts && echo IN_IMAGE_PRESERVE_OK || echo IN_IMAGE_PRESERVE_MISSING'
docker compose exec -T worker sh -c 'grep -q figurine-tripo-v2 /app/packages/core/src/figurine.ts && echo IN_IMAGE_V2_OK || echo IN_IMAGE_V2_MISSING'
echo "LOGS:"
docker compose logs --tail=30 worker
