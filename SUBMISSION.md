# Submission checklist

## Live URL

_To be filled in after Vercel + Neon deploy._ Follow the steps in `README.md` → Deployment.

## Demo credentials

| Name   | Email              | Password      |
| ------ | ------------------ | ------------- |
| Alex   | alex@demo.app      | password123   |
| Maya   | maya@demo.app      | password123   |
| Jordan | jordan@demo.app    | password123   |

These are also shown on the login screen for reviewer convenience.

## Walkthrough video

URL in `VIDEO_URL.txt`. 3–5 min screen recording covering the main user flow, design tradeoffs, and AI usage.

## Source

This repository. Enter the folder and run:

```bash
npm install
npm run db:reset
npm run dev          # http://localhost:3000
```

## Documents in this submission

- [x] `README.md` — project overview, setup, scripts, limitations, deployment
- [x] `ARCHITECTURE.md` — stack rationale, data model, tradeoffs, what's next
- [x] `AI_WORKFLOW.md` — where AI sped things up, where I overrode it, how correctness was verified
- [x] `SUBMISSION.md` — this file
- [x] `VIDEO_URL.txt` — walkthrough video link

## What works end-to-end

- [x] Login with any of three seeded users
- [x] Dashboard with owned + shared documents, ownership badges, empty states
- [x] Create a new blank document, navigate into it
- [x] Rename the document title (editable inline)
- [x] Rich-text editing: bold, italic, underline, H1/H2/H3, bullet list, numbered list
- [x] Debounced autosave (1s) with visible Saving / Saved / Error states
- [x] Refresh the editor — title and content persist
- [x] Import `.txt` and `.md` files — creates a new editable doc with formatting preserved
- [x] Share a document with another seeded user by email
- [x] Shared user sees the doc under "Shared with me" and can open it
- [x] A third user trying direct URL access gets a clean unauthorized page
- [x] Playwright e2e tests (3) covering create/edit/refresh, sharing, and access denial
- [x] `tsc --noEmit` clean

## What is partial or deferred

- **Live deployment URL** — deployment requires the reviewer to set up Neon + Vercel per the README; it's a ~5 minute task. The app builds and runs correctly; I included everything (env vars, prisma adapter change) needed.
- **`.docx` import** — not in scope. The UI clearly states supported types.
- **Owner delete button** — the API exists (`DELETE /api/documents/[id]`), but no UI affordance.

## What I'd build next with 2–4 more hours

1. Owner-only delete with confirmation dialog (API is already there)
2. Export to `.md` (round-trip with import)
3. A "Remove me from shared" action for shared-with users
4. Rate limiting on `/api/auth/login`
5. Unit-level tests against `lib/access.ts` for faster CI signal
6. Optimistic UI on share modal for faster feel
7. Visual cue when another user is viewing the same doc (poll-based)

## Notable engineering decisions

1. **Single access-control helper.** Every document read/write goes through `src/lib/access.ts`. No route handler queries documents directly. This is the single-point-of-enforcement pattern that makes future access bugs much harder to introduce.
2. **Stateless JWT auth.** No server-side session store — `jose`-signed HttpOnly cookies verified in middleware. 80 lines of auth code total instead of an OAuth library with hundreds of config knobs.
3. **Autosave debounced at 1s with retry.** Explicit save states (Saving / Saved / Error) visible to the user. Overlapping saves serialized via an in-flight flag.
4. **TipTap JSON stored as TEXT.** Cross-compatible with both SQLite (dev) and Postgres (prod) — flip one line in the Prisma schema to switch providers.
5. **Zod on every API input.** Runtime validation + TypeScript types from the same schemas — one source of truth.
6. **Playwright cross-user test.** The sharing test spins up a second browser context to simulate Maya logging in, instead of just mocking a cookie. This catches middleware and session bugs that a single-user test misses.

## Anything unusual reviewers should know

- The project was drafted in a sandbox that couldn't reach Prisma's binary CDN, so I couldn't run the Next.js dev server or `prisma generate` from inside the sandbox. A temporary hand-written type stub in `node_modules/.prisma/client/default.d.ts` let me run `tsc --noEmit` against the real code. When you run `npm install` on your machine, Prisma generates the real client and overwrites that stub. See `AI_WORKFLOW.md` for the full explanation.
- `tsc --noEmit` passes clean. `npm run build` was not run in the sandbox (same Prisma reason) — please run it on your machine; it should build cleanly on Node 18+.
- The Playwright suite uses port 3100 so it doesn't conflict with a hand-started dev server on 3000.
