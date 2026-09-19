# Decisions

## M1 foundation

- **Pop-out generation boundary:** generation will run client-side in the
  studio editor first. This keeps the MVP CPU/client-only and avoids requiring
  headless WebGL or native canvas support in the Railway worker. The worker
  remains responsible for deterministic validation, MindAR compilation, and
  static page rendering.
- **Background removal:** use `@imgly/background-removal` behind a small
  adapter. It runs locally and is never a paid or network AI dependency in the
  publish critical path.
- **Optional AI 3D:** `AI3DProvider` is an interface only. It is disabled when
  `AI3D_API_KEY` is absent and is never used by tests.
- **Static delivery:** generated AR pages are uploaded to R2 when configured.
  Consumer page requests do not call the application API.
- **Backend host:** kidAR Studio replaced the prior Supabase implementation to
  consolidate the MVP backend workflow around Appwrite Cloud and avoid
  maintaining the prior local service setup path during active product
  development. Supabase artifacts under `supabase/` are historical only and
  are not active runtime infrastructure.
  <!-- OWNER-CONFIRM: replace this bullet with a more exact rationale if needed. -->
- **Appwrite environment isolation:** Development (`6aaa61b4000e4035f26e`),
  a dedicated CI/E2E project (second Free slot), and a future Production
  project must use separate credentials. CI must never access production
  resources. GitHub E2E uses only `APPWRITE_E2E_*` secrets; the job skips when
  those secrets are absent.
- **Appwrite setup trade-offs:** dependency on Appwrite Cloud; limited one-time
  Console bootstrap (project, platform, magic URL, API key) where Server SDK
  automation is unavailable; schema/buckets provisioned via idempotent
  `pnpm appwrite:setup`.
- **Legacy document scopes:** the `kidar` database is a legacy document
  database; API keys must include `documents.read` and `documents.write` in
  addition to any newer `documentsdb.*` labels.
- **M4.1 job delivery:** Appwrite job claim uses update-then-re-read lock tokens
  (no SQL CAS). Delivery is at-least-once; artifact writers must be idempotent.
- **M4.1 public artifacts:** Cloudflare R2 is the exclusive public consumer
  store. Appwrite fallback requires a bucket distinct from private
  `source-drawings` and is unavailable on the single-bucket Free plan; do not
  enable it. The worker R2 adapter uploads immutable objects with
  `Cache-Control: public, max-age=31536000, immutable` and unsigned
  `R2_PUBLIC_BASE_URL` URLs. `R2_ENDPOINT` is the S3 API host and must differ
  from the public CDN origin. Probe: `pnpm storage:r2:verify` (optional
  `--write` only under `__kidar_verify__/`). M4.4b still owns page_render and
  `/ar/:slug`.
- **M4.2 worker polling:** the Railway worker uses Appwrite document polling
  (configurable `WORKER_POLL_INTERVAL_MS`, idle backoff up to 15s) instead of
  Realtime subscriptions. Polling keeps claim/retry tests deterministic and
  avoids an extra Realtime dependency for a single-stage MVP pipeline.
- **M4.2 popout runtime:** browser preview keeps `@imgly/background-removal` +
  canvas/WebGL; the worker uses `@imgly/background-removal-node` + `sharp` for
  cutout bytes, headless `three` ExtrudeGeometry + `gltf-transform`/`pngjs` for
  GLB (no DOM `GLTFExporter`), and `@gltf-transform` `dedup`/`weld`/`prune`.
  Verified limitation: on the current Windows agent,
  `@imgly/background-removal-node`/`onnxruntime-node` aborts with
  GLib-GObject-CRITICAL, so fixture-photo end-to-end BG removal is validated on
  Linux/Railway hosts via `tsx src/popout/run-fixture.ts`; unit tests use
  synthetic RGBA silhouettes. Resolution options if Linux also fails: enqueue
  browser-produced cutout bytes, or swap to another local Node ONNX remover.
- **M4.3 MindAR compile:** use official `mind-ar@1.2.5` `OfflineCompiler`
  (`mind-ar/src/image-target/offline-compiler.js`) with `canvas` `loadImage`,
  matching upstream `examples/nodejs/createImageTargetLibrary.js`. Direct Node
  CPU kernels exist; **do not** use Puppeteer/Chromium for target compilation.
  Docker pins Node 22.14.0 + cairo/`canvas` native deps (no Chromium bundle).
  Artifact key: `targets/<projectId>/<inputHash>/targets.mind`. Input hashing
  includes source checksum, `mind-ar` version, pipeline version `m4.3.0`, and
  static compiler settings. Compilation stays local/headless with no paid AI
  APIs. Windows may not run canvas/TFJS reliably; combined Linux acceptance
  gate is `pnpm -C apps/worker fixtures:linux` (popout + mind). Linux fixture
  validation passed in the worker Docker image for the tracked real-photo
  fixture (2026-09-17, `linux/x64`, `test-photo.jpg`): Pop-out optimized GLB
  363156 B (report SHA-256
  `a9f94a5f1d5c53e9ad433fc9daf6162f6cf88fa1c2ed2d795194bdfb63bfa1d2`); MindAR
  `targets.mind` 231205 B (SHA-256
  `9965113bd51c81334eeec9d31eadec6cd0ea917c4e654e4f49fe49c13f9c9b4c`). Public
  artifact publishing and consumer AR delivery remain unimplemented pending
  R2 configuration and M4.4b.
- **M2 Appwrite SSR sessions:** `node-appwrite` creates magic-URL sessions
  server-side and stores the session secret in an httpOnly cookie.
- **M2 e2e dependency:** `@playwright/test` covers auth/project flows; E2E
  signs in via `/api/auth/e2e-session` using the Appwrite Users API.
- **M3 preview dependencies:** `three` and `react-dropzone` provide the
  client-only scene preview and reliable drag/drop input without a server GPU.
- **M3 local ML dependency:** `@imgly/background-removal` runs background
  removal in-browser, keeping pop-out generation free of paid AI APIs.
- **Asset visibility boundary:** source drawings and studio-only assets stay
  private and are previewed through same-origin `/api/files/...` proxies; M4
  AR HTML, MindAR, GLB, QR, and PDF outputs will use public R2/CDN URLs.
- **M4.4b public publishing:** Worker `page_render` builds standalone AR HTML,
  QR PNG, and A4 PDF after `mind_compile` (and `popout_build` in pop-out mode)
  are `done` with public URLs. Publish enqueues the whole chain in Appwrite
  jobs; the worker **does not claim** `page_render` until those dependencies
  succeed (same `inputHash`). Artifacts use immutable keys
  `pages/<projectId>/<inputHash>/{index.html,qr.png,print.pdf}` plus existing
  `models/` and `targets/` keys. A mutable pointer
  `experiences/<slug>/target.txt` (`Cache-Control: public, max-age=60`) maps
  `/ar/{slug}` to the immutable HTML URL. The Next.js `/ar/[slug]` route
  fetches that public pointer only — no Appwrite, no signed URLs, no source
  image. Gallery mode requires an already-public HTTPS model URL and never
  copies private Appwrite files. R2 live probe remains a separate
  `__kidar_verify__/` write; M4.4b code is not complete until that probe
  passes.


## M3 pop-out bug fix

- **Broken behavior:** the mask was ignored, the fallback geometry was a
  full-image quad, and the displayed texture was the original image rather
  than the transparent cutout.
- **Fix direction:** cleaned alpha masks now drive connected-component
  contours; each contour becomes a beveled `ExtrudeGeometry`, and only the
  cutout canvas is used as the cap texture.

## Pop-out UV mapping (`popout-uv-v2`)

- **Broken behavior:** ExtrudeGeometry cap UVs were raw shape XY. After the
  2.7 scale they sat mostly outside `[0,1]`, so the cutout texture showed
  only a fragment of the drawing.
- **Fix:** assign UVs with `popoutCapUv` (`u = x/scale + 0.5`, `v = y/scale + 0.5`)
  **before** `geometry.center()`. `v=0` is the image bottom (glTF / CanvasTexture
  `flipY=true`). Studio preview and worker GLB share this helper.
- **Hash:** `POPOUT_PIPELINE_VERSION = "popout-uv-v2"` is stored as
  `popoutPipelineVersion` on pop-out-mode pipeline hashes so old GLBs are not
  reused. Gallery/mind-only hashes are unchanged. Page copy is not part of
  `computePopoutInputHash`.

## Incomplete CTA on page render

- Mission preset stores hunt-hint `ctaText` without `ctaUrl`. `page_render`
  must omit a clickable CTA rather than fail with `INVALID_CTA`.
- The AR template has no separate static-hint slot, so hint text is not
  injected into HTML. A public HTTPS `ctaText`+`ctaUrl` pair still renders.
- Unsafe CTA URLs (`javascript:`, `data:`, `/api/files/`, signed query) are
  refused, not omitted.
