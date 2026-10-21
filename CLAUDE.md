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
- `npm test` — vitest, 383 cases across 54 files
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

## Worldwide sun and rendering

The primary perspective is local Three.js geometry, not a generated photo.
Use demand frames: idle GPU must rest, camera presets must settle within
OrbitControls limits, and walking suspends preset interpolation. Fixed concept
photos stay in the labeled references section.

City search uses Open-Meteo / GeoNames; `PlanState.location` stores latitude,
longitude and IANA zone. Chart and perspective use SunCalc2 through
`src/location/solar.ts`, interpreted in the city's civil time. DST gaps advance
with an explanation and repeated hours use the first occurrence. Keep the
SunCalc BSD notice in `public/licenses/suncalc.txt`. Preserve chosen locations
through save/share/import, trace acceptance and layout changes.

Architectural presentation defaults to opaque cut faces and a true parallel
Axonometric camera; Top-Down is north up. Section cuts and drawing styles keep
the full building's shadow casters. The directional light updates its cached
shadow map only when physical geometry, sun direction or shadows change.
`src/study/` owns camera framing, bounded scene validation, previews and A4
study sheets. `PlanState.studyScenes` stores six views with camera, style,
city and civil date/time/year; JPEG previews stay in a separate device cache,
never in share hashes. Preserve scenes through layout and trace changes, and
label previews when their geometry differs. Print plan and wall section SVGs
in physical millimetres, at the same standard scale, alongside the actual
captured view and city sun chart. Roof vocabularies used by sanitizers belong
in pure `roofStyles.ts`, so validation cannot eagerly load Three.js.
Capture waits for the Three.js tree's committed day/hour/year, including cold
start, and uses an independent deadline even if animation frames are suspended.
Never substitute a frame-count delay for acknowledgement of requested sun inputs.

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
`wrangler.toml` (`TRACE_MODEL`, currently empty and disabled) and returns a
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

## Spatial rules (SHM)

**SHM — spatial hallucination.** An interface that invents a reason to
occupy space, instead of arranging things around how people read, choose and
act. The test: *why is this here, why this size, and why this far from
that?* If the answer is "the grid put it there", the layout has failed.
`docs/SPATIAL-AUDIT-2026-10-21.md` holds the full pass.

Three rules the studio now keeps, all gated by `e2e/spatial.spec.ts`:

- **Drop by decision, never crush.** When a bar runs out of room, something
  goes in a measured priority order and gets a way back — the More menu
  carries whatever the bar dropped. The top bar drops the area figure
  (≤1350px), the wordmark (≤1200px), the city (≤920px) and the project name
  and its save state (≤720px), in that order. Do not add a breakpoint that
  squeezes a row instead of dropping a thing. Dropping the name must not
  take the save state with it.
- **A cut must say so.** Text cut by an ancestor's `overflow: hidden` is a
  fragment ("Sh" for "Shanghai") and is a defect. Text cut by itself with
  `text-overflow: ellipsis` is a labelled truncation and is allowed. A
  sequence keeps its numbers: a done step adds a tick, it never replaces the
  number.
- **The menu repeats actions, not information.** The More menu repeats the
  city's and share's *actions* so that it is a complete list; it repeats the
  project name and the saved stamp only when the bar has dropped them.

The top bar is three parts and its geometry says so: **what you are looking
at** (brand, name, facts) on the left, **which view you are in** (Plan /
Spatial / Renders) alone in the centre, **what you can do** (undo, redo,
concept, More, panel, Share, Export) as one group at the right. Do not put a
control in the centre next to the mode switch, and do not split the actions
across the bar.

Two things that look like bugs and are not: the phone room key is a
deliberate scroller (`overflow-x: auto` + `scroll-snap`), and the two left
columns deliberately share one 56px rule grid. A deliberate scroller tells
the reader it scrolls; an accidental one hides a control.

## Conventions

- TypeScript stays strict; `tsc -b` is part of the build, not a separate chore.
- Domain calculations live outside components and change with a test.
- One accent per appearance: the Wada 243 theme's action colour
  (`--studio-sienna`), which is what `design/studio.css` ships — not the amber
  `#f59e0b` token that it overrides. Two font packages only — Source Sans 3 for
  body, JetBrains Mono for dimensions and numbers; Source Sans 3 for titles and
  commands. No third accent, no new font. The studio uses 22/16/12px roles,
  square surfaces, an external numbered room key, and controls outside the
  physical drawing viewport.
- The landing sheet at `/` is the one named exception: it carries the Bauhaus
  palette — red, blue and yellow on paper, ink black — scoped to that sheet and
  asserted absent from `:root`. The studio chrome keeps its own accent.
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
