# designon (Design + Non)

An architecture sketch tool built around one idea: you draw on a napkin, you
photograph it, and the system works out the walls, doors and windows. You give
it one real measurement, it calibrates the whole field to metres, and you carry
on from there. It is a decision tool, not a renderer — every number on screen
is meant to be argued with.

The product is **designon**. The repo, the Pages URL and the Cloudflare Worker
are all still `luma-house` for deployment inertia. Do not "fix" the mismatch.

## Build and run

- `npm install`
- `npm run dev` — Vite dev server on :5173
- `npm test` — vitest, 312 cases across 44 files
- `npm run lint` — ESLint
- `npm run build` — `tsc -b` then the production bundle
- `npm run preview` — serve the built bundle
- `npm run deploy:pages` — build then push to Cloudflare Pages

The worker has its own toolchain:

- `cd workers/concept-render && npx tsc --noEmit && npx vitest run`
- `npx wrangler deploy` — after any change to the AI trace

## Stack

Vite + React 18 + strict TypeScript. Tailwind foundation with the real design
tokens in `src/styles.css`. 3D is `@react-three/fiber` + `@react-three/drei` +
`three`, lazy-loaded so the 3D chunk does not block first paint. State is
React; persistence is `localStorage` plus a base64 URL-hash share link. There
is no backend other than the AI worker.

## The napkin vocabulary

One pencil, several meanings, resolved in `src/canvas/napkinStroke.ts`:

- a **line** is a wall
- four walls that close a loop become a **room**
- a short **tick** on a wall is a **door** (interior wall) or a **window** (exterior wall)
- a **box** in empty space is a room; a box **inside** a room is furniture

An opening's `x/y` is the point **on the wall**, and the full opening width has
to fit along it. This is load-bearing: `snapOpeningToWall` snaps to it,
`sunPatches` casts daylight from it, and the code check reads it. If you change
how an opening is positioned, change the renderer, not the data.

## Where things live

- `src/App.tsx` — the workspace: journey stages, view axis, inspector, trace flow
- `src/plan.ts` — domain data, solar position, BOQ
- `src/types.ts` — `PlanState` and friends
- `src/canvas/` — `FloorPlan`, `Spatial3D`, `napkinStroke`, `napkinScale`, `geometry`
- `src/analysis/` — sun, heat, wind, daylight, egress, air, walls, assemblies
- `src/concept/` — `tracePlan` (photo → plan), `reviewTrace` (calibration and
  issue detection), `renderQuota`
- `src/components/TraceReview.tsx` — the review gate before a draft is accepted
- `workers/concept-render/` — Cloudflare Worker calling Gemini vision

## AI trace

`POST /trace` on the worker sends the photo to the vision model configured in
`wrangler.toml` (`TRACE_MODEL`, currently `gemini-3.8-flash`) and returns a
plan draft. Three things you must not break:

- **The secret.** The worker needs `GEMINI_API_KEY`. Without it every AI call
  returns HTTP 500. Set it with `wrangler secret put GEMINI_API_KEY`.
- **The repair.** `workers/concept-render/src/repairTrace.ts` pulls rooms inside
  the drawing, trims overlaps, snaps openings onto walls and drops a room that
  sits entirely inside another. It reports what it changed in the note. Its
  tests are built from real live output — if you change it, re-derive them from
  a real run, not from imagination.
- **The gate.** A draft is never applied silently. The user must enter one
  known dimension, see the issues `traceIssues` found, and confirm they
  compared it against the photo.

A vision call takes 30–60s. `TRACE_TIMEOUT_MS` is the single source of truth for
the timeout and the UI copy.

## Conventions

- TypeScript stays strict; `tsc -b` is part of the build, not a separate chore.
- Domain calculations live outside components and change with a test.
- One accent: amber `#f59e0b`. Two font packages only — Source Sans 3 for body,
  JetBrains Mono for headings and labels. No third accent, no new font.
- Anything the model produced is labelled a draft. Anything approximate says so
  on screen. Do not present an estimate as a measurement.
- A feature ships with its test in the same commit.
- Screenshot-verified changes, not just green gates — several defects here
  passed tsc, lint and the full suite and were still wrong on screen.

## Deployment

Production https://designon.nonarkara.org/ is Cloudflare Pages project
`luma-house`, production branch `main`. Run `npm run deploy:pages` after
pushing: this direct-upload host does not follow Git pushes. GitHub Actions
updates only the https://nonarkara.github.io/luma-house/ mirror. Verify
the production custom domain after deploying; a green mirror job is insufficient.
The AI Worker deploys separately and is not automatic.
