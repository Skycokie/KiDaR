# Figure B1 — pilot intern extins

Status: **5/5 joburi terminate tehnic** (2026-09-24).  
Publish Go B2 rămâne **oprit**. Flagurile de produs rămân false:

```text
FIGURE_GENERATION_ENABLED=false
FIGURE_AR_ENABLED=false
FIGURE_PUBLISH_ENABLED=false
```

`ready` înseamnă asset tehnic livrabil (GLB + USDZ valide, Quick Look le deschide).  
`quality approved` înseamnă asset suficient de bun pentru un utilizator. Cele două nu sunt același lucru.

## Tally

| Măsură | Rezultat |
| --- | --- |
| Joburi B1 terminate tehnic | 5/5 |
| Eșecuri tehnice de livrare GLB/USDZ | 0 |
| Modele acceptate vizual | 4/5 |
| Modele respinse calitativ | 1/5 |
| Rerulări pentru cazurile B1 | 0 |
| Publish / QR public | 0 |
| Modificări producție | 0 |

Infrastructura de staging a livrat toate asset-urile. Calitatea generării nu este încă predictibilă pentru un rollout fără review.

Pipeline: `figurine-tripo-v2`. Bucket: `kidar-figures-staging`.  
Cocoșul (`rooster-ar-staging-001`, job `beb09acea8804c57b19dbc34`) nu a fost rerulat; rămâne cazul de idempotency.

## Review de calitate — păpădie (caz negativ)

Păstrat ca fixture. Nu se rerulează și nu se șterge.

```text
projectId: b1-papadie-001
jobId: 9e0fe1d342804320809a183a
pipeline: figurine-tripo-v2
sourceFileId: 6ab4b65300315476baae

technicalStatus: ready
GLB: valid
USDZ: valid
Quick Look: pass
AR placement: pass

qualityReview: rejected
qualityReason: primary_subject_unrecognizable
reviewedAt: 2026-09-24T07:15:00Z
reviewedBy: internal
action: retained_as_negative_fixture
```

Motiv: subiectul principal nu este recognoscibil. Modelul este un obiect țepos bej, fără asemănare suficientă cu păpădia. Quick Look afișează și plasează obiectul; forma 3D nu păstrează identitatea desenului.

Statusul tehnic rămâne `ready`. Nu se marchează `failed`.

## Celelalte joburi B1 (livrare tehnică)

Review vizual de detaliu, în afara păpădiei, nu este consemnat aici desen cu desen. Tally-ul 4/5 acceptate vizual este review-ul intern al sesiunii.

| projectId | jobId | status | durationSeconds | glbBytes | usdzBytes |
| --- | --- | --- | --- | --- | --- |
| b1-sarah-001 | c26c3284d093484092592467 | ready | 601 | 3456888 | 2370000 |
| b1-papadie-001 | 9e0fe1d342804320809a183a | ready | 648 | 3226704 | 1961264 |
| b1-fluturii-001 | b3ed39488c11450d9c347ac7 | ready | 587 | 3075220 | 2165970 |
| b1-fata-blonda-001 | 6af785fed8434ff58fd09631 | ready | 835 | 3578284 | 2552234 |
| b1-copii-001 | ed92195e4238476fa4d6f3cc | ready | 768 | 3478808 | 2357228 |

## Decizie

B1 confirmă livrarea tehnică privată în staging, dar nu aprobă Publish Go B2.

Condiții rămase înainte de orice beta:

- regulă de review pentru calitate;
- criterii de eligibilitate pentru desene;
- decizie explicită asupra cazurilor quality-rejected;
- aprobare separată pentru allowlist, rate limits și kill switch.

Dacă apare o beta privată, publish-ul cere ambele condiții:

```text
asset status = ready
AND
quality review = approved
```

`ready` singur nu este suficient. Câmpul `qualityReview` nu este încă în produs; există doar în acest document.

## Flaguri

- `FIGURE_GENERATION_ENABLED=false`
- `FIGURE_AR_ENABLED=false`
- `FIGURE_PUBLISH_ENABLED=false`

Niciun flag nu este setat în Vercel Production.

## Nu intra în acest document

- chei API, R2, Tripo
- URL-uri presemnate
- ID-uri de task la provider
- cadre de cameră sau fișierul desen
