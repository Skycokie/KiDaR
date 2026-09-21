# kidAR Studio — Visual Product Direction & UI/UX Foundation

Status: **design / planning** (Batch 1 ops posture unchanged: single worker `kidar-worker-1`).  
Scope: product vision, information architecture, design system, and a **local** Studio shell only.  
Non-goals: pipeline, worker, R2, Appwrite mutations, publish, public AR, UX-3, Meshy live integration, deploy.

---

## 1. Product vision

kidAR is a premium creative tool that turns drawings, illustrated pages, photos, and ideas into interactive AR experiences. The emotional promise is magical and calm—not childish kitsch, not pro-3D software anxiety.

**Primary promise (RO, user-facing):**

```text
Adaugă o poză.
Alege ce prinde viață.
Scanează și vezi magia în AR.
```

**Design thesis:** a calm cinematic atelier where a photo or drawing becomes the entrance to a living world — not a dashboard for managing files. Composition first (space, crop, rhythm, one memorable scene), then tools.

**Rejected visual model (explicit):**

```text
sidebar + dashboard widgets + uniform cards + status badges + boxed panels
```

That composition was tried in `/studio-preview` V1 and rejected: it looked like a dark SaaS admin, even with premium fonts and a dark palette. Color and typography alone do not create Lusion/Cosmos feeling.

**Accepted visual model:**

```text
homepage editorială + atelier creativ + galerie personală
```

**Influence balance (do not clone):**

| Reference | Take | Leave behind |
| --- | --- | --- |
| Lusion / Active Theory | Editorial pacing, immersive first viewport, dramatic type, one memorable scene, controlled motion | Agency-portfolio complexity, perpetual WebGL backgrounds, decorative mascots |
| Cosmos | Image-first collecting, asymmetric crops, curiosity, generous empty space | Pure mood-board product with weak task flow |
| Meshy-style creators | Clear creation paths and honest unavailable states | Dashboard aesthetic, chat-like AI shells, jargon |

kidAR is **Lusion/Cosmos for composition**, Meshy only for clarity of choices.

---

## 2. Target users

| Persona | Need | UI implication |
| --- | --- | --- |
| Parent | Fast path from drawing to phone AR | Short labels, big CTAs, no jargon |
| Child (+ adult) | Fun, readable, safe | Large targets, playful but not noisy |
| Grandparent | Clarity over density | High contrast, few steps visible |
| Teacher | Reusable classroom packs | Library, presets, share after publish |
| Illustrator / designer | Control + craft | Studio depth available without forcing it |
| Creator | Series of experiences | Projects + library collections |

The UI must **never** assume knowledge of 3D, tracking, `.mind`, UV, hashing, or workers. Technical concepts stay in advanced / coming-soon layers or remain invisible.

---

## 3. Primary user journeys

### J1 — First magic (happy path)

1. Sign in (existing magic link).
2. Create or open a project.
3. Upload a drawing (source image → private library).
4. Choose what comes alive (character / model / preset — or “coming soon” AI).
5. Preview placement (simple AR-oriented preview).
6. Get a QR / phone preview.
7. Explicit publish → public experience.

### J2 — Return creator

1. Open Projects.
2. Resume draft or duplicate scene preset.
3. Swap sound / motion / character from Library.
4. Re-publish (future; today: existing Studio publish path).

### J3 — Browse then make

1. Explore / Inspiration (curated examples).
2. “Make something like this” → Create with preset scaffold.
3. Replace source image with own drawing.

### J4 — Romanian Simple Creator (preserved)

Existing `/creaza/*` remains the **only** guided create/upload funnel.  
`/studio-preview` is the creative face and entry layer (Stage 1 closed: CTAs → `/creaza` | `/intra`).  
Gradual redesign of Simple Creator follows: [creaza-ux-audit.md](./creaza-ux-audit.md) → static UI on [`/creaza-preview`](./creaza-redesign-direction.md) → small behavioral PRs → separate approval for any write/deploy.


---

## 4. Information architecture

```text
Studio
├── Atelier / Home     Cinematic first experience
├── Creează            Ritual of large choices
├── Lumi               Personal gallery of worlds (not “Projects”)
├── Bibliotecă         Cabinet of curiosities
├── Explore            Inspiration (later)
└── Settings           Utilitarian
```

**Related but outside Studio chrome:**

- Public AR: `/ar/[slug]` (consumer, no Studio chrome).
- RO Simple Creator: `/`, `/intra`, `/creaza/*`.
- Auth: `/login`, `/auth/callback`.
- Current production editor: `/studio/[projectId]` (preserve until cutover).

---

## 5. Two UI worlds (required)

Do not force every screen into one cinematic style. Split intentionally:

| Zone | Style | Why |
| --- | --- | --- |
| Atelier / Home | Cinematic, spacious, emotional, one scene | Inspiration on entry |
| Create | Simple ritual, large visual choices | Begin without tool anxiety |
| Library | Cosmos-like, masonry, explorabile | Collecting, not inventory |
| Editor proiect | Calm, precise, contextual controls | Efficiency while making |
| Settings | Utilitarian, denser, simple | Admin without theatre |

This lets the user feel magic at the door and still work when editing.

---

## 6. Studio navigation

| Region | Desktop | Mobile |
| --- | --- | --- |
| Header | Near-invisible: brand + Atelier / Lumi / Bibliotecă + menu/profile | Compact top + optional sheet |
| Bottom nav | None | Atelier / Creează / Lumi / Bibliotecă |
| First viewport | ~80–90% storytelling, ~10–20% navigation | Same, stacked |
| Hero | Full-bleed editorial statement + handmade visual stage | Stage above or below type |

No permanent desktop sidebar. No dashboard widgets in the first viewport.

---

## 7. Page map (target)

| Page | Purpose | Phase |
| --- | --- | --- |
| Atelier | Editorial hero + “Lumile tale” gallery | `/studio-preview` V2 |
| Creează | Four large choices + quiet imagine field | Preview fixtures |
| Lumi | Asymmetric poster gallery | Preview fixtures → later live |
| Bibliotecă | Masonry cabinet of curiosities | Preview fixtures |
| Explore | Curated inspiration | Later |
| Settings | Preferences | Later utility |
| Project editor | Arrange, motion, sound, publish | Keep `/studio/[projectId]` for now |
| `/studio-preview` | **Local design foundation only** | This task |

---

## 8. Resource model (UI concepts)

Keep these distinct in copy and cards:

| Resource | Meaning | Default visibility |
| --- | --- | --- |
| Source image | Original drawing / page / photo | Private |
| Tracking image | Derived AR target | Hidden in simple flow |
| Visual asset | Image / sticker / reference | Private by default |
| Character | Reusable 3D visual | Library-controlled |
| 3D model | GLB generated / imported / selected | Private by default |
| Sound | Scene audio | Private by default |
| Scene preset | Assets + placement + motion + sound | Library-controlled |
| Public experience | Shareable AR output | Public only after explicit publish |

Never surface private storage paths, bucket IDs, content hashes, or worker job IDs in the primary UI.

---

## 9. Visual principles

1. **Composition before chrome** — space, crop, rhythm and one memorable scene beat panels, borders and badges.
2. **Reject dashboard-first layouts** — no permanent sidebar, no equal card grids, no status-led inventory as the first impression.
3. **Brand-first** — “kidAR” is quiet in the header; the hero statement carries the emotion.
4. **Dark editorial canvas** — warm charcoal; soft white text; accents sparingly (not a violet SaaS wash).
5. **Handmade visuals** — paper grain, pencil lines, cut-outs; no generic mascot blob.
6. **Asymmetry in galleries** — portrait / panorama / square posters; masonry in library.
7. **Motion with purpose** — sparse drift/parallax; honor `prefers-reduced-motion`.
8. **Jargon firewall** — user words: poză, lume, personaj, sunet, previzualizare, publică. Keep „desen” only for artistic/handmade sense (ex. „un desen colorat”).

### Palette proposal (CSS tokens)

```text
--studio-bg:            #0b0d12          /* near-black charcoal */
--studio-bg-elevated:   #12151c
--studio-surface:       #181c27
--studio-surface-2:     #1e2433
--studio-border:        rgba(255,255,255,0.08)
--studio-text:          #e8eaef          /* soft white */
--studio-text-muted:    #9aa3b5
--studio-accent:        #7c6cff          /* electric violet — sparingly */
--studio-accent-2:      #3d8bfd          /* vivid blue */
--studio-warm:          #ff8f6b          /* coral/amber accent */
--studio-success:       #5ddea8
--studio-danger:        #e85d75
--studio-focus:         #a8b4ff
```

Avoid flat pure `#FFFFFF` body text and purple-on-white marketing defaults. Accents are highlights, not full-page washes.

### Typography

```text
display:  Syne / Outfit (expressive geometric grotesk)
body:     DM Sans / Plus Jakarta Sans (legible)
mono:     IBM Plex Mono / JetBrains Mono (status, technical)
```

| Role | Size guide | Weight |
| --- | --- | --- |
| Display / hero | clamp(2.5rem, 6vw, 4.5rem) | 600–700 |
| Section title | 1.5–2rem | 600 |
| Body | 1–1.125rem | 400–500 |
| Label / meta | 0.75–0.875rem | 500 |
| Mono status | 0.75rem | 400 |

Landing/hero: large and editorial. Inside Studio: compact and calm.

### Spacing / radius / shadow / motion

```text
space: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
radius: 10px controls, 16px panels, 22px featured media
shadow: soft ambient only (dark UI — prefer border + lift, not heavy drop)
motion:
  duration-fast: 140ms
  duration: 240ms
  duration-slow: 420ms
  easing: cubic-bezier(0.22, 1, 0.36, 1)
reduced-motion: disable parallax, entrance drifts, card tilt
```

### Responsive

| Breakpoint | Behavior |
| --- | --- |
| ≥980px | Editorial hero + stage side-by-side; light header nav |
| 720–979px | Stacked hero; gallery single column |
| ≤719px | Compact header + sheet; bottom nav; 320px usable |
| Touch | Min 44px targets (prefer 48px where possible) |

---

## 10. Accessibility requirements

- Keyboard: tab order follows visual order; Escape closes sheets; focus trap in dialogs.
- Visible `:focus-visible` rings using `--studio-focus`.
- Contrast: body text ≥ 4.5:1 on surfaces; large text ≥ 3:1.
- No hover-only essential actions.
- `prefers-reduced-motion` respected.
- No autoplay video.
- Decorative imagery `alt=""`; informative images have text alternatives.
- Navigation usable without WebGL.
- Where JS-dependent previews fail, show a static fallback message.

---

## 11. Empty / loading / error states

| State | Pattern |
| --- | --- |
| Empty projects | Large Create CTA + one inspiration example |
| Empty library type | Short explanation + primary add action |
| Loading list | Skeleton cards (no spinner-only) |
| Generation pending (future) | Progress + “you can leave this page” |
| Error | Plain language + retry; no stack traces |
| Coming soon | Badge + disabled control; never fake success |

---

## 12. Future AI provider UX (not live in this task)

Studio should be provider-ready conceptually:

```text
MeshyProvider
FalMeshyProvider
Hunyuan3DProvider
TrellisProvider
ManualUploadProvider
ExistingPopoutExtruderProvider
```

User-facing options:

- Generate from prompt → **Coming soon / Requires AI credits**
- Transform my image into 3D → **Coming soon / Beta**
- Choose a character → library (fixture or future live)
- Upload a 3D model → future / existing Studio upload path
- Use a scene preset → library

**Rules:** no fake APIs, fake completed jobs, fake credits, or production claims that generation works.

**Product split (Go A + Go C, 2026-09-21):** **Pop-out din desen** (shipped) vs **Figurină 3D** (`figurine_3d` + Tripo `figurine_build`) — see [creaza-redesign-direction.md](./creaza-redesign-direction.md) §16 and [figurine-3d-runbook.md](./figurine-3d-runbook.md).

---

## 13. Real today vs planned

| Capability | Today | This task | Later |
| --- | --- | --- | --- |
| Public AR on iPhone | Real | Untouched | — |
| RO Simple Creator | Real | Untouched | Polish |
| EN Dashboard + Studio editor | Real | Untouched | Migrate into new shell |
| Publish / jobs / worker | Real | Untouched | Batch 2 locking before multi-worker |
| New Studio IA + dark shell | — | `/studio-preview` local | Wire to live data |
| AI 3D generation | — | UI labelled coming soon | Provider integration |
| Explore / Inspiration | — | Mock strip | Curated content |
| UX-3 | Out of scope | Out of scope | Separate approval |

---

## 14. Explicit non-goals

- Changing AR HTML template, CSP, A-Frame/MindAR runtime, `AR_PAGE_TEMPLATE_VERSION`
- Worker logic, job locking, page-render identity
- R2 keys, pointers, caching, Appwrite schema/storage
- Publish API, enqueue, secrets, env vars, Meshy credentials/API calls
- Deployments, horizontal worker scale, UX-3
- Replacing `/studio/[projectId]` or `/creaza` in this phase
- Claiming AI generation is production-ready

---

## 15. Implementation phases

### Phase A — Foundation (this task)

1. Spec docs (`studio-ux-direction.md`, `studio-ui-integration-audit.md`).
2. Local `/studio-preview` shell + tokens + primitives + fixtures.
3. Local lint / typecheck / test / build only.

### Phase B — Live shell (future approval)

1. Adopt tokens in new layouts without breaking RO cream theme.
2. Wire Projects list read-only from existing APIs.
3. Deep-link into existing `/studio/[projectId]` for edit/publish.

### Phase C — Create flow redesign (future)

1. Progressive Create wizard aligned with resource model.
2. Library CRUD against existing upload endpoints.
3. Keep publish on proven path until cutover checklist passes.

### Phase D — AI providers (future)

1. Abstract provider interface + credit UX.
2. Real async job UI (honest states).
3. Still single-worker until Batch 2 CAS/lease.

### Phase E — Cutover

1. Feature-flag new Studio as default for EN users.
2. Preserve Simple Creator RO path.
3. Only then retire legacy dashboard chrome.

---

## 16. Operating constraint (unchanged)

```text
Worker concurrency: 1
Active worker: kidar-worker-1
Horizontal worker scale: forbidden
```

Optimistic lock re-reads from Batch 1 do not close TOCTOU; do not plan multi-worker UX assumptions.
