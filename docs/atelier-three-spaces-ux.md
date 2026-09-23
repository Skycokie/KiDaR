# Atelier — trei spații conectate (UX only)

Status: **design** (2026-09-21)  
Scope: arhitectură UX, sitemap, copy, elemente curatoriate v1.  
**Nu** implementează cameră, tracking, `.mind`, upload, AR runtime, model de date, endpointuri, Appwrite/R2, joburi, publish sau deploy.

---

## 1. Cele trei spații

| Spațiu | Rol | Nu este |
| --- | --- | --- |
| **Creează** | Traseu rapid „poză → lume” (4 pași) | Editor 3D / personalizare avansată |
| **Studio** | Personalizează o **lume deja creată** | Locul primului draft |
| **Cameră AR** | Descoperire: camera pe poză = ancoră | Creator sau editor |

Promisiune AR (copy înghețat pentru ecranul de pornire AR și momentul Lume):

```text
Privește poza prin cameră. Observă cum prinde viață.
```

CTA AR propus: **Vezi prin cameră** (Studio → cameră). În preview: pe ecranul Intro, CTA este **Încearcă previzualizarea**.

---

## 2. Sitemap

```text
Atelier (hub / studio-preview)
├── Creează (/creaza-preview → ulterior /creaza/*)
│     1/4 Pornire → 2/4 Poză → 3/4 Scenă → 4/4 Lume
│           └─ din Lume:
│                 ├─ Vezi prin cameră → Cameră AR
│                 └─ Deschide Studio → Studio
├── Lumile tale
│     └─ deschide lume → Studio (/studio/[projectId])
│           └─ Personalizează → Vezi prin cameră → Cameră AR
└── Cameră AR (/ar/[slug] — viitor runtime)
      └─ Înapoi la Studio
```

### Trasee

1. **Prima magie:** Creează 1→4 → (opțional) Studio → Cameră AR  
2. **Revenire:** Lumile tale → Studio → Cameră AR  
3. **Din AR:** Înapoi la Studio (fără a pierde lumea)

Regulă: **Studio nu creează primul draft.** Draftul vine din Creează (Create Go B / producție).

---

## 3. Creează — wireframe & copy

| Pas | Ecran | Copy principal | CTA |
| --- | --- | --- | --- |
| 1 / 4 | Pornire | Cu ce începe lumea? | Începe lumea |
| 2 / 4 | Poză | Așază poza pe masă | Alege scena |
| 3 / 4 | Scenă | Cum vrei să prindă viață? | Salvează alegerea |
| 4 / 4 | Lume | Privește poza prin cameră. Observă cum prinde viață. | Vezi prin cameră · Deschide Studio |

**Limite:** fără editor 3D; fără panou Personalizează; upload sursă rămâne gate separat (Source Go B).

---

## 4. Studio — panou Personalizează

**Contract înghețat + Go B:** [creaza-redesign-direction.md](./creaza-redesign-direction.md) §14.  
UI: `/studio-preview/personalizeaza` (fixture local). Cameră AR Preview: §15 Go A frozen; Go B pending.

### Layout

- **Desktop:** previzualizare scenă (~60%) + panou Personalizează (~40%).  
- **Mobil (375 px):** previzualizare full-bleed + sheet „Personalizează” + CTA sticky **Vezi prin cameră**.

### Copy (înghețat §14)

```text
Studio
Fă lumea ta mai a ta.

Personalizează lumea cu câteva alegeri simple.
Schimbările tale sunt o previzualizare.
```

| Zonă | Text |
| --- | --- |
| CTA principal | Vezi prin cameră |
| CTA secundar | Înapoi la lumi |

### Elemente curatoriate v1 (înghețate §14)

| Grup | Valori |
| --- | --- |
| Personaj | Niciunul · Fluture · Dragon blând · Pisică-lună |
| Efect | Niciunul · Stele · Nori · Frunze · Scântei · Confetti |
| Atmosferă | Dimineață · Apus · Noapte · Vis |
| Sunet | Liniște · Ploaie · Pădure · Muzică blândă |
| Poziție | Sus · Jos · Stânga · Dreapta · Centru |
| Scară | Mică · Medie · Mare |
| Activ | Toggle „Arată în lume” |

**Fixture preview:** *Grădina de după ploaie* · status Previzualizare · poster CSS/SVG · mod Popout — fără `ProjectRecord` / `projectId` real.

**Constrângeri:** max 1 personaj + max 2 efecte + 1 sunet; fără upload liber; fără „Salvează” / „Publică”; state local only.

---

## 5. Cameră AR — stări UX

### 5a. Preview static (contract înghețat)

**Contract:** [creaza-redesign-direction.md](./creaza-redesign-direction.md) §15 (Go A + Go B closed).  
UI: `/studio-preview/personalizeaza/camera` — mock static, fără cameră reală.

```text
Studio → Intro → Încearcă previzualizarea → Pregătire → Caută poza → Poză găsită → Înapoi la Studio
```

Intro (exact): *Privește poza prin cameră. Observă cum prinde viață.*  
CTA preview: **Încearcă previzualizarea** (nu „Permite / Pornește camera”).  
Revenire: **Înapoi la Studio**.

| Stare mock | Mesaj |
| --- | --- |
| Intro | Privește poza prin cameră. Observă cum prinde viață. |
| Pregătire | Pregătim privirea. |
| Caută poza | Caută poza în fața ta. |
| Poză găsită | Am găsit poza. |
| Poză pierdută | Nu mai văd poza. (+ Arată-mi poza din nou) |
| Cameră indisponibilă | Camera nu este disponibilă. |
| Browser necompatibil | Această previzualizare funcționează cel mai bine pe telefon. |

Zero `getUserMedia`. Scenă CSS/SVG fixture. A11y: focus, `aria-live`, `prefers-reduced-motion`, fără audio autoplay.

### 5b. Producție (viitor live — nu Go B)

Headline: *Privește poza prin cameră. Observă cum prinde viață.*  
Poza = ancoră; scena Studio apare peste poză. Cererea de permisiune: **în context**, după intent, cu beneficiu clar — nu la load.

| Stare | Copy |
| --- | --- |
| Cameră nepermisă | Avem nevoie de cameră ca să vezi lumea. Poți permite din setările telefonului. |
| Cameră indisponibilă | Camera nu poate porni acum. Încearcă din nou sau folosește alt dispozitiv. |
| Caută poza | Îndreaptă camera spre poza de pe masă. Ține pagina întreagă în cadru. |
| Poză găsită | Iată lumea ta. |
| Poză pierdută | Am pierdut poza. Mișcă telefonul încet până o regăsești. |
| Dispozitiv/browser necompatibil | Acest browser nu poate deschide camera AR. Încearcă pe telefon, într-un browser recent. |
| Revenire în Studio | CTA: **Înapoi la Studio** |

**Desktop (producție):** mesaj onest „Deschide pe telefon” + QR (când există publish).  
**Mobil (producție):** experiența AR principală.

---

## 6. Amânat explicit

- Cameră reală, image tracking, compilare `.mind`
- Source Go B / upload poză / Appwrite source writes
- AR runtime live, pipeline, worker, publish, deploy
- Editor 3D liber; upload user GLB / audio / video
- Modificări model de date / endpointuri noi
- Jargon tehnic în UI (UV, hash, tracker, Meshy live)

---

## 7. Desktop vs mobil (rezumat)

| | Desktop | Mobil |
| --- | --- | --- |
| Creează | Coloană editorială, progres 1–4 vizibil | Full-bleed, CTA sticky |
| Studio | Split scenă + panou | Sheet Personalizează |
| AR preview | Cadru centrat + aceleași stări mock | Full-bleed 375 px + CTA sticky |
| AR producție | Redirect / QR pe telefon | Cameră live + stările §5b |

---

## 8. Legături

- Preview Creează actual: `/creaza-preview` ([creaza-redesign-direction.md](./creaza-redesign-direction.md) §11–13)  
- Studio Personalizează: `/studio-preview/personalizeaza` ([creaza-redesign-direction.md](./creaza-redesign-direction.md) §14 — Go B closed)  
- Cameră AR Preview static: `/studio-preview/personalizeaza/camera` ([creaza-redesign-direction.md](./creaza-redesign-direction.md) §15 — Go B closed)
- Atelier hub: `/studio-preview` ([studio-ux-direction.md](./studio-ux-direction.md))  
- Canvas Cursor: `atelier-three-spaces.canvas.tsx` (vizualizare în IDE)
