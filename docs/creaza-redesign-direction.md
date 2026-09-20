# Simple Creator redesign — static-first direction

Status: **Stage 2 preview** (2026-09-20)  
Route: `/creaza-preview` (isolated, fixtures only)  
Production funnel: `/creaza/*` unchanged.

---

## 1. Intent

Turn Simple Creator from an admin-style wizard into a **creation ritual** that shares language with Atelier / Lumi / Bibliotecă:

```text
desen → alegere → scenă → experiență
```

Studio remains the creative face. `/creaza/*` remains the only place that may create/upload/publish — this preview **must not** call those APIs.

---

## 2. Screen mapping (current → new composition)

| Current route | Progress (old) | Preview step | Progress (new) | Visual direction |
| --- | --- | --- | --- | --- |
| `/creaza` | Pasul 1 din 5 | `preset` | **1 / 4 — Pornire** | Three large editorial doors (real presets only) |
| `/creaza/[id]/foto` | Pasul 2 din 5 | `foto` | **2 / 4 — Desen** | Atelier table: paper frame + creative drop zone |
| `/creaza/[id]/experienta` | Pasul 3 din 5 | `experienta` | **3 / 4 — Scenă** | Big atmospheric choices; gallery marked În curând in preview |
| `/creaza/[id]` | Pasul 4 din 5 | `confirmare` | **4 / 4 — Lume** | “Lumea ta e pregătită să înceapă” + visual summary |

**Fixed:** no more “din 5”. Exactly **four** visible steps matching four functional screens.

---

## 3. Proposed Romanian copy (preview)

### Preset
- Title: **Cu ce începe lumea?**
- Lead: Alegi un tip de desen. Apoi îl aduci pe masă și îi dai o scenă.
- Doors: Un desen colorat · O pagină de poveste · O misiune
- CTA: Continuă cu desenul

### Foto
- Title: **Așază desenul pe masă**
- Lead: O fotografie clară a hârtiei. Fără ecrane, fără umbre grele.
- Drop empty: Așază fotografia aici
- Drop selected: Desenul tău e pe masă
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

- Loading: label “Pregătim desenul…” on the drop zone only.
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

Local File read is implemented below. **Upload (`POST …/source`) still needs a separate go.**

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
