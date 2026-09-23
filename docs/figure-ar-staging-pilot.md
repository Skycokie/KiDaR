# Figure AR staging — internal pilot (passed)

Status: **pilot intern reușit** (2026-09-23).  
Publish Go B2, QR/link public, domeniu R2 public și AR pe `kidar-studio.vercel.app` rămân **neaprobate**.

## What passed

End-to-end pe mediul izolat de staging:

```text
desen 2D → figurină 3D (Tripo, job manual local)
       → GLB + USDZ în R2 staging
       → viewer autenticat /internal/ar/<projectId>
       → Quick Look pe iPhone
       → plasare AR în cameră
```

Proiectul de test: `rooster-ar-staging-001` (desen cocoș).  
Job: `beb09acea8804c57b19dbc34` → `status: ready`.

## Isolation that held

| Boundary | Staging | Production |
| --- | --- | --- |
| Vercel project | `kidar-studio-staging` | `kidar-studio` (neatins) |
| Appwrite project | `6aaa617d0039130379ec` | `6aaa61b4000e4035f26e` |
| R2 bucket | `kidar-figures-staging` only | `kidar-public-ar` neatins |
| Runtime | `KIDAR_RUNTIME_ENV=staging` | rute `/internal/ar/*` și `/api/internal/figures/*` → 404 |
| Tripo | doar job local (`.env.staging.local`) | absent pe Vercel |
| Persistat în Appwrite | `jobId`, `glbKey`, `usdzKey` | fără URL publice / presemnate |
| Acces host | Vercel Authentication | neschimbat |
| Publish | oprit | „Publică lumea” / AR live disabled |

Asset keys (pattern, nu URL):

```text
staging/projects/<projectId>/figures/<jobId>/model.glb
staging/projects/<projectId>/figures/<jobId>/model.usdz
```

Presign server-side: TTL scurt, `Cache-Control: no-store`, fără `R2_PUBLIC_BASE_URL`.

## How the pilot was run

1. Schema Appwrite staging minimă + fișier `source-drawings` + document `projects`.
2. Un job: `pnpm --filter @kidar/worker exec tsx ../../scripts/internal-figure-staging.ts <projectId>`.
3. Ownership pe un user staging dedicat (câmp `owner` + document permissions; fără `Role.any`).
4. Login Appwrite pe hostul staging, apoi `/internal/ar/<projectId>`.
5. Validare manuală iPhone: model 3D în viewer, USDZ în Quick Look, plasare AR.

Nu s-a folosit fluxul public „Începe lumea” / Creează pe staging (schema de produs completă nu e scopul acestui pilot).

## Explicitly still off

- Publish Go B2
- QR / linkuri publice / CDN R2
- `KIDAR_RUNTIME_ENV=staging` pe proiectul Vercel de producție
- Worker Hetzner / `figurine_build` ca drum de producție pentru acest flux
- Deschidere automată pentru utilizatori finali

## Next decision (separate approval)

Pilotul demonstrează că **fluxul tehnic** funcționează. Nu există activare automată după un test reușit.

| Direcție | Ce permite | Ce rămâne blocat |
| --- | --- | --- |
| Pilot intern continuat | Mai multe teste manuale, operate intern | Publish public, QR public, AR în producție |
| Grup mic de testeri | Allowlist de proiecte/utilizatori, acces controlat | Publish general, asset-uri R2 publice |
| Productizare | Publish controlat, observație, rate limits, retenție, suport | Necesită aprobare **Go B2** explicită |

**Recomandare curentă:** pilot intern extins — încă 3–5 desene reprezentative înainte de testeri externi:

- desen simplu (siluetă clară)
- personaj cu detalii
- contururi slabe
- fundal încărcat
- (opțional) un al cincilea caz-limită din produs

Scopul este calitatea modelului și robustețea pipeline-ului, fără mărirea suprafeței publice și fără schimbări pe producție.

## Do not put in this doc or related PRs

- API keys, R2 access/secret keys, Tripo keys
- URL-uri R2 presemnate
- ID-uri de sesiune sau cookie-uri Vercel
- imagini cu date confidențiale de staging
