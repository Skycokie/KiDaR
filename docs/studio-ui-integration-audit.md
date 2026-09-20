# kidAR Studio — UI Integration Audit

Date: 2026-09-20  
Purpose: map the existing Next.js web app so the new Studio visual foundation can land **without** breaking production flows.  
Companion: [`studio-ux-direction.md`](./studio-ux-direction.md).

---

## 1. Current route map

### Product UI pages

| Path | File | Role | Locale |
| --- | --- | --- | --- |
| `/` | `apps/web/app/page.tsx` | Marketing landing; CTAs to creator vs Studio | RO-led |
| `/intra` | `apps/web/app/intra/page.tsx` | Magic-link sign-in for Simple Creator | RO |
| `/creaza` | `apps/web/app/creaza/page.tsx` | Preset pick (coloring / story / mission) | RO |
| `/creaza/[projectId]/foto` | `…/foto/page.tsx` | Source upload | RO |
| `/creaza/[projectId]/experienta` | `…/experienta/page.tsx` | Experience mode | RO |
| `/creaza/[projectId]` | `…/[projectId]/page.tsx` | Saved confirmation; link to Studio | RO |
| `/login` | `apps/web/app/login/page.tsx` | Studio magic-link sign-in | EN |
| `/dashboard` | `apps/web/app/dashboard/page.tsx` | Project list CRUD entry | EN |
| `/studio/[projectId]` | `apps/web/app/studio/[projectId]/page.tsx` | Production editor + publish | EN |

### Auth / public / API (must stay stable)

| Path | Role |
| --- | --- |
| `/auth/callback` | Session mint; RO bridge page; redirects `/creaza` or `/dashboard` |
| `/ar/[slug]` | Public AR redirect to R2 HTML — **no Studio chrome** |
| `/api/auth/magic-link` | Magic link send |
| `/api/auth/e2e-session` | E2E-only; gated in production |
| `/api/projects*` | Project CRUD / source / asset |
| `/api/publish` | Enqueue pipeline jobs |
| `/api/gallery` | Poly Pizza search |
| `/api/quota` | Plan quota |
| `/api/files/[bucket]/[fileId]` | File proxy |

**New in this phase:** `/studio-preview` — isolated design shell (fixtures only).

---

## 2. Layouts and reusable chrome

| Piece | Path | Notes |
| --- | --- | --- |
| Root layout | `apps/web/app/layout.tsx` | Bare `html/body`; **no global CSS**, no providers |
| Login layout | `apps/web/app/login/layout.tsx` | Session → `/dashboard` |
| Simple Creator shell | `components/simple-creator/shell.tsx` | Narrow RO frame + progress |
| DocumentLang | `components/simple-creator/document-lang.tsx` | Sets `lang=ro`; side-effect imports `creaza.css` |
| Middleware | `apps/web/middleware.ts` | Pass-through only |

There is **no** shared Studio app chrome today. Dashboard and Studio are mostly unstyled / inline-styled trees.

---

## 3. Existing design tokens

### Romanian creator — `components/simple-creator/creaza.css`

Cream / paper light theme (`--paper`, `--ink`, `--accent #5b4fe0`, `--touch 48px`). Scoped under `.creaza-shell`.

### English Studio — inline in `studio-client.tsx`

Lavender-tinted light palette hardcoded in a `<style>` block (`#faf9ff`, `#6d5dfc`, …). Not a shared token system.

### Other

- No Tailwind / Radix / framer-motion / shadcn.
- `lib/contrast.ts` for contrast math (tests / helpers).
- UI deps of note: `react-dropzone`, `three`, background-removal stack (Studio preview only).

**Implication:** keep a **separate** dark Studio token layer for `/studio-preview` (`.studio-preview` scope). Do not override `.creaza-shell` or inject dark globals into root layout for all routes. V2 preview is editorial/header-based — not a sidebar app shell.

---

## 4. Auth and entry points

| Entry | Unauthenticated | Authenticated land |
| --- | --- | --- |
| Simple Creator | `/intra` | `/creaza` (via `kidar_next`) |
| Studio | `/login` | `/dashboard` → `/studio/[id]` |
| Guards | Page-level redirects | Not middleware |

Session cookie: `a_session_${APPWRITE_PROJECT_ID}` (`lib/appwrite/config.ts`).

**Preview shell:** no auth changes; `/studio-preview` is reachable without session so design review does not require login or cookie mutation.

---

## 5. Project creation flows (preserve)

### English path (production)

1. Dashboard `POST /api/projects`
2. Open `/studio/[projectId]`
3. Upload source / choose mode / transform / publish
4. Poll while `status === "processing"`
5. Three.js preview (`three-preview.tsx`)

### Romanian path (production)

1. `/creaza` preset → create project  
2. foto → experienta → confirmation  
3. Optional “advanced” link into `/studio/[id]`

Do **not** replace either path in Phase A.

---

## 6. Integration points for the new shell

| Opportunity | Approach |
| --- | --- |
| Parallel preview route | `app/studio-preview/page.tsx` + `components/studio-preview/*` |
| Token lab | Scoped CSS file imported only by preview layout/page |
| Future live wiring | Reuse loaders from `studio/[projectId]/page.tsx` / dashboard APIs in a later phase |
| Soft discovery | Optional later link from dashboard (“UI preview”) — **not required** for Phase A |

### What must remain unchanged in Phase A

- All existing page routes and copy relied on by Playwright e2e  
- `/studio/[projectId]` behavior, testids, publish button semantics  
- `/ar/[slug]`, R2 redirect, AR template pipeline  
- Auth cookies, magic-link destinations, e2e-session gate  
- API contracts (`/api/publish`, projects, source, asset)  
- Worker / job locking / single-worker ops posture  
- Root layout for unrelated routes (avoid global dark CSS leakage)

---

## 7. Risks and avoided changes

| Risk | Mitigation |
| --- | --- |
| Dual themes colliding | Scope new CSS under `.studio-preview` only |
| Accidental publish / enqueue | Preview uses fixtures; no fetch to `/api/*` |
| Auth / e2e breakage | No changes to auth routes or cookie logic |
| Three.js / onnx fragility | Preview canvas is CSS/SVG placeholder — no WebGL required |
| RO funnel regression | Do not wrap creaza in Studio shell |
| Claiming AI works | Prompt UI labelled Coming soon / Beta |
| Multi-worker assumptions | Docs and UI copy keep single-worker ops out of product claims |

---

## 8. Recommended first UI phase inventory

**Create / keep (preview V2 + read-only worlds):**

- Docs above  
- `/studio-preview` cinematic atelier (light header, hero stage, “Lumile tale”, Create ritual, Library cabinet)  
- Server read model `getStudioWorldsForCurrentUser()` → reduced `StudioWorldCard` DTO only  
- Guest = fixtures; signed-in = own projects; empty = cinematic empty state  
- Click live world → existing `/studio/[projectId]` (no new editor)
- Create entry points → existing Simple Creator: signed-in `/creaza`, guest `/intra` (no duplicated upload UI)

**Rejected from V1 (do not revive):**

- Permanent desktop sidebar  
- Uniform project/asset card grids  
- Boxed “Scene” panel / decorative mascot  
- Dashboard widget stack on Home  
- Passing full `ProjectRecord` to the Studio shell client  

**Do not create yet:**

- Live library / create mutations  
- New API routes that return full project documents  
- Meshy / provider SDKs  
- Replacement of dashboard or production Studio  
- UX-3 work
