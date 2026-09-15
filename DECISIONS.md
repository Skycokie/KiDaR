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
- **Static delivery:** generated AR pages are uploaded to R2 when configured,
  otherwise Supabase public storage is the fallback. Consumer page requests
  do not call the application API.
- **M2 Supabase client dependencies:** `@supabase/ssr` and
  `@supabase/supabase-js` are required for secure App Router cookie sessions.
- **M2 e2e dependency:** `@playwright/test` provides browser coverage for the
  auth and project flows required by the CI gate.
- **M3 preview dependencies:** `three` and `react-dropzone` provide the
  client-only scene preview and reliable drag/drop input without a server GPU.
- **M3 local ML dependency:** `@imgly/background-removal` runs background
  removal in-browser, keeping pop-out generation free of paid AI APIs.
- **Asset visibility boundary:** source drawings and studio-only assets stay
  private with short-lived signed preview URLs; M4 AR HTML, MindAR, GLB, QR,
  and PDF outputs will use public R2/CDN or public Supabase storage URLs and
  never signed URLs.

## M3 pop-out bug fix

- **Broken behavior:** the mask was ignored, the fallback geometry was a
  full-image quad, and the displayed texture was the original image rather
  than the transparent cutout.
- **Fix direction:** cleaned alpha masks now drive connected-component
  contours; each contour becomes a beveled `ExtrudeGeometry`, and only the
  cutout canvas is used as the cap texture.
