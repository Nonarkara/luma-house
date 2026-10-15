# Furniture and layout audit

Authorized: audit Claude's report, fix verified issues and ship when ready.
Baseline: e3dc78c plus two pending furniture test changes, preserved separately.

## Scope and invariants

The selected sun owns direct lighting. A furniture download must not introduce
lights/cameras, change measured dimensions or leave duplicate shadow geometry.
Loaded models and schematic fallbacks keep the same measured height. Shadow maps
update when a representation changes and rest while idle. Preview never edits a
project. Keep all drawing, palette, scene, export and room-option actions.

Design Read: choosing a view must reveal that view in the existing drawing
workspace. Reference: designon's measured architectural sheets and AIA Graphic
Standards line hierarchy. Keep current square controls, 22/16/12px roles and all
four palettes; the drawing remains dominant. No new runtime dependency.

## Planned surgical fixes

- Restore five erased sample tests; retain fit checks and add full-footprint
  containment for every authored sample variant.
- Replace machine-time performance assertions with a counted remote-coordinate
  work budget and unchanged local proposals; mutate the original beam bug to
  prove the guard detects it.
- Prepare isolated model clones without lights/cameras; keep material resources
  unchanged, use measured heights, keep full-height box shadows only for boxes,
  and refresh existing solar shadow maps on representation mount/unmount.
- Reveal/focus the chosen comparison content, including loading, using native
  scrolling. Preserve Apply/Undo and the read-only state boundary.
- Repair repeat normalization without shifting node indices; add regression tests.
- Bundle complete per-asset credit/source/license/change notices and link them
  from the catalogue. Retain all original source metadata.

## Verification

Focused unit/renderer probes, actual GPU mesh draw and malformed/missing model
browser paths, lazy loading, scene-shadow refresh and idle reuse. Check preview
visibility and focus at phone/tablet/desktop widths, and all existing browser
workflows. Run lint/build, unit/Worker gates and audits without concurrent GPU
suites. Commit, push, deploy primary+mirror, verify matching bytes and live paths.
