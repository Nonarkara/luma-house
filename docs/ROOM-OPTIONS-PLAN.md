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

Release blocker, 2026-10-11: the mirror's existing Worker-toolchain audit fails
on sharp/librsvg (GHSA-wq5f-xc86-pv6w), inherited through Miniflare and Wrangler.
The approved security/ship scope includes updating those development dependencies
and the lockfile to patched releases, retaining the audit gate, then verifying
Worker types, concurrency/global quota and the complete hosted CI pipeline.
This does not change Worker source, model configuration, origins or secrets.

Patched toolchain verification: Wrangler 4.149.0 and pinned Miniflare
5.20261006.1-alpha resolve sharp 0.35.5; the full Worker dependency audit reports
zero vulnerabilities. Worker TypeScript, all 52 input/security/upstream/quota/trace
unit tests, and the SQLite concurrent/global quota proof pass. Advisory source:
https://github.com/advisories/GHSA-wq5f-xc86-pv6w.

The frontend production dependency audit also reports zero. Its full development
audit still reports eight CSS-build dependency advisories (Tailwind 3's
braces/micromatch/selector-parser chain and source-map-js). This release does not
claim a clean full frontend development audit. Tailwind's suggested major
migration needs its own visual regression work; the existing production audit
gate remains enabled.

Final climate presentation correction: net heat flow is signed (entering positive,
leaving negative). A lower signed value can mean more heat loss in cold conditions,
so the thermal variance is now shown neutrally, with that sign convention explained.
Cold-night and hot-night rendering tests check both signs without a good/bad grade.
The remaining comparison metrics retain their existing presentation.
