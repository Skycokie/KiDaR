# kidAR Studio

kidAR Studio is a self-serve WebAR builder for children's drawings. It turns
an uploaded drawing into a marker-based AR page, QR code, and print-ready A4
PDF.

## Repository layout

- `apps/web` — Next.js App Router marketing site, creator dashboard, studio,
  auth, API routes, and static AR page routes.
- `apps/worker` — Railway worker for the asynchronous publish pipeline.
- `packages/core` — shared types, quota/settings/slug logic, and AR template.
- `APPWRITE.md` — Appwrite Cloud Free console setup (database, buckets, auth).

## Local setup

1. Install Node 22+ and pnpm 10+.
2. Create the Appwrite resources listed in [`APPWRITE.md`](APPWRITE.md).
3. Copy `.env.example` to `.env.local` and `apps/web/.env.local`, then set
   `APPWRITE_API_KEY` and confirm the project ID.
4. Run `pnpm install`.
5. Run `pnpm dev`.

Auth uses Appwrite magic URL email. Local E2E signs in through
`/api/auth/e2e-session` with the API key (no Mailpit required).

## Commands

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm pipeline:demo
```

No paid AI service is required or called by default. The optional AI provider
is disabled unless an explicit API key is configured.
