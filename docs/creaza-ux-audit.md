# Simple Creator (`/creaza/*`) — Read-only UX / tech audit

Status: **audit complete** (2026-09-20)  
Prerequisite: Studio Preview Stage 1 (entry CTAs → existing `/creaza` | `/intra`) is **closed**.  
Non-goals of this document: redesign, upload/publish contract changes, Library integration, deploy.

---

## 0. Product posture (locked)

| Layer | Role |
| --- | --- |
| `/studio-preview` | Creative face + navigation/brand; read-only worlds; entry to create |
| `/creaza/*` | **Only** functional create/upload path (until gradual redesign is approved per write) |
| `/intra` | Magic-link gate for Simple Creator |
| `/studio/[projectId]` | Advanced editor escape hatch — not part of the RO funnel |

Studio must not grow a second create/upload/publish implementation.

---

## 1. Screen map

| Route | Files | Purpose | Headline (RO) | Progress |
| --- | --- | --- | --- | --- |
| `/intra` | `app/intra/page.tsx`, `intra-form.tsx` | Magic-link sign-in | Intră în kidAR | — |
| `/creaza` | `app/creaza/page.tsx`, `creaza-preset-form.tsx` | Preset + **create project** | Ce vrei să prindă viață? | Pasul 1 din 5 |
| `/creaza/[id]/foto` | `…/foto/page.tsx`, `foto-form.tsx` | Capture/upload drawing | Fotografiază pagina | Pasul 2 din 5 |
| `/creaza/[id]/experienta` | `…/experienta/page.tsx`, `experienta-form.tsx` | Experience choice | Cum vrei să prindă viață? | Pasul 3 din 5 |
| `/creaza/[id]` | `app/creaza/[projectId]/page.tsx` | Confirmation | Am salvat alegerea ta. | Pasul 4 din 5 |

Shared chrome: `components/simple-creator/shell.tsx`, `document-lang.tsx`, `creaza.css`, `lib/simple-creator.ts`.

**Gap:** labels say **din 5**, but **no step 5** exists. Confirmation says prep comes “în pasul următor.”

---

## 2. Per-screen fields, validation, states

### `/intra`

- Field: email (`required`).
- Client: trim + `checkValidity()`; custom error string.
- Loading: `Se trimite…` / success copy about checking Spam.
- Error: generic send failure (no stack traces).
- Writes: `POST /api/auth/magic-link` with `next: "/creaza"` only.

### `/creaza` (preset)

- Fields: preset buttons `coloring` | `story` | `mission`.
- Must select before continue.
- Loading: `Pregătim surpriza…`.
- Errors: select required · quota exhausted · generic save failure.
- Write: `POST /api/projects` → creates project (`name` surprise string, `mode: "popout"`, `settings.preset`).

### `/creaza/[id]/foto`

- Fields: camera + library file inputs (`image/jpeg`, `image/png`).
- Client: JPEG/PNG, max 10 MB; soft warn if &lt; 50 KB.
- Loading: `Salvăm fotografia…`.
- Local preview via `URL.createObjectURL` (not reloaded from storage).
- Write: `POST /api/projects/:id/source`.
- Back → `/creaza` (abandons project context; can leave orphan drafts).

### `/creaza/[id]/experienta`

- Fields: `popout` | `gallery`; gallery chips + figures; optional mission `ctaText` (max 80) if preset is mission.
- Gallery load: `GET /api/gallery` (read-only).
- Gallery figure selection is **not** required before continue.
- Write: `PATCH /api/projects/:id` (mode + settings merge).
- Escape: `/studio/[id]`.

### `/creaza/[id]` (confirmation)

- No fields; ownership gate only.
- CTAs: new surprise → `/creaza`; advanced → `/studio/[id]`.
- No publish UI.

---

## 3. Auth rules

| Condition | Result |
| --- | --- |
| Guest on `/creaza/*` | `redirect("/intra")` |
| Signed-in on `/intra` | `redirect("/creaza")` |
| Home / Studio CTAs | signed-in → `/creaza`, guest → `/intra` |
| Magic-link `next` | only `"/creaza"` honored |
| Callback | creaza next → `/creaza`, else → `/dashboard` |

Guards are **per-page** via `getLoggedInUser()`; middleware is passthrough.

---

## 4. Write points (exact — redesign must not casually touch)

| Mutation | UI call site | API | Persistence |
| --- | --- | --- | --- |
| Magic link | `IntraForm.submit` | `POST /api/auth/magic-link` | Appwrite token |
| Session mint | email → `/auth/callback` | `GET` callback | session cookie (+ `ensureProfile`) |
| Create project | `CreazaPresetForm.continueCreate` | `POST /api/projects` | `createProjectDocument` |
| Upload source | `CreazaFotoForm.upload` | `POST /api/projects/:id/source` | storage + `source_image_path` |
| Save experience | `CreazaExperientaForm.continueSave` | `PATCH /api/projects/:id` | `updateProjectDocument` |

**Not called from creaza:** publish, delete, asset upload, worker enqueue, R2 public writes.

Any change that can create a project, upload an image, enqueue a job, or publish needs a **separate, targeted approval**.

**Frozen redesign contract (source Go A + Source Go B, 2026-09-21):** `POST /api/projects/:projectId/source` is frozen in `docs/creaza-redesign-direction.md` §11. Source Go B wires the photo save CTA on `/creaza-preview` only (stores `sourceUrl`). PATCH / magic-link / publish remain unapproved. `/creaza/*` untouched.

**Frozen redesign contract (Create Go A + Go B, 2026-09-21):** `POST /api/projects` is frozen in `docs/creaza-redesign-direction.md` §12. Create Go B wires the preset CTA on `/creaza-preview` only (stores `project.id`).

**Frozen Scene PATCH (Scene Go B, 2026-09-21):** `PATCH /api/projects/:projectId` with `{ mode: "popout" }` only — see `docs/creaza-redesign-direction.md` §13. Wired on `/creaza-preview` Scenă CTA; no ProjectRecord in client state. **Draft 4-step flow closed.**

**Frozen Studio Preview (Go A + Go B, 2026-09-21):** fixture *Grădina de după ploaie* at `/studio-preview/personalizeaza` — local React state only; camera CTA → static placeholder. See `docs/creaza-redesign-direction.md` §14. **Closed.**

**Frozen Cameră AR Preview (Go A + Go B, 2026-09-21):** simulated AR states on `/studio-preview/personalizeaza/camera` — CSS/SVG mock only, no `getUserMedia`. See `docs/creaza-redesign-direction.md` §15. **Closed.**

**Frozen Figurină 3D (Go A + Go C, 2026-09-21):** mode `figurine_3d`, job `figurine_build`, Tripo server-only; Studio choice + progress; Pop-out untouched. See `docs/creaza-redesign-direction.md` §16 and `docs/figurine-3d-runbook.md`.
---

## 5. Navigation graph

```text
[/] or [/studio-preview] CTAs
  guest → /intra → magic link → /auth/callback → /creaza
  signed-in → /creaza

/creaza  --POST create-->  /creaza/:id/foto
                              |
                              v
                         /creaza/:id/experienta  --PATCH-->  /creaza/:id
                              |                                |
                              +--> /studio/:id                 +--> /creaza | /studio/:id
```

---

## 6. Presentation vs submit coupling (for gradual redesign)

**Safer to restyle first (static / fixtures):**

- `SimpleCreatorShell`, `creaza.css`, page headlines/leads
- Choice-card / checklist / chip markup if handlers + `aria-*` stay

**Tightly coupled (keep behavior; wrap UI carefully):**

- Preset create fetch + quota branching
- Foto validation + FormData POST + status→error mapping
- Experiență PATCH body (`experiencePatch`) + gallery fetch lifecycle
- Intra magic-link + `next: "/creaza"`

**Landmines:**

1. “din 5” without step 5 — renumber or add a real step before promising publish/QR.
2. Gallery mode without selected model is allowed today.
3. Foto “Înapoi” → `/creaza` orphans drafts.
4. Shared APIs with Studio — contract changes need Studio impact check.
5. Keep publish unreachable from these forms.

---

## 7. Recommended redesign sequence (approved order)

1. **This audit** ✅  
2. **Local / static-first UI** on fixtures, Atelier language — no submit-logic change  
3. **Behavioral wiring** in small PRs: nav/read → existing form state → existing upload → existing create (each write PR separately approved)  
4. **Never** start real Library integration in parallel without a dedicated privacy/preview plan  

---

## 8. File index (creaza-facing)

```text
app/intra/**
app/creaza/**
app/auth/callback/route.ts
components/simple-creator/**
lib/simple-creator.ts
app/api/auth/magic-link/route.ts
app/api/projects/route.ts
app/api/projects/[projectId]/route.ts
app/api/projects/[projectId]/source/route.ts
app/api/gallery/route.ts
lib/projects.ts
lib/appwrite/{client,db,storage}.ts
```
