# kidAR Studio

kidAR Studio is a self-serve WebAR builder for children's drawings. It turns
an uploaded drawing into a marker-based AR page, QR code, and print-ready A4
PDF.

## Repository layout

- `apps/web` — Next.js App Router marketing site, creator dashboard, studio,
  auth, API routes, and static AR page routes.
- `apps/worker` — Railway worker for the asynchronous publish pipeline.
- `packages/core` — shared types, quota/settings/slug logic, and AR template.
- `supabase` — local Supabase configuration, schema, RLS policies, and seeds.

## Local setup

1. Install Node 22+, pnpm 10+, and the Supabase CLI.
2. Copy `.env.example` to `.env.local` and provide local Supabase keys.
3. Run `pnpm install`.
4. Run `supabase start`.
5. Run `pnpm dev`.

The project is deliberately scaffolded milestone-by-milestone. M1 establishes
the monorepo, shared core, database schema/RLS, optional-provider boundary, and
CI. The worker's end-to-end demo pipeline is delivered in M4.

## Commands

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm pipeline:demo
```

No paid AI service is required or called by default. The optional AI provider
is disabled unless an explicit API key is configured.
