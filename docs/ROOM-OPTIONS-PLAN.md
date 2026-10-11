# First SIC implementation: room options

Approved scope: the SpaceFactor SIC review recommended a local, bounded furniture
search followed by preview and an explicit, undoable Apply. The user's request to
start rebuilding with SIC authorizes this first increment. No new external service
or copying of SpaceFactor source, models or visual assets is needed.

## User review and decisions

Compare the current room with up to three distinct arrangements of its existing
furniture: open centre, window side, along walls. Explain measured geometry and
limits rather than a synthetic comfort score. Doors get a conservative buffer;
WC fixtures stay fixed. No valid candidate means no proposed edit. A/B climate
uses one shared context from the selected city, civil date/time, sun and weather
assumptions; geometry-only daylight reach remains explicitly labeled.

## Sacred items and invariant

Keep all drawing tools, palettes, calibrated dimensions, local 3D, sun charts,
saved views, share/import and optional tracing. Preview never changes PlanState.
Apply replaces only furniture poses in this room as one history transaction.
Boundaries, openings, dimensions, IDs, other rooms and fixtures never change.
The existing renderer reads the applied geometry, without an image API call.

## Proposed files

- `src/options/roomOptions.ts` and tests: deterministic bounded placement and
  measured comparisons, validation and transient cache.
- `src/components/RoomOptionsDialog.tsx`: keyboard-accessible native dialog with
  calibrated vector drawings, room chooser, explicit preview and Apply.
- `src/App.tsx`, `src/styles.css`: discoverable plan tool, single-transaction
  Apply, scoped responsive tokens; connect actual climate comparison inputs.
- `src/analysis/abComparison.ts`, tests and its modal: explicit shared context.
- E2E coverage, README credits and project context: verified behavior and limits.

Design Read: furniture decisions need two comparable measured drawings, not a
decorative picture. Named reference: SpaceFactor's same-space arrangement workflow
(see `SPACEFACTOR-SIC-REVIEW.md`); drawing hierarchy follows the earlier IngeTrazo
study. The two plans dominate. Room edges use heavy ink, furniture fine ink,
opening markers medium ink, dimension guides quiet fine ink. Existing four
palettes, Source Sans 3 and JetBrains Mono remain; no gradients or new shadows.

## Verification

Test room containment, furniture collisions, door buffers, fixed fixtures, custom
sizes, empty/impossible/ambiguous rooms, determinism, cache and bounded search.
Exercise Cancel, Apply, one-step Undo, reload and shared geometry with AI requests
blocked. Check palette contrast, targets and overflow at phone/tablet/desktop;
inspect screenshots and use a fresh independent adversarial reviewer. Run lint,
unit tests, production build and existing browser checks. Commit/push this isolated
release, deploy primary and mirror, verify their shipped bytes and live behavior.

Implementation evidence: 348 unit tests and all 98 desktop/phone browser checks
passed locally. Lint, production build, Worker type/quota checks and production
dependency audit also passed. A fresh independent review found three defects
(altered proposals, stale selected room IDs, and remote inventory in the search);
each was repaired and verified. The 1,000-piece stress case improved from 5,303ms
to 154ms, with its regression test preserving all remote furniture. Independent
fuzzing checked 100 room cases and 108 proposals. Screenshot review covered
375×812, 768×1024 and 1280×900 and led to equal adjacent phone diagrams and numbered
footprints linked to readable dimensions. Source/dist `axiom-audit` is unavailable
(npm registry 404); it is not a passed gate.
