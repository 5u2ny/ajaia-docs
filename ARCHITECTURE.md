# Architecture

A short, sharp note on how Ajaia Docs is put together and why.

## Philosophy: build a coherent slice, not a broad surface

The brief explicitly warns against spreading effort thin. Every decision here is in service of **one tight vertical slice that works end-to-end** — rather than a broad feature set that is half-finished.

The five core flows (login → dashboard → create → edit/save → share) are all shipped, all validated, all covered by a test. Everything else (real-time, comments, version history, `.docx` import, complex permissions) was explicitly dropped.

## Stack choice: Next.js App Router + Prisma + SQLite → Postgres

**One codebase, one framework.** Next.js App Router gives us frontend + API in the same repo, same deploy, same type-safe boundary. That's a massive win under a 4–6 hour budget — no second service to configure, no CORS, no separate deploy pipeline. Vercel deploys it with zero config.

**TipTap** was chosen over Slate / Lexical / Draft for one reason: it serializes to JSON out of the box, which maps perfectly onto a `TEXT` column. No HTML sanitization, no custom serialization layer, no surprises on reload.

**Prisma over raw SQL** because the scope has just enough relational structure (User → Document → Share) that the boilerplate adds up fast. Prisma generates typed clients, handles migrations via `db push`, and has first-class Postgres/SQLite compatibility via `datasource.provider`. This lets us develop locally against SQLite and deploy against Neon Postgres with **one line changed** in the schema.

**SQLite locally, Postgres in prod.** SQLite means zero setup — reviewers can clone, `npm install`, `npm run db:reset`, `npm run dev`, and they're in. No Docker, no local Postgres, no environment dance. Production uses Neon because Vercel's serverless functions can't keep long-lived SQLite connections and need a network-backed DB.

## Authentication: seeded users + stateless JWT cookie

**Seeded users only.** The brief is explicit: no signup flow. Three demo users are enough to exercise owner vs. collaborator vs. stranger access. A real app would have OAuth or magic links; here it would have been wasted time.

**Session JWT in an HttpOnly cookie.** Signed with `jose` (edge-runtime-compatible), verified in middleware, 7-day expiry. No server-side session table — 3 users do not justify one. `SameSite=Lax` and `Secure` in production mitigate the typical cookie-based attacks.

**Bcrypt for password hashing**, even though these are seeded. Cost factor 10 is fine for the scope and keeps the code honest — if we later add signup, nothing changes about the authentication path.

## Sharing and access control

**One rule, enforced everywhere:** a user can read/write a document iff they own it OR a `DocumentShare` row exists linking them to the document. This rule is implemented once in `src/lib/access.ts` as two functions — `getDocumentForUser` and `assertCanAccessDocument` — and **every document fetch and every document mutation routes through one of them.** Routes never query the `Document` table directly. This is the single-point-of-enforcement pattern and makes access bugs much harder to introduce.

The API layer maps the errors (`NotFoundError`, `ForbiddenError`) to HTTP 404 and 403. The editor page maps them to `notFound()` and `/unauthorized`. No UI affordance leaks the existence of documents the user can't read.

Share creation validates:
- Only the owner can share.
- Can't share with yourself.
- Target user must exist (we don't invite by email).
- Duplicate shares upsert idempotently.

## Persistence: TipTap JSON as text, plus a preview snippet

TipTap emits a JSON tree on every change. SQLite has no JSON type (Postgres does, but we want schema parity), so we store it as `TEXT` and parse on read. On every save we also extract a plain-text preview (up to 300 chars) via a small recursive walker in `lib/utils.ts`; the dashboard reads this column directly so rendering a card doesn't need to parse a JSON tree.

Autosave is **debounced at 1 second** — chosen as a balance between network chatter and the user's sense that their work is being kept. The save indicator cycles through `idle → saving → saved` so the user has visible confirmation. Errors automatically retry after 3 seconds. Overlapping saves are serialized via an in-flight flag + pending-save flag, preventing a race where an older response overwrites a newer one.

## File import: `.txt` and `.md`, server-side

**Why only `.txt` and `.md`?** The brief suggests these as the "best choice for time and clarity." `.docx` would require `mammoth.js`, which has its own parsing quirks and would likely burn 1–2 hours on formatting edge cases for marginal user value.

The import flow is server-side (`POST /api/documents/import`) because (a) we want the validation (size, type, empty) enforced at the API boundary, and (b) we want to write a consistent TipTap JSON tree regardless of input format.

- `.txt` → each non-empty line becomes a paragraph.
- `.md` → lexed via `marked` into tokens, then a small mapper converts headings, paragraphs, bullet/ordered lists, blockquotes, code blocks, and inline bold/italic/strike/code into TipTap nodes. Anything we don't recognize falls back to plain text so no input can 500 the endpoint.

## What was intentionally excluded

| Excluded | Why |
| --- | --- |
| Real-time multiplayer (Yjs / CRDTs) | Hours of plumbing for one slice of demo value. Last-write-wins is acceptable within scope. |
| Comments, version history, track changes | Not in the minimum bar. Each would cascade into their own UI, data model, and tests. |
| Complex permissions (view-only, comment-only) | Single-tier edit access is enough to demonstrate the sharing model. Schema already stores `permission` as a string so adding tiers later is additive. |
| `.docx` support | 1–2 hour rabbit hole for formatting edge cases. Text and Markdown cover the user story. |
| Server-side session store | JWTs are stateless and the demo never needs forced logout. Easy to add later behind the same cookie. |
| Full OAuth / signup | Seeded users is the brief's recommended path. |

## Tradeoffs made

- **Autosave reliability vs. simplicity.** We retry on failure but do not queue edits locally. If the user is offline for >30s and closes the tab, they will lose those edits. For the assignment's demo-on-localhost scope this is acceptable; a production app would persist pending edits to `localStorage` or IndexedDB.
- **`contentJson` stored as `TEXT` vs. `JSONB`.** Postgres has native JSON; SQLite doesn't. We traded off query-time JSON operations for cross-database portability. The app never needs to query *inside* the JSON — only read and write it — so this is a clean tradeoff.
- **No optimistic updates on share modal.** When you add a collaborator, the UI waits for the server response. Faster feedback is possible but error handling becomes more complex; not worth the cost here.
- **Middleware re-verifies the JWT on every page load.** `jose` verification is fast (synchronous crypto) so this is fine. A more optimized approach would pre-decode on first-hit and cache.

## If I had another 2–4 hours

1. **Owner-only delete button** — API already exists, just needs a confirm dialog and UI.
2. **Export to `.md`** — the reverse of import; low effort, completes the round-trip story.
3. **"Remove me"** — let a shared-with user hide docs they don't want.
4. **"Last edited by" attribution** — track an `updatedById` column, show "edited by Maya 3m ago."
5. **Server-side search** — full-text search against `plainTextPreview` and `title` with an input on the dashboard.
6. **Rate limiting on auth** — a tiny in-memory token bucket or `Upstash Ratelimit` to prevent brute force.
7. **Unit tests for `access.ts`** — isolated integration tests against an in-memory SQLite, faster than the full Playwright suite.

Longer term, the architecture naturally extends: CRDT-based real-time collab would slot in as a TipTap extension + a per-doc socket server (e.g. Liveblocks, Hocuspocus); the access-control layer already tracks who can connect.
