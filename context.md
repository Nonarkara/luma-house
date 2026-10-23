## Dense properties correction — 2026-10-23

The owner rejected the previous “compact” preview: stacked labels, full-width
numeric boxes, 44px fields and large group gaps still consumed space without a
task reason. Apply MSH's dense-group32px rule explicitly; this supersedes the
previous phone44px input choice. Reference: a CAD properties schedule, aligned
label/value rows. Numeric inputs fit6digits, Name gets22characters, inspector300px,
8px outer padding, 4px within a room group. Keep existing14/12px type, every
control, metric, standards reference and drawing. Calibration follows the primary
room fields, and remains expandable. Verify actual bounds at390/1024/1440 in all
palettes, expanded/error/focus states, and compare the same phone geometry with
runtime031a3e2. Obtain fresh visual review, then commit/push/gated deploy/live checks.

## Measurement and compact properties audit — 2026-10-23

Scope: verify MiniMax's SpacePlanner port, preserve user-stated metres through
calibration/save/share, mark scaled axis fields with ~, and refuse impossible
scale changes atomically. Existing geometry resized by hand returns to scaled
status. Legacy files remain scaled. No new APIs or borrowed code.

Design Read: user screenshot shows excessive framing and duplicate calibration
explanations in the phone inspector. Use a compact technical property sheet:
48px header, paired field inputs, one disclosure for calibration from a known
length, short labels, 12px section spacing. Existing palette and type tokens;
44px touch targets on phones. Preserve all controls and help, including upload,
AI, room properties and calibration. Verify 1440/1024/390 across all four themes.

## Bauhaus landing sheet — 2026-10-20

Design Read: the entry guide became a poster. Reference: Bauhaus primary-colour
discipline — red, blue and yellow on a paper ground with ink black, flat colour
fields, no ornament, geometric sans set tight and uppercase, and a grid that is
deliberately asymmetric. The three primaries are not decoration; each does one
job. Red is your mark (the pencil, the drawn room, the primary action). Blue is
the measure (the plan, the floor plinth, the calibrated field). Yellow is the
light (the sun, the daylight patch). The fit-out step is neutral. Ink carries
structure, type and rules; paper carries the ground. The drawing is a sheet,
not a picture: a bordered frame with registration ticks and its own title line,
so it grows with the page and the caption sits on the sheet. Under it a
horizontal title block prints the sample's own computed figures, never typed in
by hand. The four steps sit on an ink band as number plates in red, blue, paper
and yellow. Register: poster and technical drawing sheet at once; existing
Source Sans 3 / JetBrains Mono; the studio's own palette is untouched.

Authorized scope: restyle the entry guide to the Bauhaus palette and grid;
keep the guide's route semantics, keyboard behaviour, print support and all
existing tests. The palette is scoped to the landing sheet only and is asserted
absent from `:root`, while the studio keeps its own single accent — the rule is
now enforced by a test, not by intention. No new fonts, graphics libraries,
generated photos or APIs.

## Illustrated entry guide — 2026-10-19

Design Read: a fold-out home-design instruction sheet explains the real tool
sequence at a glance before opening the drawing desk. Reference: IKEA KALLAX
assembly booklet AA-2326605-1, numbered actions, exploded line drawings and
assembly leaders; original illustrations, no copied IKEA artwork or branding.
The dominant element is one cutaway house and its plan, with four short tool
instructions and a clear entry action. Thick building outlines, thin furniture
details and dashed placement leaders serve different roles. Register:
Institutional instruction sheet, existing Source Sans 3 / JetBrains Mono,
paper and ink with the existing logo's yellow light as the sole guide accent.
This named accent exception explains sunlight in the guide; workspace palettes
remain unchanged. No new fonts, graphics libraries, generated photos or APIs.

Authorized scope: expand WelcomeGate into a full-screen printable guide; add
an original SVG house/plan diagram and scoped guide CSS; add explicit guide /
studio entry URLs and a reopen action in More. Existing drawings, shared-plan
arrival, Undo and the full workspace remain intact. Returning users can resume
without creating a new drawing. Root opens the guide; ?studio=1 enters the desk;
shared plans bypass the guide. Validate keyboard/focus, saved/shared entries,
four palettes, one landscape view at1440/1024, phone flow at390 and printed A4.
Save real screenshots and obtain independent visual review before CPDT.

## Drawing-sheet audit plan — 2026-10-18

Design Read: a room name must occupy visible paper belonging to that room,
and every room must remain identifiable in a wrapped drawing key on the printed
sheet. Reference: AIA Architectural Graphic Standards drawing keys and separate
annotation margins. The drawing stays dominant; preserve the existing line-weight
roles, workspace palettes, and controls. Audit actual font ink, occlusion, keys,
and A4 output at 1440/1024/390px with an independent review. Correct measured
defects without replacing the interactive model or changing saved drawings.

Shipped as `2369499` (audit fix `d72914a`), Cloudflare upload `bb0b4e67`.
CI `39148190535` passes 539 frontend +54 Worker +158 browser cases (5.6m),
lint/type/build/quota and dependency gates. Primary live30 and mirror subpath
live14 cases pass. All44 files match three consecutive probes on canonical,
custom and mirror hosts; primary CSP matches. Actual font ink/SAT occlusion,
visibility-checked marks, wrapped keys/notes, A4 sizing and compact phone zoom
controls are independently screenshot/PDF reviewed at1440/1024/390px. Morph
uses effective dimensions with exact endpoint entities and correct identity
switches/counts. Fresh city defaults, legacy JSON cities and explicitly loaded
samples now survive sharing/reload. Three verified shared lessons captured.
Seven dev-only Tailwind advisories remain; production dependencies have zero.
See `docs/SHEET-AUDIT-2026-10-18.md` for evidence and concept-drawing limits.

## Furniture/layout audit — 2026-10-15

Production-policy correction: the initial 124-case CI pass missed real GLB
failure because Vite preview did not enforce Cloudflare's CSP. A live GPU check
found WASM compilation and embedded texture blob fetches blocked. The policy
adds only WASM compilation and blob connection permissions, preserving blocked
JavaScript string execution/inline scripts and the existing host allowlist.
Preview now reads exact production headers. Actual mesh/shadow cases pass with
zero CSP violations, and an ordinary same-origin script proves Function blocked
and WASM allowed on desktop/phone. The full browser gate now has 126 cases.
Initial 705f3a5 upload is superseded by this repair; require live GPU verification.

Design Read: choosing a comparison reveals the actual view in the existing
workspace. Reference: designon's measured architectural sheets and AIA Graphic
Standards hierarchy. Keep the dominant drawing, square controls, 22/16/12px
roles, four palettes and native scrolling. No new runtime dependency.

Furniture contributes geometry/materials, never studio lights or cameras. An
isolated clone keeps source resources unchanged. Only schematic boxes keep box
shadow casters; loaded meshes cast their own shadows. Representation changes
refresh the existing cached solar maps once. Measured height also governs
sectioned/loading/failure boxes. The normalizer composes relative adjustments
without renumbering nodes. Bundled per-asset notices include creators, license
and legal links, source and changes. The catalogue links the deployed notice.

Restored five erased sample checks and added full-footprint containment for
all variants. The remote-inventory work guard now counts coordinate reads,
with an independently verified mutation that fails at the budget. See
docs/FURNITURE-AUDIT-2026-10-15.md for findings and executable evidence.
Lint/build, 474 frontend and 54 Worker tests, quota concurrency and production
dependency audits pass. Focused furniture/comparison/study browser run: 30/30.
Full merged-release browser and live checks are release gates. The local full
run stopped after 23 passes, two failures and one interrupted case. The existing
city first-frame wait timed out under host load; the furniture response wait
started before Solid could request a model. That wait now starts with the action
and asserts zero earlier GLB downloads. Both failures and the interrupted case
pass in a six-case desktop/phone rerun. Screenshots reviewed at 375/768/1280px.
Axiom remains registry
404; seven development-only advisories remain. Both novel geometry/shadow and
normalization lessons were captured and recalled from SecondBrain.

## Measured furniture catalogue — 2026-10-15

Design Read: furniture is evidence of scale, not decoration. The plan remains
the authority: every object has one measured footprint shared by the 2D drawing,
schematic views and optional real 3D mesh. Real materials appear only in Solid;
Architectural and Wireframe keep the quieter measured boxes. Six permissively
licensed Khronos sample assets provide chairs, sofas and small decor, with exact
credits and rebuild instructions in `docs/FURNITURE-CATALOGUE.md`.

Runtime contract: no GLB is requested at first paint or in schematic 3D. Solid
loads each model behind its own Suspense and error boundary; a slow, missing or
invalid model falls back to its measured box without taking down the building.
The chosen asset id and human label survive local saves and share links. Unknown
ids fail closed. Generated geometry is Meshopt-compressed, uses the decoder in
the lazy 3D bundle, and stays within a 3.5 MB total catalogue budget. The build
pipeline measures, centres and seats every model; tests re-open the shipped GLBs
and compare their envelopes with the generated manifest.

Verification: 452 frontend tests /60 files, lint and production build pass;
production dependencies report zero vulnerabilities. All 116 desktop/phone
browser checks passed, followed by a focused two-case furniture retest after the
last catalogue styling change. The browser proves the selected asset persists,
GLBs wait for Solid, and an aborted model request leaves the 3D building alive.
It also performs a real pointer drag on a blank plan at desktop and phone widths,
asserting that a wall is created, no uncaught page error occurs, and Undo removes it.
The final catalog and loaded sofa were also inspected at desktop width. The lazy
3D chunk remains about 1.04 MB minified /283 KB gzip; that existing Three.js
cost is disclosed rather than counted as first-paint JavaScript.

## SpaceFactor comparison work — 2026-10-15

Design Read: equal-scale measured plans explain the decision, and one local 3D
canvas holds camera/sun fixed while the user switches alternatives. Reference:
SpaceFactor Layout Studio's public room-scheme workflow, independently observed
with REA; detailed evidence and limits belong in docs/SPACEFACTOR-REA-REVIEW.md.
Keep square palette controls and the existing Source Sans/JetBrains Mono roles.
Cut walls dominate geometry; openings use medium ink, furniture fine ink.
Equal adjacent drawings are a comparison exception, consistent with study sheets.
Preview never edits a project. A saved baseline is bounded and nonrecursive;
metres stay constant across sites and both views share the north-west origin.
Plan and scope: docs/SPACEFACTOR-REA-PLAN.md. No SpaceFactor assets/source/solver
are embedded; all geometry, comparison and persistence code is independent.


Verification: 418 frontend tests /58 files, 54 Worker tests, lint/type/build,
production dependency audits, Worker type/quota/concurrency proof and all 110
browser checks pass. Comparison tests cover real storage reload/share, Restore
and Undo, distinct actual A/B pixels offline, byte-identical return to an orbited
camera, full-frame PNG export and inert full-house room preview. Existing city,
idle GPU, cached shadows, architectural A4 sheets and model exports still pass.
Independent review found a coordinate-tolerance bug when normalizing unequal
sites; original topology is now resolved before display transforms. Its focused
18 tests and asymmetric-site review pass, and the verified lesson is in SecondBrain.
The six focused comparison cases also pass explicit four-palette contrast,
three-size type and 44px target checks after correcting inherited 11px footer
buttons. Phone/tablet/desktop screenshots inspected at 375/768/1280px. REA's cleanup
verification failed after all scenario actions completed; report preserves that
partial observation instead of claiming a clean REA run. No new runtime dependency
or copied SpaceFactor asset/source. Seven existing development-only advisories
remain; production dependencies are clean. Axiom audit remains unavailable (prior
registry 404), so no passed automated design audit is claimed.

## Architectural study-sheet implementation — 2026-10-14

Design Read: calibrated black-and-white drawings carry the sheet; physical wall
cuts, dimension chains and a graphic scale make its geometry checkable on paper.
Reference: AIA Architectural Graphic Standards, Student Edition, 11th ed. (2008),
printed pp. 445–446 and 514–518. Original SVGs, no reproduced book graphics.
Institutional register: solid cut faces dominate, reference lines are 0.35 mm,
dimensions/furniture 0.18 mm. Equal seasonal panels are a comparison exception:
identical geometry, city, civil hour, cut and physical scale, differing only by date.
Keep the existing single-page A4 summary and add a selectable single-page seasonal
companion. Invariant: metres × 1000 / scale = printed millimetres.
Dimensions describe wall centrelines; 150 mm wall thickness and door swings are
explicit assumptions, not material specifications or construction compliance.
Wall ground shadows are analytic projections of actual cuboid wall pieces with
opening gaps. They exclude roofs/furniture; section arrows only show projected
solar direction. No LLM, new dependency, imported book asset or schema change.

Verification: 400 frontend and 54 Worker unit tests, lint/types/build, production
dependency audit, and all 104 desktop/phone browser checks pass. PDFs rendered
and inspected. Browser checks assert one page, actual A4 MediaBox, 96/25.4 px
per paper millimetre, and separation from footers; both seasonal comparisons
work offline, including polar night. A fresh reviewer confirmed aperture-union
and print-scale repairs and found no remaining confirmed issue. Shared-memory
lessons captured and recalled for modal PDF scaling and overlapping apertures.
Both sheets credit the book; no old code example is treated as compliance.

## SIC upgrade audit — 2026-10-12

Retained Claude’s canvas-first workspace, measured/order BOQ and model/print
exports. Corrected wall topology with a bounded exact cuboid union, aperture
orientation, mixed-height exterior spans, overlapping-aperture beam length and
thickened model size. Wet bands now deduct intersecting openings and respect
actual wall height. More exposes city selection and save status on phones;
all tools keep labels and 44px targets. Native keyboard/scrolling remain. A live menu check caught inherited stage-grid
placement; More now resets its palette/install children into one column,
verified by 18 branding/manifest browser cases across all four schemes.
No plan schema, persisted drawings, palettes or local sun calculation changed.
Design reference and dominant drawing sheet remain the serious-studio read below.
Cloudflare response headers restrict script and network destinations; development
source-map dependency patched. Seven development-only advisories remain.
Review and upstream credits: docs/security/cso-audit-2026-10-12.md,
docs/TEXT-TO-CAD-REVIEW.md, docs/OPENTAKEOFF-TAKEOFF-REVIEW.md.

Verification: 383 frontend unit cases, 54 Worker unit cases, lint/types/build,
production and Worker audits, and the SQLite concurrency proof pass. The full
browser run passed 100/102; its two old-footer install checks passed after
opening the new menu. Hosted CI reruns all 102 before mirror publication.
Axiom audit remains unavailable (npm 404); no passed automated design gate is
claimed. Responsive screenshots and computed geometry/contrast checks passed.

The optional AI routes are disabled by empty TRACE_MODEL/GEMINI_MODEL variables.
The production `/trace` probe confirms immediate 503/manual-underlay guidance.
Older model notes below are historical, not current configuration.

# designon (Design + Non) — live context

## Serious drawing studio — 2026-10-11

Design Read: the calibrated plan is the working sheet; a numbered room key and
aligned control margins make every room readable without printing words over
furniture. Reference: MoMA's exhibition-label hierarchy and Aalto's measured
working drawings. The plan dominates, navigation is a quiet index, and the sole
scheme accent identifies selection. Structural rules are 2px, control boundaries
1px, and drawing furniture lines stay lighter than walls. VARIANCE 2, MOTION 1,
DENSITY 6: compact commands, restrained colour, feedback only. Three workspace
type roles: 22px title, 16px command/reading, 12px annotation; mono is for numbers.
Keep the four user-requested palette choices and every drawing/analysis action.
The default becomes Drafting Room; stored choices remain valid, with quieter
grounds. No plan geometry, persistence or calculation changes. Numbered rooms
have an external name/area key; calibration, zoom and sun data occupy margins.
Native scroll exposes longer inventories and analysis without covering geometry.
The equal-scale room-option drawings remain a named comparison exception: they
are peers whose physical sizes must be directly comparable. Door-swing arcs,
point markers and data gauges retain geometric curves; UI surfaces are square.

Verification: 350 unit tests, lint, build and production dependency audit pass.
The expanded 24 palette/width browser checks cover actual sheet dimensions and
ratio, control/plot separation, Calibrate/lens separation, 44px header/tool/index
targets, keyboard room selection, uncancelled margin scrolling, active room
controls and text contrast. The complete 98 browser checks remain the publish
gate. Three screenshot rounds inspected desktop, tablet, phone, empty and
populated plans and the room comparison. Fresh review found wheel ownership
and inherited small header targets; both were repaired. Source/dist axiom-audit
remains unavailable (registry 404), so this is not recorded as a passed gate.

The hosted publish gate also exposed two existing saved-view races: immediate
capture before CameraRig registration and a three-clock comparison containing
only two distinct images. Capture now waits for the R3F-committed day/hour/year
and includes an independent deadline for suspended animation frames. All 354
unit tests and all ten study browser checks pass, including distinct real sun
frames, shared camera, persistence and Undo. Fresh review confirmed the timeout
repair and found no remaining confirmed capture issue.

The product is named **designon** (Design + Non). It is the first product under
the Axiom Design Core. The repo URL is kept as `luma-house` for GitHub Pages
inertia; the product name in the UI, in storage, and in user-facing copy is
designon.

## Concept photo API

- Worker project: `workers/concept-render`
- Live Worker URL: `https://luma-concept-render.drnon.workers.dev`
- Frontend default: same URL (overridable via `VITE_CONCEPT_API_URL`)
- Deploy: `cd workers/concept-render && npx wrangler deploy`
  (the secret below is already set; you do not need to re-put it to deploy code)
- Latest Worker version (2026-10-05): `32aebf87-a932-4582-b8cc-61ddc1a9b885`
  (production custom origins added; SQLite Durable Object `AI_QUOTA` and
  upstream status logging retained; see the Quota section)

### Models

Both live in `wrangler.toml`, not in the code:

- `TRACE_MODEL = "gemini-3.8-flash"` — vision, structured JSON out, for the plan trace
- `GEMINI_MODEL = "gemini-3.8-flash-image"` — concept photo generation

`gemini-2.5-flash` is **no longer served to new API accounts** and returns 404
("no longer available to new users") to a freshly created key, while the older
borrowed key kept working. A hardcoded model name is therefore a trap: it works
for whoever set it up first and fails silently for everyone after. If a trace
ever starts returning "The AI service is temporarily unable to read images",
check the model before the key.

### Who may call it

The Worker has an anonymous public API protected by CORS and quotas. CORS is not authentication. A browser call carrying an
`Origin` that is not one of these is refused with 403 before anything is spent:

- `https://designon.nonarkara.org`, `https://luma.nonarkara.org` (production custom domains)
- `https://nonarkara.github.io` (GitHub Pages mirror)
- `https://luma-house.pages.dev` (Cloudflare Pages)
- `http://localhost:5173`, `http://localhost:4173` (development)

Non-browser clients (no `Origin`) are still served, and are held down by the
per-IP cap. To add a host, edit `ALLOWED_ORIGINS` in `workers/concept-render/src/index.ts`.

### Quota

- Browser daily quota: 3 renders/day, localStorage key `designon:concept-quota`
  (legacy `luma-house:concept-quota` is read once and migrated). This is a
  courtesy limit only — it is client-side and trivially bypassed.
- Server caps (2026-10-03): one SQLite-backed **Durable Object** (`AI_QUOTA`)
  now reserves quota atomically before any upstream call — a per-network daily
  cap (`DAILY_IP_LIMIT`, 20) plus a global daily cap (`DAILY_GLOBAL_LIMIT`,
  200). The old non-atomic KV `RATE_LIMIT` binding is retired along with its
  namespace. It **fails closed**: if the coordinator is unreachable the
  request is refused rather than allowed to spend. Caller IPs are hashed
  (`day:ip` → SHA-256); raw IPs are never stored in the quota object.
- Deploying the worker after this change runs a new-class migration
  (`ai-quota-v1` in `wrangler.toml`); a plain `npx wrangler deploy` applies it.

### The key

`GEMINI_API_KEY` is set from a **dedicated Gemini API key** (2026-09-30). It
replaced a key borrowed from `bots/city-reporter-v2/.env`, which meant designon
and a city-reporting bot shared one 20-request free-tier budget — heavy use of
either took the other offline, and testing designon exhausted a quota another
project depended on.

Rotate it with:

```bash
cd workers/concept-render
printf '%s' "$NEW_KEY" | npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

It is still the free tier. The per-IP cap (20/day) is the real ceiling; the
browser's 3/day is only a courtesy. Before enabling a paid tier, require server-verified identity or an abuse challenge.
A shared secret embedded in the frontend would be public. The CORS allowlist
limits browser origins; it cannot authenticate a direct caller. Global caps
limit upstream request count, not an exact currency spend.

## Deploy targets

- Production frontend: https://designon.nonarkara.org/ (alias https://luma.nonarkara.org/)
  is Cloudflare Pages project `luma-house`, production branch `main`, canonical
  https://luma-house.pages.dev/. It is a direct-upload project: Git pushes do
  **not** deploy these domains. Run `npm run deploy:pages` after frontend changes.
- GitHub Pages mirror: https://nonarkara.github.io/luma-house/ — GitHub Actions
  deploys on every push to `main`. Verify canonical asset bytes first, then
  the custom domain and its browser behaviour; a green GitHub job only proves
  the mirror deployed.
- Repo: https://github.com/Nonarkara/luma-house
- Optional static: Render (`render.yaml`)
- AI (trace + concept render): Cloudflare Worker above, deployed separately and
  **not** automatic. Frontend and Worker can be minutes apart.

## Deploy commands

```bash
# production custom domains (worker toolchain supplies pinned Wrangler)
npm ci --prefix workers/concept-render
npm run deploy:pages
# GitHub Pages mirror separately follows pushes to main

# worker
cd workers/concept-render && npx tsc --noEmit && npx vitest run && npx wrangler deploy
```

## Drawing studio overhaul — 2026-10-02

Design Read: a working architect's drawing sheet occupies the desk; a narrow
olive index carries the seven decisions, with tools kept outside the drawing.
Reference: Alvar Aalto's Säynätsalo Town Hall working drawings, for the relationship
between a dominant plan, strong wall lines and quiet dimensional annotations.
The plan dominates; the rail supports; 2px walls, 2px active indicators and 1px
field boundaries have distinct jobs. Source Sans 3 carries commands and reading;
JetBrains Mono carries dimensions and drawing titles. No new fonts or imagery.

Named, load-bearing exception: the user's October 2 request explicitly selects
Nonarkara/palette. Wada plate 243 replaces the inherited dark/amber theme with
Ivory Buff paper, Slate Color ink, an Olive Green decision index, and Raw Sienna
as the sole action/selection pointer. This is an architectural drawing surface,
not an operations console. Semantic warnings retain independent labelled colours.

Intent: keep drawing, scale calibration, analysis and model navigation legible.
Relationship: warm paper and sienna against cool slate ink, with a bounded olive rail.
Chord: plate 243 — Raw Sienna / Ivory Buff / Olive Green / Slate Color.
Roles: paper ground / slate ink / olive index / sienna action.
Budget: roughly 80% paper, 15% index and ink structure, under 5% action.
Risks: historic digital values are not sufficient for small text contrast;
production values are adjusted, not described as Wada's exact printed colours.
Proof: contrast pairs, labelled selected states, grayscale and 375/768/1280 views,
plus drawing, sharing and undo checks before live deployment.
Source: https://colors.nonarkara.org/#plate-243 and docs/PALETTE.md.

Release audit: main and all three active agent worktrees were clean before this
change; the recent worktree tips were already merged. The user's open tab held
index-CTqnRSDg.js / index-BFji-qKj.css while the server served newer
index-DIAY16wX.js / index-Brt-1G-m.css. Reload the existing tab after deployment.
Browser tests formerly accepted another project's server on 4173. This project
now owns preview port 4186 and refuses server reuse. The named axiom-audit npm
command is unavailable (registry 404); rendered contrast, geometry, responsive
screenshots and independent adversarial review provide the available evidence.

## Luma illumination schemes — 2026-10-02

The user requests bolder tones and a few selectable schemes. This explicitly
extends the palette exception above: Solar Pop (Wada209, yellow/orange/Salvia),
Guava Club (Wada137, Etruscan red/Cinnamon/Pistachio), Violet Hour (Wada235,
Ivory/Yellow Orange/Grayish Lavender), and Drafting Room (Wada243).
Solar Pop becomes the default; existing plan and quota keys remain intact.
A labelled native select remembers the choice locally. CSS roles are shared
by all schemes, including alpha fills and 3D background/grid; semantic colours
remain fixed. No theme changes geometry, font metrics, density or interactions.
Production values adapt the historical intervals for contrast, not printed inks.

Verified: 289 unit tests, lint/build, and 40 Chromium browser checks pass.
All four schemes are exercised at 375/768/1280px with persisted appearance,
intact room counts, actual rendered contrast, Draw/Cost inspectors, preset
dialog, 3D controls and horizontal overflow checks. A fresh independent
review found legacy inline whites/emeralds; these now use roles and pass its
recheck across every scheme. Energy badge CSS uses valid roles rather than
appending alpha digits to a CSS variable expression.
Final visual sweep also found the Systems energy summary still using a dark
gradient with light-theme text roles. Its surface now uses the selection role;
the full 40-test browser gate additionally checks its title, value, units and
system row text in every scheme and width.

## Supplied house + light identity — 2026-10-02

Design read: the user's own navy house and yellow beam identify the drawing
studio; transparent cut-outs carry the chosen paper colour. Reference: the
supplied Designon Logo Concepts Board. Header identity is compact; welcome
identity precedes the drawing instructions; the platform guide uses the square
app variant; monochrome is the favicon. Supplied brand colours are an explicit
user-authorized exception to the interface palette; no CSS tinting. Details
and asset roles are in docs/BRANDING.md. Core drawing/3D/analysis content remains.

Web-app availability appears in onboarding and a reachable footer, with Chrome
and Safari home-screen instructions. Relative manifest paths respect Pages'
/luma-house/ deployment. Dedicated OS icons have paper backing; UI logos have
true alpha. The installed app carries an offline shell: `/sw.js` caches the
document, the build's files and the fonts, and serves the document when there
is no network. No automatic data-sync claim is made.
The independent review caught an overflow-hidden desktop footer; the workspace
now reserves its closed height and natural scrolling exposes expanded guidance.
Tests check alpha/no white pixels, dimensions, themes, manifest resolution,
ordinary scrolling and the preserved drawing workspace.

## Local rendering (2026-10-05)

Spatial and the first Renders view now use the local Three.js scene by default:
wireframe, opaque shadow-receiving floors, physical wall/window cutouts, hidden
ceiling/roof shadow casters, solid toggle, orbit/axonometric/top views, sun
time/season controls and PNG export. Section cuts alter inspection geometry
without shortening shadow casters. Roof visibility preserves selected-style
occlusion and eaves. Window rays are directional guides, not lux measurements.
Clear-sky shadows omit clouds, surrounding buildings and vegetation; no
photometric or construction certification is claimed. User-requested AI
illustrations and sketch tracing remain optional. A quick action saying
“render” opens the local scene; an explicit “photo”/“image” invokes the API.

Verification: e2e/local-render.spec.ts blocks the AI worker, tests four themes,
PNG bytes, shadow-pixel changes, a sun-time change with the browser offline,
and return to the unchanged plan on desktop and phone. CI pins action commits
and confines Pages write/OIDC permissions to deployment. It also checks the
worker types and real SQLite quota concurrency via npm run test:quota.

Security review and remaining build dependency risk: docs/security/cso-audit-2026-10-05.md.


## Worldwide sun study — 2026-10-05

- The main render is a low-detail Three.js perspective of the actual plan.
  Camera motion, geometry edits and sun changes request frames; idle views
  stop drawing. Shadow maps are 1024px with viewport DPR1. Fixed interiors
  remain under a closed, explicitly labeled **Concept references** section.
- `src/location/locations.ts` searches cities/postal codes through Open-Meteo
  Geocoding (GeoNames), with abortable debounced search and a bounded query
  cache. Exact latitude/longitude plus IANA time zone are available offline.
- `PlanState.location` carries the city through save, import, undo and sharing.
  Legacy plans retain Shanghai as the starting city. City changes update all
  latitude-based climate calculations plus the chart and 3D sun together.
  Pending debounced saves flush on `pagehide`, preserving immediate reloads.
- `src/location/solar.ts` uses **SunCalc 2.1.0**, BSD-2-Clause, bundled locally.
  License notice ships in `public/licenses/suncalc.txt`. The city clock uses
  its IANA zone and current calendar year. DST gaps advance with a toast;
  repeated hours use their first occurrence. The chart covers the whole day,
  labels sunrise/sunset or polar day/night, and uses the same position engine
  as the perspective. Annual screening calculations remain approximate solar
  time models; neither model includes external terrain/building obstructions.
- No AI call is needed for this perspective, shadow update or sun chart.
  A network request is used only to look up a new city; chosen locations and
  manual coordinates work offline. AI tracing and illustrations remain opt-in.
- Verified: 327 unit tests, 82 Playwright desktop/phone checks, lint and production
  build. Browser checks compare rendered pixels, block AI, exercise offline
  city coordinates and assert real WebGL draws stop after large-site tours
  and entering Walk from Axonometric. Idle assertions wait for two consecutive
  quiet intervals rather than guessing camera settlement time. Test workers
  are capped at 2 to avoid
  concurrent software-WebGL shader compilation exhausting the first-frame
  budget. Independent review rechecked DST transitions and camera settlement.

## Architectural communication — 2026-10-06

Design Read: a measured drawing should make room boundaries, openings and sun
shadows readable before the user needs to inspect every edge. Reference:
IngeTrazo's separate drawing styles, classified drawing pens and sheet composer
(reviewed at 6be29fe); implement these ideas in our existing Three.js stack.
The actual model is the dominant element; saved views and sheet tools support it.
Cut edges carry the heaviest ink, walls carry medium ink, furniture carries fine
ink. Existing palette choices and interactive tools remain available.

Invariant: presentation cuts, projection and display style never remove the
full building's shadow casters. Camera movement reuses the light's shadow map.
Implemented true orthographic Axonometric/Top-Down views, an opaque architectural
style with filled horizontal cuts, bounded saved view metadata in the project,
locally cached previews labeled when the drawing changes, and a print study
sheet with vector plan/section, a live captured view and the city's sun chart.
No IngeTrazo source or desktop runtime is incorporated. GLB interchange is a
separate future integration.

Verified locally: 336 unit tests across 48 files and all 92 desktop/phone browser
checks, including orthographic pose/year/time restoration, share/reload,
three distinct offline sun frames from one camera, actual offscreen shadow
draw reuse, stale-preview labels and Undo. A4 PDFs retain calibrated vector
dimensions and fit one page; independent sample/small-site print review found
no footer overlap. Phone and tablet screenshot review led to more model space,
wrapped plan labels, a stacked phone sheet header and 44px study buttons.
The preview-history test exposed an existing room keyboard defect: Enter/Space
now selects a room through the same selection state, without starting a drag.
Software-WebGL browser checks use one worker to avoid concurrent GPU startup
timeouts. Lint, type/build, Worker type/quota checks and the production dependency
audit pass. The source/bundle provenance scan found no provider client hosts,
key literals, builder branding, generator meta or localhost URLs.

Tool limitation: `npx axiom-audit . --strict` and its `dist` equivalent are
unavailable (npm registry 404; no installed workspace binary). Do not record
them as passed. Existing palette contrast checks now also inspect the saved-view
and sheet dialogs across all four schemes and three viewport widths.
Those additional checks exposed Spatial's absolute climate panel intercepting
study buttons at 768px and 1280px. Both Spatial and Renders now keep that panel
in a separate row below the model; its controls remain available through the
canvas scroll area.

## SIC room arrangements — 2026-10-11

Design Read: the decision is whether the same furniture fits this measured room
better elsewhere; compare its footprints before committing a change. Reference:
SpaceFactor / HomeFactor's same-space arrangement workflow, independently
implemented (see `docs/SPACEFACTOR-SIC-REVIEW.md`). The measured comparison pair
is the dominant element. Room edges use 3px ink, furniture 1px ink, openings
5px accent, door buffers 1px dashed accent. Preserve the four authored palettes,
Source Sans 3 and JetBrains Mono. Named comparison exception: equal plan
viewports are load-bearing here because a larger preview would falsely imply
a larger room. They are one comparative drawing, with matching scale and bounds.

Scope/invariant: the local bounded search proposes only furniture poses. Sizes,
IDs, room boundaries, openings, other rooms, WC fixtures and systems survive.
Preview is separate from Apply; one accepted arrangement is one undo transaction.
Vector footprints describe geometry, not lux, routes or code compliance. The
accepted plan feeds existing local 3D and sun studies. No source, models or assets
are copied from SpaceFactor. Credits identify workflow inspiration and acknowledge
Shouheng Chen as the source of the reference.

Verified before release: 348 unit tests /49 files, all 98 desktop/phone browser
checks, lint, type/build, Worker type/quota checks and production dependency audit
(zero vulnerabilities). Browser cases cover inert preview, keyboard Delete/Esc,
single-step Apply/Undo, reload/share, impossible and empty rooms, selected city
context, all four palettes' contrast and 44px controls at 375/768/1280px. Screenshot
review replaced stacked phone diagrams with equal adjacent viewports and numbered
footprints with a readable metric inventory. Independent review found/fixed altered
proposal acceptance, stale room selection after Undo, and global inventory in the
beam; its 100 custom-size fuzz cases /108 proposals passed independent containment,
collision and fixed-size checks. The 1,000-piece stress case fell from 5,303ms to
154ms; a regression test enforces a bounded local search with remote pieces intact.
The shared verified lesson was captured in SecondBrain before this local record.
`axiom-audit` remains unavailable for both source and dist (registry 404).
The impossible-fit walkthrough also exposed FloorPlan's accessible furniture
labels using generic catalog sizes. They now use each piece's actual footprint
and orientation; the custom-desk Apply test checks those dimensions before/after.

## Furniture/layout audit — 2026-10-15

The selected city and civil time own direct lighting; an imported furniture
asset must not add studio lights/cameras or duplicate its real mesh shadow with
a box. Cloned models now enforce that boundary; representation arrival/removal
refreshes cached shadows once, and fallbacks share the asset's measured height.
The normalizer preserves node indices and composes repeat scale corrections.
Full-house/3D comparison choices reveal and focus their read-only preview.
Per-asset creators, sources, modifications and legal URLs ship in a catalogue
notice. Five lost sample checks were restored alongside containment checks for
all three variants. The remote-inventory guard counts coordinate work instead
of relying on a machine-speed ratio; the original bug fails that guard.

Production verification exposed a failure invisible to the original preview:
CSP blocked bundled Meshopt WASM compilation and embedded GLB blob textures,
leaving 36-index boxes despite successful downloads. Runtime release `f5c3752`
adds only `script-src 'wasm-unsafe-eval'` and `connect-src blob:`. JavaScript
Function and inline scripts remain blocked. Vite preview now applies the exact
production headers. Normal same-origin probe scripts enforce that distinction;
CDP evaluation is not a valid probe because it bypasses eval restrictions.
The independent 3MF test reader also loads through a same-origin script URL.

Cloudflare upload `28ad020a` is verified on the canonical alias and custom domain:
20 file hashes and the exact CSP match for three consecutive probes. All 20
live desktop/phone furniture/comparison/security cases and four live export
cases pass, using isolated saved plans with service workers blocked. The user's
existing Cape Town drawing was inspected without replacing its saved geometry.
The preceding upload was rejected after its live mesh check failed; its earlier
124-case preview pass alone was insufficient. See
`docs/FURNITURE-AUDIT-2026-10-15.md` for the full release evidence and limitations.
No Worker code/deployment or persisted drawing schema changed. Existing old
sample copies remain user drawings; a release never silently replaces them.

Final combined gate: `d42772d`, CI `38769369863`, 474 frontend +54 Worker +126
browser cases pass (browser 4.7m); lint/build/type/quota and dependency gates pass.
Mirror deployment succeeds and all 20 checked files match three consecutive
probes. Primary runtime/policy `f5c3752` has the same tested application bytes.
The final report/context-only commit skips CI after this complete gate; it has
no runtime effect. Seven pre-existing dev-only dependency advisories remain;
Axiom audit is unavailable (registry 404), so neither is claimed clean/passed.

## Reconciliation drawing fix — 2026-10-15

Design Read: the measured paper must stay in the same place while the pencil is
held down. Reference: the existing AIA drawing-sheet layout and its separate
control margins. Keep the drawing dominant, current structural/control line
weights, four palettes and typography. Reserve the existing pencil-hint row
while inking, hiding its text without removing its layout space. This prevents
live canvas bounds from changing between pointer-down and pointer-move; no new
surface, toolbar or overlay is introduced. Other PR #5 UI rewrites are deferred.

MiniMax/PR reconciliation shipped as `05d25b0`, Cloudflare upload `119236b4`.
CI `38772314712`: 480 frontend +54 Worker +136 browser checks pass (browser5.2m),
with type/build/lint/quota and production dependency audits. Primary live30
cases pass (4.7m); mirror subpath live12 cases pass (37.8s). All20 checked files
match three consecutive probes on canonical/custom/mirror; actual primary CSP
matches too. No provider call, dependency version, model binary, city migration
or policy change was introduced. Rotation now clamps actual measured sizes;
permitted meshes rank by fitted area; inking retains stable canvas bounds;
short pencil tails are absorbed only for full-edge strokes; a drawn room keeps
manual inspector access without auto-opening over phone Undo. Canonical/share
metadata identifies the primary domain. PR4 merged; PR2/3 closed; PR5 closed
after bounded extraction. Original branches retained; rejected/deferred parts
are explicit in `docs/RECONCILIATION-2026-10-15.md`. Seven dev-only Tailwind
transitive advisories remain; no Axiom pass claimed. Two novel verified lessons
are in SecondBrain. Final receipt/context-only commit skips CI with unchanged
application bytes. Another task's roomOptions.ts/probe changes in the shared
checkout were excluded and preserved; do not treat them as part of this release.
