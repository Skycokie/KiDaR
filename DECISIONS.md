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

## M3 pop-out bug fix

- **Broken behavior:** the mask was ignored, the fallback geometry was a
  full-image quad, and the displayed texture was the original image rather
  than the transparent cutout.
- **Fix direction:** cleaned alpha masks now drive connected-component
  contours; each contour becomes a beveled `ExtrudeGeometry`, and only the
  cutout canvas is used as the cap texture.
