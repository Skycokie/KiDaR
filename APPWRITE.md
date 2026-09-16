# Appwrite Cloud setup for kidAR Studio

Authoritative guide for reproducible Development / CI-E2E / future Production
Appwrite environments. Supabase is historical only and must not be reintroduced.

## Environment roles

Appwrite Cloud Free allows **one organization** and **two projects**.

| Role | Project ID | Status |
| --- | --- | --- |
| **Development** | `6aaa61b4000e4035f26e` | Active — local `pnpm dev` and local Playwright |
| **CI / E2E** | *(second Free project slot — owner creates)* | Dedicated non-production project for GitHub Actions only |
| **Production** | *(owner designates before public launch)* | Must not be assumed to exist today; never used by CI |

Console (Development): https://cloud.appwrite.io/console/project-fra-6aaa61b4000e4035f26e

After the CI/E2E project exists, GitHub Actions must use only `APPWRITE_E2E_*`
secrets for that project. Until those secrets exist, the `e2e` job **skips**.
Do not point CI at Development or Production credentials.

## Setup order

1. **One-time Console bootstrap** (SDK cannot do these safely for a new project):
   - Create the Appwrite project (Development or CI/E2E).
   - Add a Web platform hostname (`localhost` for local; CI hostnames as needed).
   - Enable **Email magic URL** auth and allow redirect
     `http://localhost:3000/auth/callback` (plus production callback later).
   - Create an API key with the scopes below.
2. Copy `.env.example` → `.env.local` and `apps/web/.env.local`. Fill non-secret
   IDs and set `APPWRITE_API_KEY` locally (never commit it).
3. Run `pnpm appwrite:setup` to create/verify database, collections, attributes,
   indexes, and the private studio bucket.
4. Run `pnpm appwrite:verify` (read-only), then `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, `pnpm build`.

## Manual Console bootstrap (required)

These remain Console-only because they are project identity / auth / secret
bootstrap steps outside the Server SDK path used by kidAR Studio:

| Item | Why Console remains required |
| --- | --- |
| Create project | Organization/project provisioning is a Console (or org-admin) action |
| Web platform hostname | Auth platform allowlist is Console configuration |
| Enable magic URL + redirect URLs | Auth method and redirect allowlist are Console settings |
| Create API key + scopes | First key must be minted in Console; never commit the secret |

`pnpm appwrite:setup` automates everything else listed under **Automated resources**.

## API key scopes

### Runtime (app + local/CI E2E)

The web app uses the **legacy Databases document API** (`Databases` /
`databases.*Document` via `node-appwrite@29`) against the legacy `kidar`
database. Verified in E2E:

- Console **Allow all** may grant newer `documentsdb.*` labels but **does not**
  necessarily grant legacy `documents.read` / `documents.write`.
- Without those legacy scopes, document calls return unauthorized even when
  `documentsdb.*` appears enabled.

Minimum runtime scopes:

- `users.read`, `users.write`
- `sessions.write`
- `documents.read`, `documents.write` ← **required for legacy `kidar`**
- `files.read`, `files.write`

### Setup script (`pnpm appwrite:setup`)

Additionally required to create/verify schema:

- `databases.read`, `databases.write`
- `collections.read`, `collections.write`
- `attributes.read`, `attributes.write`
- `indexes.read`, `indexes.write`
- `buckets.read`, `buckets.write`

Do not rely solely on “Allow all” or `documentsdb.*` for this project’s
legacy database.

## Automated resources (`pnpm appwrite:setup`)

Safe to re-run. Does **not** delete documents, attributes, or files. Creates
missing resources and aligns collection/bucket permission flags when needed.

### Database

- ID: `kidar` (override with `APPWRITE_DATABASE_ID`)
- Type: **legacy** document database (existing Development project)

### Collections

Document security is **enabled**. Collection-level permission is only
`create("users")` so signed-in creators can insert rows. Each document gets
owner `read` / `update` / `delete` from application code
(`Permission.*` + `Role.user(ownerId)`).

#### `profiles`

| Key | Type | Required |
| --- | --- | --- |
| `plan` | string (16) | yes |
| `stripe_customer_id` | string (128) | no |

Document ID = Appwrite user ID.

#### `projects`

| Key | Type | Required |
| --- | --- | --- |
| `owner` | string (36) | yes |
| `name` | string (128) | yes |
| `slug` | string (80) | yes |
| `mode` | string (16) | yes |
| `source_image_path` | string (64) | no |
| `mind_path` | string (64) | no |
| `glb_path` | string (64) | no |
| `status` | string (32) | yes |
| `settings` | string (10000) | yes |

Indexes: unique `slug_unique` on `slug`; key `owner_idx` on `owner`.

#### `jobs`

| Key | Type | Required |
| --- | --- | --- |
| `project_id` | string (36) | yes |
| `step` | string (32) | yes |
| `status` | string (32) | yes |
| `payload` | string (5000) | no |
| `log` | string (10000) | no |

Index: key `project_id_idx` on `project_id`.

#### Not created

- `scan_events` — reserved for M4 analytics; do not provision in this setup.

### Storage

Free plan allows **one** bucket. Use a single private bucket for source drawings
and studio assets:

- ID `source-drawings` (override with `APPWRITE_SOURCE_BUCKET` /
  `APPWRITE_ASSETS_BUCKET`; keep them equal on Free)
- `fileSecurity: true`
- Bucket permission: `create("users")`
- Max size 25 MB; extensions `png,jpg,jpeg,glb,svg,mp3`
- File permissions set by the app for the owning user

## Environment variables

Placeholders only — never commit real keys.

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=6aaa61b4000e4035f26e
APPWRITE_API_KEY=

APPWRITE_DATABASE_ID=kidar
APPWRITE_PROFILES_COLLECTION=profiles
APPWRITE_PROJECTS_COLLECTION=projects
APPWRITE_JOBS_COLLECTION=jobs
APPWRITE_SOURCE_BUCKET=source-drawings
APPWRITE_ASSETS_BUCKET=source-drawings

# E2E-only (CI or intentional production smoke of e2e-session)
ALLOW_E2E_AUTH=
```

`APPWRITE_SCAN_EVENTS_COLLECTION` may appear in code defaults for a future M4
collection; setup does not create it.

## GitHub Actions secrets (CI / E2E project only)

After the owner creates the dedicated CI/E2E Appwrite project, configure:

| Secret | Maps to runtime env |
| --- | --- |
| `APPWRITE_E2E_ENDPOINT` | `NEXT_PUBLIC_APPWRITE_ENDPOINT` |
| `APPWRITE_E2E_PROJECT_ID` | `NEXT_PUBLIC_APPWRITE_PROJECT_ID` |
| `APPWRITE_E2E_API_KEY` | `APPWRITE_API_KEY` |

Optional overrides (only if the CI project uses non-default IDs):

- `APPWRITE_E2E_DATABASE_ID`
- `APPWRITE_E2E_PROFILES_COLLECTION`
- `APPWRITE_E2E_PROJECTS_COLLECTION`
- `APPWRITE_E2E_JOBS_COLLECTION`
- `APPWRITE_E2E_SOURCE_BUCKET`
- `APPWRITE_E2E_ASSETS_BUCKET`

If `APPWRITE_E2E_API_KEY` is unset, the `e2e` job skips. CI must never fall
back to Development or Production keys.

## Commands

```bash
pnpm appwrite:setup          # idempotent create/verify
pnpm appwrite:verify         # read-only check
pnpm appwrite:setup -- --dry-run
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm start                   # production Next.js server after build
```

## Historical note: Supabase

Supabase is **not** an active runtime dependency. Any remaining `supabase/`
artifacts or obsolete migration docs are historical only. Do not run Supabase
setup commands as part of current onboarding.
