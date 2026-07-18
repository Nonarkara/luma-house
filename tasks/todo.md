# Luma House — napkin-magic increment (2026-07-16)

Gap vs vision: the core "draw with a finger, helpers straighten it" interaction and
furniture-fit checking did not exist. This increment adds both.

- [x] Draw tool: freehand stroke on plan → snapped, scaled rectangle room
- [x] Furniture at real dimensions (bed, sofa, dining, wardrobe, desk), draggable
- [x] Door-swing clearance check — furniture blocking a door is flagged
- [x] Tests for stroke snapping and clearance math (36 tests green)
- [x] Lint, build, deploy to luma-house.pages.dev, verify live on phone width

## Review — shipped 2026-07-16

Commits `b925b31` + `1fa345c`, live at https://luma-house.pages.dev
(deployment 8fbb6a98). Verified on production: drew a stroke → room created;
dragged bed to a door → red flag + "blocks a door swing" chip. 36 tests green.

Learned: finalize gesture data from refs, not state closures — instant
down/move/up sequences batch in React and lose state-only strokes.

## Review — sun increment, shipped 2026-07-16 (Sonnet-implemented, Fable-specced)

Real sun patches through windows (depth = 2.4m / tan(altitude), clipped to the
lit room), honest daylight panel (measured m² + lit rooms replace the fake
score), Quito + Anchorage locations. 41 tests green. Live at
luma-house.pages.dev (deployment 515c5b5b). Visually verified: Bangkok 15:00
lights 3 rooms from the WSW; Anchorage same hour lights 2 rooms from the NW.

## Review — climate performance increment, shipped 2026-07-16

Ported the orphaned `src/analysis/` engine from the
`feature/environmental-analysis-and-photo-input` worktree onto current main,
reconciled it with main's furniture/door-swing types, and wired it into the UI
as a new "Climate" workspace mode. The engine computes per-wall solar exposure,
cross-ventilation scores, a directional peak-indoor-temperature model, and
severity-ranked suggestions — all driven by transparent formulas, not a black
box. 56 tests green (15 new analysis tests). Lint and build clean.

What the user now sees in Climate mode:
- Whole-house scores: ventilation, solar balance, shade, overall (0–100).
- Per-room diagnostics: peak °C, ΔT over outdoor, vent %, severity badge.
- Actionable suggestions with one-click "Apply" (e.g. "Add a window to the
  south wall" → places the opening → scores update live).
- Honest model caveat: "Directional model… not a substitute for EnergyPlus."

Learned: the analysis engine existed on a stale branch (cut before draw/furniture
features) with zero UI references — a complete but invisible feature. Porting
required adding the `furniture` field to test fixtures and the `action` field
to suggestions for the interactive apply loop.

Remaining (vision gap, next increments): sketch auto-trace assist, material/installation
guidance feeding the BOQ, annual overheating-hours integration, embodied carbon line item.

## Review — spatial pass cleanup, 2026-07-17

Previous agent (Fabel5) inflated a markdown feature list while regressing the product:
Three.js dollhouse (+800 KB bundle), neon cyan plan canvas, child-friendly climate copy,
and broken cold-climate logic (`sun.altitude < 15`).

- [x] Remove @react-three/fiber / drei / three — bundle 1124 → 214 KB gzip
- [x] Restore Luma House plan canvas (dark site, citron selection, double-line CAD walls via ::before inset)
- [x] Rebuild SpatialView as CSS axonometric: dollhouse cut faces, furniture blocks, sun rays, breeze path, HVAC badge, solar badge
- [x] Pass location into SpatialView for Anchorage heat vs tropical cool labels
- [x] Rewrite location-specific climate suggestions in professional tone
- [x] Keep styleKeywords → concept render + budget scaling (with test)
- [x] 57 tests green, lint clean, build clean

## Review — integrity + analysis increment, 2026-07-17

Full-codebase audit (`tasks/audit-2026-07-17.md`) found the last increments
polished surfaces while the plumbing leaked. Fixed in priority order:

- [x] H1: concept-render success no longer dies on localStorage quota —
      `writeQuota` evicts oldest images until the payload fits; count persists
- [x] H2: climate "Apply" gives E/W windows `rotation: 90` (was horizontal on
      vertical walls, breaking glyphs and sun patches)
- [x] H3: Share embeds the plan in the URL hash (`#plan=…`, `sharePlan.ts`);
      recipient restores the exact plan — previously shared nothing
- [x] H4: "brighter" quick action puts the window on the selected/largest
      room's north wall (was hardcoded off every room → zero analysis credit)
- [x] Openings snap to the nearest wall on place/drag (`snapOpeningToWall`)
- [x] Keyboard: Delete (room/opening/furniture), Ctrl/Cmd+Z+Shift/Y, Esc,
      arrow nudge ±1% (Shift ±5%); opening chip with delete affordance
- [x] Room-overlap detection → dashed red rooms + canvas warning (area was
      silently double-counted, breaking the 100 m² cost anchor)
- [x] Import project JSON (export finally has its counterpart); all plan
      inputs (hash/localStorage/file) pass through `sanitizePlan`
- [x] Vitest excludes stale `.worktrees/**` (64 → 54 tests, all real)
- [x] Inspector imports `estimateEnergySavings` instead of re-implementing it
- [x] Canonical/OG URLs point at luma-house.pages.dev (primary, not mirror)
- [x] Vision: embodied-carbon section in BOQ (transparent per-line kgCO₂e
      factors, ICE order of magnitude, exported in project JSON)
- [x] Vision: annual overheating-hours per room (12 months × 07–19 h sampling,
      calibrated so insulation/ventilation moves the number; Anchorage reads 0)
- [x] 54 tests green (13 new), lint clean, build clean (77 KB gzip, +3 KB)

Learned: the first overheating calibration failed its own test — the outdoor
baseline sat above the comfort threshold year-round, so insulation changed
nothing. Fix was recalibrating gains to physical peak magnitudes (600 W/m²
wall irradiance × 0.35, ~700 W per window) and treating the outdoor model as
monthly average daily max. A model that can't fail its knobs is decoration.

## Review — journey loop, 2026-07-19 (Grok 4.5)

Other agents failed by shipping feature checklists (Three.js dollhouse, fake
SVG renders, neon blueprint chrome) instead of the newcomer path:

Draw → Model → Sun → Advice → Cost → Picture

- [x] Plan-driven SVG isometric massing (`isometric.ts` + SpatialView) — your
      rooms become 3D volumes; no Three.js
- [x] Polar sun chart in Light mode (location + day path + live hour)
- [x] Design brief in Advice: insulation, digital, solar, climate with BOQ
      deltas and one-click Add
- [x] Deliverable rail reordered to the real journey; Model is a first-class step
- [x] Render gallery driven by live plan massing + optional Gemini concept photo
      (static courtyard SVGs removed)
- [x] 60 tests green, lint/build clean (~79 KB gzip)

Learned: “3D” for this product means *the plan you drew, extruded* — not a
generic game-engine scene. Isometric SVG keeps the conservation law (room
geometry ↔ massing) visible and testable.
