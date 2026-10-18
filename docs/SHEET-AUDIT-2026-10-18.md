# Drawing-sheet and morph audit · 18 October 2026

Audited MiniMax runtime `5a685ef` and the preceding elevation/DXF/timezone and
morph commits. The working tree was clean at entry. No open pull requests
required reconciliation. Preserve the interactive model, study sheets, six
drawing styles, four workspace palettes and existing saved drawings.

## Confirmed defects and repairs

- **Font-dependent label spill.** An isolated Chromium raster probe found 17
  real Utility glyph pixels outside its face in High-tech: estimated advance
  25.8px, actual JetBrains Mono advance 41.99px. Placement now measures the
  loaded font's advance and actual ink bounds. Font download failure measures
  the fallback without rejecting the application promise.
- **Partially hidden labels.** Dining's face centre was visible, but 60 glyph
  pixels painted over a taller Kitchen. Full convex ink-box/face intersection
  replaces the centre-only visibility check.
- **Hidden fallback numbers.** A rejected Dining name became an unchecked `1`,
  painting 13 glyph pixels over Kitchen. Numbers now use the same visibility
  checks. Hidden faces remain named in an all-room key.
- **Key and print containment.** The old key concatenated arbitrary names on
  one unwrapped line. The sheet had no explicit physical print dimensions;
  the new print-containment test failed at the old runtime. A wrapped two-column
  key grows the SVG annotation margin. Explicit 281 × 190mm output fits the A4
  landscape printable area; preview zoom is reset for printing. Panels fit
  independently, with a plan scale bar and an explicit concept-drawing notice.
- **Plan labels over furniture.** Moving a name to the top-left does not prove
  that corner is empty. Plan label placement now checks furniture footprints;
  the room key preserves identities when no name fits there.
- **Morph endpoint and dimension loss.** A 3.2 × 1.6m desk became its catalog
  default when only one endpoint omitted dimensions; a 4m room became 2.7m.
  Endpoint entities now retain every field, while intermediate dimensions use
  the same effective defaults as the renderer. Room kind, furniture identity,
  and opening orientation switch at the midpoint. Legacy head-only openings
  preserve their measured aperture. Baseline camera/sun/site conditions remain.
- **Morph coverage.** Removing one ID and adding another counted one swap.
  Additions now count actual IDs absent from the baseline.
- **Automatic city persistence.** The browser-zone city was display-only. A
  Bangkok share opened under a Shanghai browser with different sunlight.
  Fresh plans now store the resolved city. Legacy plans without a city retain
  Shanghai; explicit stored cities win. Imports also accept a validated city
  in older JSON export wrappers. The manual walkthrough also found that an
  explicitly loaded sample was still unlocated and got discarded by the old
  demo migration on reload. Restoring the sample now stores Shanghai; the
  desktop/phone regression cases preserve all six rooms through reload.

DXF exports were checked for metre units, entity pairs and north-up coordinates;
no confirmed exporter defect was found. No provider call, Worker runtime,
dependency version, model binary, persistence key or CSP change is included.

## Visual review against the seven adopted rules

Reference: workspace `DESIGN-ANTI-SLOP.md`, adopted 18 October 2026. Actual
screenshots at 1440, 1024 and 390px are required, followed by independent review.

1. Content-sized controls: retained 44px touch targets; no new empty panels.
2. Composition: fixed drawing panels retain their measured drawing roles;
   room keys occupy a separate annotation margin, clear of axonometric solids.
3. Line length: long room names wrap in two key columns; footer statements
   occupy separate lines instead of competing at opposite ends of one line.
4. Type: removed the restored sheet's third Palatino/Georgia family. Source
   Sans 3 and JetBrains Mono remain the two established product fonts.
5. Ornament: removed Fancy's double decorative frame and the Postmodern header
   square under the current owner-adopted rule. All six selectable styles and
   their functional drawing line weights/fills remain.
6. Hierarchy: the drawing remains dominant, with keys and methods subordinate.
7. Chrome: initial phone screenshots showed six style buttons consuming the
   preview. A native style selector reduces that chrome; drawing zoom and a
   keyboard-focusable scroll region let phone users inspect details. The
   section slider is hidden on the elevation sheet because that sheet chooses
   its automatic section independently.

## Evidence and limits

The independent reviewer reproduced the three glyph defects before repair and
reran the original raster probes after repair: zero actual glyph pixels escape
faces or cover later faces across 29 occlusion arrangements and mono fixtures.
New browser tests use custom heights, real loaded font bounds, long keys,
physical PDF output, phone zoom, cross-time-zone sharing and legacy JSON import.

Local combined gate: 539 frontend tests in 66 files; 54 Worker tests in five
files; lint and production TypeScript/build pass. Production dependency audit
reports zero vulnerabilities. Seven existing dev-only Tailwind 3 transitive
advisories remain (two moderate, five high); no forced Tailwind 4 migration.

This is a concept drawing, not a construction drawing. Schematic styles retain
their explicitly described graphic eave/joinery conventions; they do not change
saved construction geometry or quantities. A4 fitting can reduce type for very
large room inventories. No claim is made that every possible arrangement or
arbitrary inventory size has been exhaustively tested. Broader facade/roof
visibility and construction-detail validation remain separate work.

Independent visual review cleared the final 1440/1024/390px screenshots, 300%
phone preview and the actual PDF raster against all seven rules. The first
captures failed phone chrome and footer line length; both were corrected and
re-captured before that verdict. The PDF has one nonblocking pale strip below
the drawing background; no content is clipped and its source is unverified.

All 22 focused desktop/phone release cases pass (1.2m). A broader local run was
stopped after finding a pre-existing camera assertion comparing floating-point
poses byte-for-byte: an OrbitControls round-trip varied by approximately
1e-14. The assertion now requires 1e-10 agreement for pose/zoom/field height,
retains exact projection/FOV checks, and still requires three distinct actual
sun frames. No production capture logic was weakened. The final full gate
and live deployment are recorded below when verified.

## Shipped release

- Runtime `2369499`, following the main audit fix `d72914a`.
- [CI 39148190535](https://github.com/Nonarkara/luma-house/actions/runs/39148190535):
  539 frontend tests, 54 Worker tests, **158 browser cases pass (5.6m)**.
  Lint/build/type, Worker quota and dependency gates pass. Mirror deploy succeeds.
- Cloudflare upload `bb0b4e67` via `npm run deploy:pages`.
- Entry `assets/index-D25KEgcd.js`, SHA-256
  `58e8e51e3a6be963507dbf31be1ec50ee6534601524e27b86ea101371ee78199`.
  The deploy rebuild matches all 44 reviewed local file hashes.
- Canonical alias, primary custom domain and GitHub mirror each match all
  **44 files for three consecutive disposable-key probes**. Primary/canonical
  CSP matches the tested source policy. GitHub does not apply `_headers`.
- Primary live **30 desktop/phone cases pass (1.4m)**: real font containment,
  occlusion and marks, long-key A4 PDF, preview zoom, morph, automatic city
  sharing/import, sample reload, actual furniture mesh draws, solar shadows,
  and the WASM-allowed/JavaScript-eval-blocked policy boundary.
- Mirror live **14 desktop/phone cases pass (31.1s)** at `/luma-house/`:
  labels, print/zoom, fresh city sharing and sample persistence. Temporary
  test copies prefix navigation paths; root-domain success is not substituted.
- Live tests use isolated profiles and block service workers; no user drawing
  was replaced. Three verified lessons were stored in SecondBrain.
- A final manual check in the persistent in-app browser opened production's
  Renders → Study sheet → Elevation sheet. The new style/zoom selectors are
  visible; the user's existing Cape Town 50m² drawing remains intact.

Evidence: `/Users/nonarkara/.codex/visualizations/2026/10/18/designon-sheet-audit/`,
including immutable final screenshots, actual print raster, PDF and release
hash manifest. The final receipt-only commit has no application-byte change.
