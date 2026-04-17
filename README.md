# Ajaia Docs

A lightweight collaborative document editor built for the Ajaia take-home assessment.

Three seeded demo users can create, edit, import, and share rich-text documents. The UI is a familiar Google-Docs-style editor powered by TipTap; persistence is handled by Prisma over Postgres (Neon in production, local Postgres or a Neon dev branch for development). Sharing and access control are enforced end-to-end, and the whole flow is covered by Playwright e2e tests.

## Live demo

URL is listed in `SUBMISSION.md` once deployed. Demo credentials below work on the live site too.

## Demo credentials

| Name   | Email              | Password      |
| ------ | ------------------ | ------------- |
| Alex   | alex@demo.app      | password123   |
| Maya   | maya@demo.app      | password123   |
| Jordan | jordan@demo.app    | password123   |

## Features implemented

- Email/password login with three seeded users (no signup flow — by design)
- Dashboard with "Your documents" and "Shared with me" sections
- Create a new blank document
- Rich-text editing with TipTap: **bold**, *italic*, <u>underline</u>, H1/H2/H3, bullet lists, numbered lists
- Editable document title
- Debounced autosave (1s) with explicit Saving / Saved / Error states
- Import .txt and .md files into new editable documents
- Share a document with another seeded user by email (edit access)
- Ownership vs. shared visual distinction (badges on dashboard and editor)
- Access control enforced on every document fetch and mutation (server-side)
- Clean unauthorized page for non-owner, non-collaborator URL access
- Playwright e2e tests covering login, edit, refresh, sharing, and access control

## Supported file types

`.txt`, `.md`, `.markdown` — up to 1 MB. Unsupported types are rejected with a clear error message.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **lucide-react** icons
- **TipTap** for rich text editing (starter-kit + underline extension)
- **Prisma 5** ORM
- **Postgres** (Neon in production, local Postgres or a Neon dev branch for development)
- **jose** for stateless session JWTs, **bcryptjs** for password hashing
- **Zod** for runtime input validation
- **Playwright** for e2e tests

## Local setup

Requires **Node 18+** (tested on 22).

```bash
# 1. Install dependencies (this also runs `prisma generate`)
npm install

# 2. Create the database schema and seed 3 demo users
npm run db:reset

# 3. Start the dev server on http://localhost:3000
npm run dev
```

Then open http://localhost:3000 and sign in with any of the demo credentials.

### Environment variables

Copy `.env.example` to `.env` and set:

| Variable         | Local dev value                                  | Production value                                     |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `DATABASE_URL`   | Postgres URL (local or Neon dev branch)          | Neon Postgres pooled URL (`postgresql://…`)          |
| `SESSION_SECRET` | any ≥32 char random string                       | 32+ char random string (e.g. `openssl rand -hex 32`) |
| `NODE_ENV`       | `development`                                    | `production`                                         |

The fastest way to get a dev database is to create a free Neon project and copy its pooled connection string into `.env`. Then run `npm install && npx prisma db push && npx prisma db seed && npm run dev`.

### Useful scripts

```bash
npm run dev         # start the Next.js dev server (port 3000)
npm run build       # production build
npm run start       # start the production build
npm run lint        # Next/ESLint
npm run db:push     # apply prisma schema to DB
npm run db:seed     # re-seed the three demo users
npm run db:reset    # wipe DB and re-seed (destructive — dev only)
npm test            # run Playwright e2e tests
npm run test:ui     # run Playwright in UI mode for debugging
```

### Running tests

Playwright needs its browsers downloaded once:

```bash
npx playwright install chromium
```

Then:

```bash
npm test
```

The test runner boots its own Next.js server on port 3100 and resets the DB before running.

## Project structure

```
src/
  app/
    login/               # public login screen + client form
    dashboard/           # server component: lists owned + shared docs
    documents/[id]/      # server component: loads doc, renders editor
    unauthorized/        # friendly 403 page
    api/
      auth/              # login, logout, me
      documents/         # CRUD + import + share
    layout.tsx
    page.tsx             # redirects to /dashboard
    globals.css
  components/            # all client components (editor, modal, etc.)
  lib/
    prisma.ts            # Prisma client singleton
    auth.ts              # JWT session + bcrypt
    access.ts            # document access-control helpers
    validate.ts          # zod input schemas
    utils.ts             # cn(), timeAgo(), extractPlainText()
  middleware.ts          # route protection
prisma/
  schema.prisma          # 3-table schema: User, Document, DocumentShare
  seed.ts                # seeds three demo users
tests/
  e2e.spec.ts            # Playwright covering all happy paths + access denial
```

## Deployment (Vercel + Neon)

1. Create a free [Neon](https://neon.tech) Postgres DB and copy the connection string.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. Commit the change and push the repo to GitHub.
4. Import the repo into Vercel. Set two environment variables:
   - `DATABASE_URL` = Neon connection string (with `?sslmode=require`)
   - `SESSION_SECRET` = a fresh 32+ char random string
5. Vercel auto-runs `npm run build`. After the first deploy, run
   `npx prisma db push && npx prisma db execute --file ./prisma/seed.ts`
   locally against the Neon URL, or trigger `npm run db:reset` from Vercel's CLI,
   to seed the demo users in production.

See `ARCHITECTURE.md` for deployment trade-offs.

## Known limitations

- **No real-time multiplayer** — two tabs editing the same doc will last-write-wins. Real-time was explicitly out of scope (see `ARCHITECTURE.md`).
- **One permission tier** — shared users get edit access. No read-only or comment-only role. Modeled as a column so adding tiers later is a one-file change.
- **No signup** — by design. Three seeded users only.
- **No delete from UI** — `DELETE /api/documents/[id]` exists (owner-only) but no button. Easy add.
- **No `.docx` import** — would require pulling in `mammoth.js` and handling formatting edge cases; out of scope for the 4–6 hour budget.

## What I'd build next with 2–4 more hours

1. Owner-only delete button with confirmation, because the API is already there.
2. "Remove me from shared" for non-owners so they can hide docs they don't want.
3. A "Copy share link" button (after adding a public / unlisted permission).
4. Server-side session invalidation list (for "sign out everywhere").
5. Visual cue when another user is viewing the same doc (poll-based, not real-time).
6. Export to `.md` — the reverse of the import flow.
7. Additional Playwright tests for import file validation (oversize, wrong type).

See `ARCHITECTURE.md` and `AI_WORKFLOW.md` for more detail.
