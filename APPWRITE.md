# Appwrite Cloud setup for kidAR Studio

## Environment roles (Free plan)

Appwrite Cloud Free allows **one organization** and **two projects**.

| Role | Project ID | Status |
| --- | --- | --- |
| **Development** (local creator flows + local E2E) | `6aaa61b4000e4035f26e` | Active — use this for `pnpm dev` and local Playwright |
| **CI / E2E (non-production)** | *(create with the second Free slot)* | Required before GitHub Actions E2E secrets are set |
| Production | *(not on this Free project)* | Do not point CI or local E2E at a future production project |

Console (development): https://appwrite.io/projects/6aaa61b4000e4035f26e

GitHub Actions `e2e` must use secrets for the **CI / E2E** project only, never for production.
Until that second project exists, leave `APPWRITE_API_KEY` unset in GitHub so the e2e job stays skipped.

## 1. Platform

In **Auth → Settings → Platforms**, add a Web platform:

- Hostname: `localhost`
- Also add your production hostname later

In **Auth → Settings**, enable **Email magic URL**.

Add redirect URL:

- `http://localhost:3000/auth/callback`

## 2. API key

Create an API key with scopes:

- `users.read`, `users.write`
- `sessions.write`
- `databases.read`, `databases.write`
- `collections.read`, `collections.write`
- `attributes.read`, `attributes.write`
- `indexes.read`, `indexes.write`
- `documents.read`, `documents.write`
- `files.read`, `files.write`
- `buckets.read`, `buckets.write`

Put the secret in `.env.local` as `APPWRITE_API_KEY` (never commit it).

## 3. Database `kidar`

Create database ID: `kidar`

### Collection `profiles`

Document ID = Appwrite user ID.

Attributes:

| Key | Type | Required | Default |
| --- | --- | --- | --- |
| `plan` | string (size 16) | yes | `free` |
| `stripe_customer_id` | string (size 128) | no | |

Permissions: document-level only (created by the app for the owner).

### Collection `projects`

Attributes:

| Key | Type | Required | Default |
| --- | --- | --- | --- |
| `owner` | string (36) | yes | |
| `name` | string (128) | yes | |
| `slug` | string (80) | yes | |
| `mode` | string (16) | yes | |
| `source_image_path` | string (64) | no | |
| `mind_path` | string (64) | no | |
| `glb_path` | string (64) | no | |
| `status` | string (32) | yes | `draft` |
| `settings` | string (10000) | yes | `{}` |

Indexes:

- unique index on `slug`
- key index on `owner`

### Collection `jobs`

Attributes:

| Key | Type | Required |
| --- | --- | --- |
| `project_id` | string (36) | yes |
| `step` | string (32) | yes |
| `status` | string (32) | yes |
| `payload` | string (5000) | no |
| `log` | string (10000) | no |

Index on `project_id`.

### Collection `scan_events` (reserved)

Attributes:

| Key | Type | Required |
| --- | --- | --- |
| `project_id` | string (36) | yes |
| `country` | string (8) | no |

## 4. Storage buckets

Free plan allows **1 bucket**. Use a single private bucket:

- ID `source-drawings` — max 25 MB, extensions `png,jpg,jpeg,glb,svg,mp3`, File Security enabled

Set both env vars to the same ID:

```env
APPWRITE_SOURCE_BUCKET=source-drawings
APPWRITE_ASSETS_BUCKET=source-drawings
```

## 5. Local env

```bash
cp .env.example .env.local
cp .env.example apps/web/.env.local
```

Use regional endpoint for this project:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
```

Fill `APPWRITE_API_KEY`, then run `pnpm dev`.
