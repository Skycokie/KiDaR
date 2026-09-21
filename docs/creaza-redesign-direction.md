# Simple Creator redesign — static-first direction

Status: **Stage 2 preview** (2026-09-20)  
Route: `/creaza-preview` (isolated, fixtures only)  
Production funnel: `/creaza/*` unchanged.

---

## 1. Intent

Turn Simple Creator from an admin-style wizard into a **creation ritual** that shares language with Atelier / Lumi / Bibliotecă:

```text
poză → alegere → scenă → experiență
```

Studio remains the creative face. `/creaza/*` remains the only place that may create/upload/publish — this preview **must not** call those APIs.

---

## 2. Screen mapping (current → new composition)

| Current route | Progress (old) | Preview step | Progress (new) | Visual direction |
| --- | --- | --- | --- | --- |
| `/creaza` | Pasul 1 din 5 | `preset` | **1 / 4 — Pornire** | Three large editorial doors (real presets only) |
| `/creaza/[id]/foto` | Pasul 2 din 5 | `foto` | **2 / 4 — Poză** | Atelier table: paper frame + creative drop zone |
| `/creaza/[id]/experienta` | Pasul 3 din 5 | `experienta` | **3 / 4 — Scenă** | Big atmospheric choices; gallery marked În curând in preview |
| `/creaza/[id]` | Pasul 4 din 5 | `confirmare` | **4 / 4 — Lume** | “Lumea ta e pregătită să înceapă” + visual summary |

**Fixed:** no more “din 5”. Exactly **four** visible steps matching four functional screens.

---

## 3. Proposed Romanian copy (preview)

### Preset
- Title: **Cu ce începe lumea?**
- Lead: Alegi un tip de desen. Apoi aduci o poză pe masă și îi dai o scenă.
- Doors: Un desen colorat · O pagină de poveste · O misiune
- CTA: Începe lumea

### Foto
- Title: **Așază poza pe masă**
- Lead: O fotografie clară a hârtiei. Fără ecrane, fără umbre grele.
- Drop empty: Așază poza aici
- Drop selected: Poza ta e pe masă
- Error: Putem folosi doar JPG sau PNG, până la 10 MB.
- Tips: pagină întreagă · lumină blândă · nu fotografiați un ecran
- CTA: Alege scena

### Experiență
- Title: **Cum vrei să prindă viață?**
- Lead: O alegere mare, nu un formular…
- Doors: Iese din pagină (available) · O figurină deasupra (În curând in preview)
- CTA: Salvează alegerea *(label only — no PATCH in preview)*

### Confirmare
- Title: **Lumea ta e pregătită să înceapă**
- Lead: Am păstrat alegerea ta. Experiența AR live apare după fluxul real — **nu** în previzualizare.
- Explicit note: Nimic nu a fost creat, încărcat sau publicat din acest ecran.
- CTAs: Începe altă lume · Înapoi la Atelier

---

## 4. Fixture states (foto)

| State | Purpose |
| --- | --- |
| `empty` | Default drop zone |
| `drag-over` | Visual lift / warm border |
| `selected` | Paper composition on the table |
| `error` | Validation message styling |
| `loading` | Processing mock (no network) |

Toggled via an on-screen fixture bar (designers) and a local drag/drop that **never** reads files or uploads.

---

## 5. Loading / error (preview)

- Loading: label “Pregătim poza…” on the drop zone only.
- Error: warm error border + RO validation sentence.
- No stack traces, IDs, or API messages.

---

## 6. What later wires to existing logic

| Preview UI | Later connects to (unchanged contracts) |
| --- | --- |
| Preset doors + Continuă | `CreazaPresetForm` → `POST /api/projects` |
| Drop zone + Alege scena | `CreazaFotoForm` → `POST …/source` |
| Scenă + Salvează | `CreazaExperientaForm` → `PATCH /api/projects/:id` |
| Confirmare CTAs | existing links to `/creaza` / `/studio/[id]` / Studio Atelier |

Auth (`/intra`, magic-link) stays outside this preview.

---

## 7. Explicitly not implemented (functional)

- No `fetch` / Appwrite / R2
- No project create, source upload, PATCH, publish, jobs
- No autosave, session changes, or real file reading
- No UX-3, worker, AR/runtime/pointer changes
- Production `/creaza/*` pages **untouched**

---

## 9. Step 3.1 — local form state (authorized)

Status: **closed** (2026-09-20)  
Scope: navigation + local form state + validation display on `/creaza-preview` only.

### Allowed
- Four-step progress and back/forward without submit
- Local state shaped like production (preset, foto validation, experience)
- `validateSourceImage` from `lib/simple-creator.ts` on **mock descriptors** only
- Inline errors (preset select, foto type/size) without network

### Forbidden (still)
- Any `fetch` / API write (projects, source, PATCH, magic-link, publish)
- Reading real `File` / `FileList` from inputs or drop
- Appwrite, R2, worker, deploy

### Closing proof
- Choices survive step transitions (`form-state.ts` + tests)
- Errors appear without submit
- Drop handler calls `preventDefault` and applies fixture `selected` — never reads files
- `isWritePathBlocked` documents blocked endpoints
- Production `/creaza/*` untouched

### Next approval (not this step)
~~Either local browser File **read** (preview only) or `POST …/source`~~  

Local File read is implemented below. Source upload contract is frozen in §11 (**Go A** — docs only; no wire).

---

## 10. Local File read in `/creaza-preview` (authorized)

Status: **closed** (2026-09-20)

### Allowed
- `<input type="file">` + real drag-and-drop
- Read `File` from `FileList` in memory only
- `validateSourceImage` + optional dimension decode
- `URL.createObjectURL` preview; revoke on replace/clear/unmount
- Clear/replace local selection

### Forbidden (still)
- Any network request / upload / project create / magic-link
- Persistence beyond page memory
- Changes to `/creaza/*`

### Types
`LocalSourceImage` in `local-source.ts` — `file`, `objectUrl`, `name`, `mimeType`, `sizeBytes`, optional `width`/`height`.

### Acceptance
- Real select/drop updates local UI only
- Invalid files → local error, no request
- Preview `src` is the Object URL
- Object URLs revoked on lifecycle
- Production creator untouched

---

## 11. Frozen contract — `POST …/source` (Go A + Source Go B)

Status: **Go A frozen** (2026-09-21) · **Source Go B wired on `/creaza-preview`** (2026-09-21).  
Go A froze the route interface. Source Go B connects the photo-step CTA **„Salvează poza și continuă”** only.

Implementation reference (unchanged route): `apps/web/app/api/projects/[projectId]/source/route.ts`.  
Preview client: `upload-source.ts` + save CTA in `creaza-shell.tsx`.

### Explicitly not approved (still)
- Changes to the source route contract or `/creaza/*`
- `PATCH /api/projects/:id`, magic-link, jobs, publish, worker, AR, UX-3, deploy
- Cleanup/rollback of orphan storage files
- Exposing full `ProjectRecord` / private file ids in Atelier UI state
- Auto-upload on select/drop

### Frozen interface

| Zone | Approved contract |
| --- | --- |
| Method & path | `POST /api/projects/:projectId/source` — no query parameters |
| Body | `multipart/form-data`, required field `file` |
| Types | `image/jpeg` and `image/png` only |
| Limit | Max `10 * 1024 * 1024` bytes (`SOURCE_MAX_BYTES`) |
| Auth | Valid Appwrite session + strict owner check on `projectId` |
| Isolation | Missing project or other owner's project → `404 { error: "Project not found" }` |
| Storage upload | Upsert in Appwrite **source** bucket; deterministic file id from `projectId` (`src_…`) |
| Project write | `source_image_path = fileId` via `updateProjectDocument` (**included** in this write surface) |
| Success | `200 { project, sourceUrl }` where `sourceUrl` is `/api/files/{sourceBucket}/{fileId}` |
| No implicit siblings | Does **not** include `POST /api/projects`, `PATCH /api/projects/:id`, magic-link, job, publish, or deploy |

### Error table (route as frozen)

| Status | Condition | Body |
| --- | --- | --- |
| `200` | Success | `{ project, sourceUrl }` — client keeps **only** `sourceUrl` (+ existing `projectId`) |
| `401` | No session | `{ error: "Unauthorized" }` |
| `404` | Not found / not owner | `{ error: "Project not found" }` |
| `400` | Missing `file` | `{ error: "Image file is required" }` |
| `415` | Wrong type | `{ error: "Only PNG and JPG images are supported" }` |
| `413` | Over size | `{ error: "Image must be 10 MB or smaller" }` |
| `500` | Storage/DB failure | `{ error: <message> }` |

### Permissions note
File-level read/update/delete for the owner is appropriate for private sources **only if** the Appwrite source bucket has **File Security** enabled; otherwise file permissions are not enforced.

### Source Go B — closed (2026-09-21)

Wired on `/creaza-preview` step 2/4:

- Requires Create Go B `projectId` + valid local `File` + explicit CTA
- Exactly one `POST …/source` per save; disabled UI + in-flight ref block double-submit
- `200` → store `sourceUrl` only; keep `blob:` preview for the session; advance to Scenă
- `401` / `404` / `413` / `415` / `5xx` / network → stay on Poză; no auto-retry
- Partial storage/DB failure may leave an orphan file — **accepted**, no cleanup in this scope
- No second `POST /api/projects` when `projectId` exists; no PATCH/publish

**Next gate:** experience `PATCH` / Studio personalize / AR runtime (separate approvals).

---

## 12. Frozen contract — `POST /api/projects` (Create Go A + Go B)

Status: **Create Go A frozen** (2026-09-21) · **Create Go B wired on `/creaza-preview`** (2026-09-21).  
Create Go A froze the route interface (docs). Create Go B connects the preset CTA on `/creaza-preview` only.

Implementation reference (unchanged route): `apps/web/app/api/projects/route.ts` → `createProjectWithUniqueSlug` → `createProjectDocument`.  
Preview client: `create-project.ts` + preset CTA in `creaza-shell.tsx`.

### Explicitly not approved (still)
- `PATCH /api/projects/:id`, magic-link, jobs, publish, worker, AR, UX-3, deploy
- Exposing full `ProjectRecord` in Atelier UI state (only `project.id`)
- Server-side idempotency keys, dedupe, or draft cleanup

### Why create before source Go B
Source upload needs a real owner `projectId`. Preview must not invent or borrow one. Order remains: create contract → **create wire (done)** → `projectId` → source Go B → upload → later experience `PATCH`.

### Moment of create (frozen product rule)
- **Never** on step load or on preset click alone.
- User selects a preset **locally**, then triggers one explicit CTA: **„Începe lumea”**.
- Only then: a single `POST /api/projects`.
- Abandon before that CTA → **zero** server projects.

### Frozen interface

| Zone | Approved contract |
| --- | --- |
| Moment | After local preset + explicit CTA only |
| Method & path | `POST /api/projects` — no query parameters |
| Content-Type | `application/json` |
| Required | `name` — non-empty after trim |
| Optional | `mode`: `"popout" \| "gallery" \| "upload"` — default **`"popout"`** |
| Optional | `settings.preset`: `"coloring" \| "story" \| "mission" \| "studio"` |
| Atelier payload | `{ name: friendlySurpriseName(), mode: "popout", settings: { preset } }` |
| Auth | Appwrite session required; guest → `401 { error: "Unauthorized" }` |
| Quota | Free 3 / paid 30; over → `403 { error: "quota_exceeded", message, upgrade: true }` |
| Effects | New draft project document: owner permissions, unique slug; **no** source attached |
| Success | `201 { project }` with `ProjectRecord.id` for later steps |
| Location header | HTTP recommends `Location` for `201`; useful contract improvement — **does not** authorize changing the route now |
| Idempotency | No server key; client must block double-submit and must not auto-resubmit after an ambiguous result |
| Abandon | Before CTA: zero projects. After success: sourceless draft may remain and consumes quota; **cleanup unauthorized** (separate contract) |
| Excluded | Upload, `PATCH`, magic-link, jobs, publish, deploy, auto-create |

### Error table

| Status | Condition | Body / UI hint |
| --- | --- | --- |
| `201` | Created | `{ project }` → keep `project.id` only; step → foto |
| `401` | No session | `{ error: "Unauthorized" }` — magic-link is a **separate** gate |
| `400` | Empty name | `{ error: "Project name is required" }` |
| `400` | Bad preset | `{ error: "Invalid preset" }` |
| `403` | Quota | `{ error: "quota_exceeded", message, upgrade: true }` |
| `500` | Create/slug failure | `{ error: <message> }` |

### Retry (frozen client rule)
- Client does **not** auto-retry after timeout, connection loss, or an ambiguous response.
- If the response is not a confirmed `201`, UI shows a recoverable error and **must not** assume the project was not created.
- Resolving possible duplicate drafts needs a **separate** decision; this scope does **not** add dedupe, cleanup, or idempotent create.
- Without a server idempotency key, a timeout can hide a successful create; automatic retry could create a second draft and consume more quota.

### Create Go B — closed (2026-09-21)

Wired on `/creaza-preview` step 1/4:

- CTA **„Începe lumea”** → exactly one `POST /api/projects` when preset is selected **and** `projectId` is absent
- Loading disables CTA + doors; in-flight ref blocks double-submit
- `201` → store only `projectId` in page state → navigate to foto step
- `401` / `403 quota` / generic / ambiguous → stay on preset; no forced navigation; no auto-retry
- Orphan sourceless draft after abandon is an **accepted** effect
- Source upload, PATCH, publish remain blocked (`isWritePathBlocked`)
- Production `/creaza/*` untouched

### Create Go B amendment — resume existing draft (2026-09-21)

If preview state already has a `projectId` (e.g. user went Poză → Înapoi → Pornire):

- CTA does **not** `POST /api/projects` and does **not** fetch
- Navigates locally to step 2 (Poză); keeps preset + in-memory File if present
- Does not load `ProjectRecord`, upload, PATCH, cleanup, or delete

Helpers: `decidePresetCta` / `resumeExistingDraft` in `form-state.ts`; shell `startWorld` branches on the decision.

**Next gate:** Studio Preview static (§14) before Cameră AR Preview static. Scene Go B is closed in §13.
---

## 13. Frozen contract — Scene `PATCH` (Scene Go B)

Status: **frozen + wired** on `/creaza-preview` (2026-09-21).  
Scene Go B delivered: CTA „Salvează scena și continuă” issues exactly one `PATCH /api/projects/:projectId` with `{ mode: "popout" }`.

Implementation: `save-scene.ts` + `form-state.ts` + `creaza-shell.tsx`.  
Route unchanged: `apps/web/app/api/projects/[projectId]/route.ts` `PATCH`.

### Verified route contract (do not invent fields)

There is **no** `settings.scene` field. Scene maps to top-level **`mode`**:

| Field | Type | Meaning |
| --- | --- | --- |
| `mode` | `"popout" \| "gallery" \| "upload"` | Technical experience mode |
| `settings` | `ProjectSettingsPatch` (optional) | Not sent by Atelier Scene Go B |
| `name` | string (optional) | Not sent by Atelier Scene Go B |

Validation: body must include at least one of `name`, `mode`, or `settings` → else `400`.  
Auth: session + `getProjectForOwner` → else `401` / `404`.  
Success: `200 { project }` — Atelier client **ignores** the document (keeps local `projectId` / `experience` / `sourceUrl` only).

### Atelier v1 payload (delivered)

```json
{
  "mode": "popout"
}
```

No `settings.preset` re-send (preset already set at create). No `settings.scene`.

### Product behaviour (delivered)

| Situation | Behaviour |
| --- | --- |
| User picks Popout | Local only until CTA |
| CTA „Salvează scena și continuă” | Exactly one `PATCH` |
| Loading | CTA + doors disabled; double-submit blocked |
| `200` | Advance to Lume; no ProjectRecord in client state |
| `401` / `404` / `400` / `5xx` / network | Stay on Scenă; choice kept; no auto-retry |
| Missing `projectId` / non-popout | Local error; zero request |
| Door select alone | Zero request |

### Explicit non-scope (still)

- Create / source upload / new photo
- Autosave on select
- Studio personalization / gallery wire
- Jobs, worker, `.mind`, AR camera/tracking, publish, deploy
- Changes to `/creaza/*` or the PATCH route
- Cleanup of drafts/orphans

**Scene Go B — closed (2026-09-21).**  
`/creaza-preview` draft flow is complete in four steps: create → source → scene PATCH → local Lume summary.

**Next gate:** Cameră AR Preview static (separate approval). Studio Preview Go B is closed in §14.
---

## 14. Frozen — Studio Preview static (Studio Preview Go A)

Status: **frozen + Go B delivered** (2026-09-21).  
**Studio Preview Go A** locked direction. **Studio Preview Go B** wired `/studio-preview/personalizeaza` (fixture + local state) and a static camera placeholder.  
Still **no** save, PATCH, real projects, or live camera.
Aligns with [atelier-three-spaces-ux.md](./atelier-three-spaces-ux.md) §4. Comes **before** Cameră AR Preview so “personalizează” is validated while still fixture-only.

### Flow (Creează → Studio → Cameră AR)

```text
Creează (/creaza-preview)
  1 Pornire → POST /api/projects        → projectId
  2 Poză    → POST …/source             → sourceUrl
  3 Scenă   → PATCH … { mode: "popout" }
  4 Lume    → rezumat local
        ├─ Deschide Studio  → Studio (personalizează)
        └─ Vezi prin cameră → Cameră AR Preview (după Studio validat)

Studio (preview personalizează — Go B: rută izolată, ex. /studio-preview/personalizeaza)
  → fixture local + React state only
  → CTA „Vezi prin cameră” nu pornește cameră reală până la un gate AR separat

Cameră AR Preview (ulterior)
  → poate arăta lumea deja personalizată din state/fixture
  → încă fără getUserMedia / MindAR / .mind până la aprobare dedicată
```

Regulă: **Studio nu creează draftul.** Draftul vine din Creează. Studio personalizează o lume deja creată (în preview: un fixture, nu un `ProjectRecord`).

### Fixture proiect (singur, fictional)

| Câmp | Valoare |
| --- | --- |
| Titlu | Grădina de după ploaie |
| Status | Previzualizare |
| Poză | Poster CSS/SVG fixture — **fără** `sourceUrl` real |
| Mod | Popout |

**Interzis în fixture:** date din `ProjectRecord`, `projectId` real, surse/asseturi private, bucket paths, signed URLs.

### Panoul „Personalizează” — valori v1 înghețate

| Grup | Valori v1 |
| --- | --- |
| Personaj | Niciunul · Fluture · Dragon blând · Pisică-lună |
| Efect | Niciunul · Stele · Nori · Frunze · Scântei · Confetti |
| Atmosferă | Dimineață · Apus · Noapte · Vis |
| Sunet | Liniște · Ploaie · Pădure · Muzică blândă |
| Poziție | Sus · Jos · Stânga · Dreapta · Centru |
| Scară | Mică · Medie · Mare |
| Activ | Toggle **„Arată în lume”** |

Alegerile sunt **numai** React state local.  
**Nu** apar butoane „Salvează”, „Publică” sau orice CTA care sugerează persistență.

**Constrângeri:** max 1 personaj + max 2 efecte + 1 sunet; fără upload liber GLB/audio/video; fără jargon 3D.

### Copy înghețat

```text
Studio
Fă lumea ta mai a ta.

Personalizează lumea cu câteva alegeri simple.
Schimbările tale sunt o previzualizare.
```

| CTA | Text |
| --- | --- |
| Principal | Vezi prin cameră |
| Secundar | Înapoi la lumi |

### Layout

- **Desktop:** previzualizare scenă (~60%) + panou Personalizează (~40%)
- **Mobil (375 px):** previzualizare + sheet Personalizează + CTA sticky „Vezi prin cameră” (label only until AR gate)

### Stări UI de acoperit (Go B)

| Stare | Notă |
| --- | --- |
| Proiect fixture disponibil | Titlu + status Previzualizare + poster CSS/SVG |
| Nicio alegere personaj/efect | Gol sincer (ex. „Niciunul” selectat) |
| Element activ vs dezactivat | Toggle „Arată în lume” |
| Variantă „În curând” | Opțional, pentru un control nefuncțional |
| Mobile 375 px | Sheet + sticky CTA |
| Desktop | Split panou |

### Hard non-scope (Go A și Go B)

| Interzis |
| --- |
| Orice `PATCH` / `POST` / save / autosave |
| Cameră reală, `getUserMedia`, tracking, MindAR, `.mind` |
| Upload tip: poză, model, sunet |
| Worker, jobs, publish, deploy |
| Wiring la `/studio/[projectId]` live sau `/creaza/*` |
| Fetch `ProjectRecord` / `projectId` real |
| Folosirea lumilor reale din hub `/studio-preview` |
| Runtime AR (placeholder static e permis în Go B) |

### Studio Preview Go B — closed (2026-09-21)

Wired:

| Rută | Rol |
| --- | --- |
| `/studio-preview/personalizeaza` | Panou Personalizează + poster fixture |
| `/studio-preview/personalizeaza/camera` | Placeholder static „Previzualizare Cameră AR — în curând” |

Implementation: `apps/web/components/studio-personalize-preview/*` + pages above.  
State: React memory only. Poster CSS/SVG reacts to character / effect / atmosphere / position / scale / toggle.  
CTAs: „Înapoi la lumi” → `/studio-preview`; „Vezi prin cameră” → camera placeholder (no `getUserMedia`).

**Studio Preview Go B — closed (2026-09-21).**  
Static personalize atelier for fixture *Grădina de după ploaie* is complete.

**Next gate:** live AR remains unapproved. Cameră AR Preview Go B (static mock) is closed in §15.

### Approval history

1. **Studio Preview Go A** — ✅ frozen this §14 (2026-09-21)  
2. **Studio Preview Go B** — ✅ delivered (2026-09-21)  
3. Cameră AR Preview — see §15

---

## 15. Frozen — Cameră AR Preview static (Cameră AR Preview Go A)

Status: **frozen + Go B delivered** (2026-09-21).  
**Cameră AR Preview Go A** locked states/copy/a11y. **Cameră AR Preview Go B** wired interactive mock on `/studio-preview/personalizeaza/camera`.  
Still **no** device camera, tracking, real projects, or writes.

Purpose: validate AR **language and state sequence** before any device camera or runtime. Mock UI only — not live AR. Aligns with [atelier-three-spaces-ux.md](./atelier-three-spaces-ux.md) §5 (preview branch).

Current placeholder at `/studio-preview/personalizeaza/camera` (“în curând”) remains until Go B; Go B will **replace or transform** it into the intro — it must not stay as the only state.

### Flow (Studio → Cameră AR → Studio)

```text
Studio Preview (/studio-preview/personalizeaza)
  → CTA „Vezi prin cameră” (from Studio)
  → Intro Cameră AR
  → „Încearcă previzualizarea”
  → Pregătire (loader decorativ)
  → Caută poza
  → Poză găsită
  → (opțional) Poză pierdută ↔ „Arată-mi poza din nou”
  → „Înapoi la Studio” → /studio-preview/personalizeaza
```

All transitions are **visual and local** (React state).  
**Never** request permissions. **Never** start a device camera.

### Copy principal (înghețat)

Intro — exact:

```text
Privește poza prin cameră. Observă cum prinde viață.
```

| CTA | Text | Notă |
| --- | --- | --- |
| Principal (în preview) | **Încearcă previzualizarea** | Advances simulated states only |
| Revenire | **Înapoi la Studio** | → `/studio-preview/personalizeaza` |
| Reluare căutare | **Arată-mi poza din nou** | From „Poză pierdută” → „Caută poza” |

**Interzis pe CTA-uri:** „Permite camera”, „Pornește camera”, „Activează camera” — preview-ul nu deschide camera.

Badge persistent: **Previzualizare**.

### Stări simulate (înghețate)

| Stare | Titlu / mesaj | Acțiune în mock |
| --- | --- | --- |
| Intro | „Privește poza prin cameră. Observă cum prinde viață.” | CTA **Încearcă previzualizarea** |
| Pregătire | „Pregătim privirea.” | Loader decorativ — **zero** request / permisiune |
| Caută poza | „Caută poza în fața ta.” | Ramă / ghid CSS–SVG + animație redusă (respectă `prefers-reduced-motion`) |
| Poză găsită | „Am găsit poza.” | Lumea fixture (CSS/SVG) apare peste ancoră |
| Poză pierdută | „Nu mai văd poza.” | Păstrează ghidul + CTA **Arată-mi poza din nou** |
| Cameră indisponibilă | „Camera nu este disponibilă.” | **Înapoi la Studio** only — **fără** link Settings (nu există permisiune reală) |
| Browser necompatibil | „Această previzualizare funcționează cel mai bine pe telefon.” | **Înapoi la Studio** |
| Placeholder vechi | — | Se elimină sau se transformă în **Intro**; nu mai rămâne „în curând” ca singură stare |

Demo controls (chips / „Simulează…”) may switch states for design review; they must not imply real tracking.

### Permission note (viitor live — out of preview scope)

When real AR ships later: request camera **in context**, after the user tries the feature, with a simple benefit explanation — **not** on app load. Preview Go B must not rehearse a permission dialog as if it were live.

### Scene CSS/SVG fixture

| Strat | Conținut |
| --- | --- |
| Fundal | Masă / hârtie / poster fixture (aceeași familie vizuală ca *Grădina de după ploaie*) — fără `sourceUrl` real |
| Ghid | Ramă / colțuri / „țintește pagina” — CSS/SVG |
| Lume (la Poză găsită) | Overlay decorativ CSS/SVG (personaj/efect stilizate) — **nu** Three.js / GLB / MindAR |
| Loader (Pregătire) | Spinner / shimmer CSS — oprește animația la `prefers-reduced-motion: reduce` |

Handoff Studio → Cameră: optional fixed decorative overlay in Go B; passing live personalize state in-memory is nice-to-have, **not** required for Go A freeze.

### Layout

| Viewport | Comportament |
| --- | --- |
| **Mobil 375 px** | Cadru full-bleed; copy + CTA sticky jos; ținte touch ≥ ~44×44 px |
| **Desktop** | Cadru centrat (max ~24–28 rem lățime); panel copy sub / lângă cadru; același set de stări — **fără** stream video fals ca „cameră live” |

### Accesibilitate (obligatoriu în Go B)

| Cerință | Detaliu |
| --- | --- |
| Controale | Butoane cu etichete descriptive; `:focus-visible` clar |
| Feedback | Text pentru fiecare stare — nu doar culoare / animație |
| Mișcare | Respectă `prefers-reduced-motion` (fără animații esențiale) |
| Contrast | Text / fundal suficient pe cadru și CTA-uri |
| Live regions | `aria-live` (polite) la schimbarea stării simulate |
| Touch | Ținte confortabile pe mobil |
| Audio | **Fără** sunet autoplay |

### Hard non-scope (Go A și Go B)

| Interzis |
| --- |
| Rută nouă (Go B evoluează **doar** `/studio-preview/personalizeaza/camera`) |
| `getUserMedia`, permission prompts, video stream, captură, înregistrare |
| MindAR, `.mind`, image tracking, Three.js, GLB |
| fetch / API / POST / PATCH / save / localStorage / sessionStorage / IndexedDB |
| `projectId` / `sourceUrl` / `ProjectRecord` reale |
| Audio real; jobs; worker; publish; deploy |
| Modificări `/creaza/*` sau producție `/ar/[slug]` |

### Cameră AR Preview Go B — closed (2026-09-21)

Wired on existing route **`/studio-preview/personalizeaza/camera`**:

- Intro → Pregătire → Caută poza → Poză găsită / pierdută (+ demo indisponibil / necompatibil)
- CTA **Încearcă previzualizarea**; badge **Previzualizare — camera nu pornește încă**
- CSS/SVG fixture scene; button-driven transitions only (decorative loader on Pregătire)
- **Înapoi la Studio** → `/studio-preview/personalizeaza`
- Implementation: `camera-ar-*.ts(x)` under `components/studio-personalize-preview/`

**Next:** live AR / `getUserMedia` remains a separate future gate — not opened by Go B.

### Approval history

1. **Cameră AR Preview Go A** — ✅ frozen this §15 (2026-09-21)  
2. **Cameră AR Preview Go B** — ✅ delivered (2026-09-21)  
3. Live camera / tracking — pending separate approval

---

## 16. Frozen — Figurină 3D vs Pop-out (product split)

Status: **Go A frozen** (2026-09-21). **Go C implemented** (Tripo Image-to-3D) — see [figurine-3d-runbook.md](./figurine-3d-runbook.md).

**Implemented today:**
- Pop-out din desen (`mode: "popout"`, `popout_build`) — untouched.
- Figurină 3D (`mode: "figurine_3d"`, `figurine_build`, provider **Tripo** OpenAPI v3).

### Product direction

| | **Pop-out din desen** | **Figurină 3D** |
| --- | --- | --- |
| Ce face | Relief / extrudare fidelă | AI image-to-3D (Tripo); mesh per subject |
| MVP | Multi-component layered relief | **One isolated subject** per generation |
| Artifact | `…/popout.glb` | `…/figurine.glb` (`figurine-tripo-v1`) |

### User-facing choice (copy frozen)

```text
Cum vrei să prindă viață?

[ Pop-out din desen ]
Relief rapid, fidel desenului tău.

[ Figurină 3D ]
Personaje ilustrate care pot fi privite din toate părțile.
```

Disclosure: *Modelul 3D este generat dintr-o singură imagine. Detaliile nevăzute, inclusiv spatele, sunt interpretate.*

Unavailable reasons (truthful): „În curând” (feature gate) · „Configurarea 3D nu este disponibilă încă” · „Alege sau decupează un singur personaj…”.

### Multi-asset rule (frozen)

Never submit a multi-character scene as one Tripo task. MVP = one isolated PNG/JPEG subject; schema supports multiple `figurineSubjects` later.

### Gates

| Gate | Status |
| --- | --- |
| **Go A** | ✅ frozen |
| **Go B** | superseded by Go C UI (choice + progress in Studio) |
| **Go C** | ✅ Tripo provider + `figurine_build` + mode `figurine_3d` (no auto-publish; no live Tripo in tests) |

### Known MVP limitations

- Single subject only; no automatic semantic multi-character split.
- Back side inferred by provider.
- **Secrets:** `TRIPO_*` only on Hetzner worker. Vercel uses non-secret `FIGURINE_3D_ENABLED` (see `docs/figurine-3d-runbook.md`).
- Max 1 active job and 3 ready figurine assets per project.
- Geometry budget soft-capped for mobile AR; oversized/malformed GLBs are rejected before R2 write.

