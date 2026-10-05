# designon (Design + Non) — live context

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
- Latest Worker version (2026-10-03): `3783a732-6083-480b-af3c-4847630c6255`
  (KV rate limit → SQLite Durable Object `AI_QUOTA`, upstream status logged
  on every branch; see the Quota section)

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

- `https://nonarkara.github.io` (GitHub Pages — the live site)
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

- Frontend: https://nonarkara.github.io/luma-house/ — GitHub Actions deploys on
  every push to `main`, so a green local build is not a deployment. Check the
  live URL, and remember a minified bundle strips comments, so a string probe
  cannot prove a change shipped. Verify behaviour in the browser instead.
- Repo: https://github.com/Nonarkara/luma-house
- Optional static: Render (`render.yaml`)
- AI (trace + concept render): Cloudflare Worker above, deployed separately and
  **not** automatic. Frontend and Worker can be minutes apart.

## Deploy commands

```bash
# frontend (or just push to main and let Actions do it)
npm run build
npx wrangler pages deploy dist --project-name=luma-house --commit-dirty=true

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
true alpha. No offline-cache promise or automatic data-sync claim is made.
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
