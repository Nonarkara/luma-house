# Make designon work from one consistent model

Approved scope · 25 September 2026 · user approved implementation

## Outcome and invariant

A person can draw or trace a plan, calibrate it, edit it in 2D/3D, save it,
and compare design changes using results traceable to that exact model.

Invariant: the geometry, dimensions, openings, and material properties used
by the editor, saved project, renderer, and calculation must agree.

## Evidence collected

- `npm test`: 185 tests pass across 32 files on commit `385cdf7`.
- The live GitHub Pages app loads and exposes the drawing workspace.
  This verifies initial loading, not the complete workflow.
- `src/concept/layoutSynthesizer.ts` returns predefined layouts, ignores
  `targetAreaM2`, and reuses the same opening/furniture coordinates for
  different room arrangements. The UI calls this “AI Layout”.
- `src/sharePlan.ts` preserves opening width/height but drops sill/head
  height, SHGC, visible transmittance, and operable fraction on import.
- `src/analysis/walls.ts` accepts opening rotation but does not use it when
  matching an opening to a wall. It checks center position, not full width.
- `src/analysis/energySimulation.ts` derives degree days and irradiation
  from latitude, uses a fixed baseline EUI of 180, and returns A+ for an
  empty model. Its output is presented as annual simulation and payback.
- `workers/concept-render/src/index.ts` generates concept images from text
  only. The images are not a geometry-constrained rendering of the model.
- The trace worker requests approximate rectangles. The client immediately
  commits the result before the user checks the trace against the source.

## Review required

Recommended first release: repair model integrity and the draw → save →
reopen → 3D workflow, including a review step for imported AI drafts.
Then add one genuine simulation engine as a separate, verified release.

This preserves the current rectangular-room scope initially. Arbitrary
polygons, multi-storey BIM, and professional simulation are larger schema
and service changes; they should not be promised by relabeling this model.

## Proposed first-release changes

1. **Persistence** — modify `src/sharePlan.ts` and its tests to round-trip
   every supported physical opening property with explicit range checks.
   Check plan assemblies and room heights in the same round-trip fixture.
2. **Opening geometry** — modify `src/analysis/walls.ts` and add focused
   tests for orientation, full-width containment, shared walls, and corner
   ambiguity. Keep existing analysis exports compatible.
3. **Generated layouts** — modify `src/concept/layoutSynthesizer.ts` and its
   tests so target area controls uniform scale; openings derive from actual
   shared/exterior segments; furniture belongs to its intended room.
   Every generated enclosed room must have a modeled route to an exit.
   Label the existing feature “Layout presets” in `FloatingToolbar.tsx`
   and `Inspector.tsx` unless a real generation service is introduced.
4. **Trace review** — modify `src/concept/tracePlan.ts`, `src/App.tsx`, and
   add a small review component. Keep the existing project until the user
   accepts a draft; preserve the source image for comparison, request one
   known dimension, and report unresolved geometry. Handle request failure
   and cancellation without overwriting the current plan.
5. **Claims** — update `EnergySimulationCard.tsx` and the energy result
   contract/tests to distinguish heuristic previews from engine results.
   Missing prerequisites must not yield an energy grade or payback claim.
   Preserve the calculation breakdown and interactive analysis surfaces.

## Real simulation, following model integrity

Use existing engines rather than inventing another approximation:

- [Honeybee](https://www.ladybug.tools/honeybee.html) provides a model path
  to EnergyPlus/OpenStudio and Radiance.
- [EnergyPlus](https://energyplus.net/) models building energy consumption.
- [Radiance](https://www.radiance-online.org/about/detailed-description.html)
  calculates light using ray tracing.
- [Honeybee Radiance source](https://github.com/ladybug-tools/honeybee-radiance)
  is relevant prior art for the lighting adapter.

Select the first engine after the user identifies the main desired result.
Validate a small exported room against a known engine fixture before
connecting it to the UI. Record engine version, weather source, geometry
revision, assumptions, and run status alongside every result. A failed or
stale run must never silently fall back to a plausible number.

A local process is a candidate for this local-first workspace. Hosting,
runtime availability, installation, authentication, and browser access
must be checked before committing to that service boundary. The public
GitHub Pages frontend alone cannot execute native simulation binaries.

## Preservation requirements

- Keep the plan canvas, spatial view, roof controls, walkthrough, sun tools,
  Value Lens, comparison, BOQ, curated sample, and image gallery.
- Preserve old saved plans through explicit defaults and compatibility tests.
- No file shrinks by more than 30%; no unrelated visual redesign.
- No secrets enter client bundles, logs, fixtures, or version control.

## Acceptance and deployment

- Add tests that fail on the current property loss and invalid generated
  openings before applying fixes. Test all layout styles and target areas.
- Save/reopen/share must preserve physical properties and calculation inputs.
- In a real browser: draw, calibrate, change an opening, inspect 3D, save,
  reload, and confirm the same geometry and dimensions remain.
- Exercise trace accept/cancel/failure without losing the previous project.
- Check desktop and 390px mobile, plus the existing sample and roof controls.
- Run tests, lint, and production build. Commit with `Agent: codex`, push,
  inspect the deployment, and repeat the relevant workflow on the live URL.
- Report simulation as implemented only after a real engine run agrees with
  its reference fixture; passing existing unit tests is insufficient.


## Release verification · 25 September 2026

Implemented model persistence, opening attachment, geometry-derived presets,
source-aspect trace calibration with explicit review, shared opening dimensions,
and heuristic-only energy disclosure. The existing canvas now follows the
physical site aspect ratio. Undo/redo also restore the tracing underlay.

Independent review reproduced two additional failures (source aspect distortion
and head-only windows disagreeing with heat calculations); both have regression
tests. The original 15 model-integrity regressions failed before the fixes.

Browser verification before deployment: 80 m² linear preset; window height/sill
edit and reload; spatial view and roof control; trace fixture review/calibration
at 390px; acceptance and undo to the previous project. Fixture responses were
explicitly marked and served only by a temporary localhost test process.

The real public trace worker returned `GEMINI_API_KEY is not configured on the
worker`. The error path preserved the current project. Its checked-in server
also has no authentication and allows requests when rate-limit storage is
missing. Restoring a provider key to that public endpoint is not part of this
frontend release; access control and an enforced limit must precede that work.
No test endpoint, provider credential, or fixture response is shipped.

EnergyPlus/Radiance integration remains the next release. This release does not
claim real annual simulation, energy certification, carbon payback, or successful
production AI tracing.
