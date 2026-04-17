# AI workflow

An honest account of how AI tooling was used to build Ajaia Docs, and — equally important — where I pushed back on it or overrode its suggestions.

## Tools used

- **Claude** (via the Claude desktop app, running in "Cowork mode" against a local sandbox) was the primary collaborator. It scaffolded the project, drafted most of the boilerplate, and ran its own TypeScript type checks to catch errors before handoff.
- **TypeScript compiler** (`tsc --noEmit`) was used continuously as a verification layer between AI-drafted code and committed code.
- No AI-authored code was committed without being reviewed and, in several places, rewritten.

## Where AI materially sped up the work

Roughly speaking, the productive wedges were:

1. **Scaffolding.** Setting up Next.js 14 with App Router, Tailwind, Prisma, and TipTap typically takes 30–60 minutes of following docs and fighting config files. AI generated the correct `package.json`, `prisma/schema.prisma`, `tsconfig.json` references, and `globals.css` in minutes, and flagged that the default `create-next-app` install shipped a vulnerable Next.js version we should pin above (14.2.33).
2. **Repetitive UI boilerplate.** Dashboard cards, empty states, toolbar buttons, modal chrome — these are shaped-the-same components. AI wrote them consistently and quickly. I adjusted spacing, Tailwind classes, and ARIA attributes afterward.
3. **Prisma schema drafting.** The three-table model (User / Document / DocumentShare) was close to right on the first pass. The only change I made was forcing `@@unique([documentId, userId])` so duplicate shares are a data-level impossibility instead of a runtime check.
4. **Test skeletons.** The Playwright test structure (`test.describe`, helper `login`, two flow tests + one negative test) was drafted quickly; I kept the structure, refined the assertions to match the real DOM, and added the "unauthorized direct URL access" case that the brief explicitly calls out.
5. **Markdown → TipTap conversion.** The `inlineToNodes` regex in the import route is tedious to get right. AI produced a reasonable first cut; I reviewed every branch against the TipTap schema and tightened several node types (e.g. ensuring headings cap at level 3 to match our editor config).

## Where AI output was changed or rejected

This is where human judgment mattered most.

1. **Rejected: "add NextAuth" scaffolding.** Early on, AI suggested pulling in NextAuth.js for auth. For three seeded users that would have been three orders of magnitude more surface area than needed. I overruled this and kept a hand-rolled JWT cookie (~80 lines total in `lib/auth.ts`). This alone probably saved 2+ hours and a lot of configuration risk.
2. **Rejected: optimistic updates everywhere.** AI proposed optimistic updates on the share modal and document creation. I kept them pessimistic — the server response is the source of truth and the round-trip is fast enough that a 150ms wait is not a UX problem. Less state, fewer bugs.
3. **Rewrote: access control.** The first draft checked ownership + shared access inline in each route handler. I consolidated this into two helper functions in `src/lib/access.ts` (`getDocumentForUser`, `assertCanAccessDocument`) so that **every** document read/write flows through the same check. This is a single-point-of-enforcement pattern that massively reduces the chance of a future access bug.
4. **Reduced: autosave complexity.** The first autosave implementation tried to queue every change with sequence numbers and merge them. For a single-user editor with last-write-wins semantics this was overbuilt. I stripped it down to: debounce + in-flight flag + pending-save flag. Three primitives instead of a queue.
5. **Tightened: input validation.** AI's API routes initially trusted request bodies. I added `zod` schemas for every input (`lib/validate.ts`) so that runtime validation and TypeScript types come from a single source.
6. **Pushed back on: CSS ambition.** Draft UI leaned into custom animations and gradients. I pulled it back to a quieter, reviewer-friendly flat design — fast to scan, minimal visual noise, and no bespoke CSS that could break under dark mode or high-zoom.

## How correctness and quality were verified

Several verification layers, in order of catches:

1. **`tsc --noEmit` on every code change.** TypeScript caught several propertly-named-but-wrong-shape objects early. Final pass was clean.
2. **Careful code review of access checks.** Every handler in `/api/documents/**` was read line-by-line to confirm it either calls a helper in `lib/access.ts` or explicitly checks ownership. No direct `prisma.document.findUnique` calls in route handlers.
3. **Playwright e2e tests** cover the full "login → create → edit → refresh persists" flow, the share flow across user contexts, and the access-denied flow for a third user trying to open a URL directly. These tests are the closest thing to a reviewer running the app themselves.
4. **Schema validation.** Both API inputs (`zod`) and DB writes (Prisma's typed client + the schema's `@@unique` constraint) are validated at multiple layers. A duplicate share cannot be inserted even if the UI misbehaves.

## Sandbox limitation and how it was handled

This project was drafted in Anthropic's Cowork sandbox, which has restricted outbound network access. Specifically, Prisma's binary engine CDN (`binaries.prisma.sh`) returns 403 behind the sandbox's HTTP proxy. This meant that `prisma generate`, `prisma db push`, and `prisma db execute` could not run in the sandbox itself.

I handled this honestly:

- All Prisma code was authored carefully with full types. A minimal hand-written `.prisma/client` type stub was placed in `node_modules/` inside the sandbox only, so that `tsc --noEmit` could validate my code against the Prisma API surface. This stub is **not** shipped — when a reviewer runs `npm install` on their machine, Prisma generates the real client.
- The `Playwright` test suite is designed to run on a reviewer's machine, where it boots the full dev server and exercises the real Prisma client end-to-end. There's no "sandbox-only" code path.
- `tsc --noEmit` was clean on the final draft; `npm run build` was left for the reviewer (or for CI) to run where Prisma's CDN is reachable.

This was an unusually transparent case of "AI tooling couldn't verify at runtime, so I compensated with stronger static checks and end-to-end test design." The test file (`tests/e2e.spec.ts`) is the actual source of truth for "does it work?" and will execute against a real server on the reviewer's machine.

## A clear statement

Judgment calls — what to build, what not to build, which AI suggestions to accept, how to trade off speed vs. robustness, and when to stop — were mine. AI was a very fast junior collaborator for the mechanical parts of building. The product decisions, the access-control design, the scope cuts, and the verification strategy are manual.

If I did this project again with the same budget, I would lean on AI harder for scaffolding and boilerplate (worth every minute) and just as hard for code review prompts ("find the nearest concurrency bug in this autosave flow"). I would lean on it *less* for architectural questions — AI tends toward over-building, and this was a brief that rewarded discipline.
