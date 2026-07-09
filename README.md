# Wedding Hub

A shared wedding-planning hub: budget scenarios, AI document extraction, a guest list with RSVP, and a visual invitation builder — all scoped per wedding with Supabase auth + RLS.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind v4
- **Supabase** — Postgres, Auth, Row-Level Security, Storage
- **Anthropic** (Claude) — extracts costs/packages/payments from uploaded quotes
- **Resend** — sends invitation emails (optional)
- Deployed on **Vercel**

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Runs at http://localhost:3000.

### Environment variables

See [.env.example](.env.example). Required: the two `NEXT_PUBLIC_SUPABASE_*` keys, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY`. `RESEND_API_KEY` + `INVITE_FROM_EMAIL` are optional (needed only for one-click invite emails).

### Database

Migrations live in [`supabase/migrations`](supabase/migrations). Apply them to a hosted project with:

```bash
npx supabase db push --db-url "postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
```

## Deploying to Vercel

1. Import the GitHub repo in Vercel (framework auto-detected as Next.js).
2. Add the environment variables from `.env.example` in **Project → Settings → Environment Variables**.
3. Deploy, then add your Vercel domain to Supabase **Auth → URL Configuration** (Site URL + redirect URLs).

## Public invite

Each guest gets a private link at `/i/<token>`; the couple edits the invitation visually at `/invite`.
