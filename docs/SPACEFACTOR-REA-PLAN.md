# SpaceFactor comparison workflow

Authorized by the request to investigate SpaceFactor with REA and improve designon.
This is an independent implementation of public workflow ideas, not a copy of
their application, model library, catalog or solver.

## Evidence and questions

Use REA 6.5.0's CLI without changing agent registrations. Inspect the public
Layout Studio sample, room-specific arrangement switching and viewing controls.
Record observations separately from implementation inferences and inaccessible
backend behavior. Public claims about designer quality require evaluation data;
they are not a benchmark result.

The public demo visibly offers a no-login sample, per-room scheme selectors,
whole-house/room views, parallel projection, wall cuts and screenshot export.
Our existing room solver already preserves real footprints and fixed openings.
Concrete gaps: the A/B modal has no drawing, its metrics ignore furniture poses,
and its baseline is lost on reload. Room options require Apply before 3D viewing.

## Planned implementation and boundaries

- Preserve every drawing tool, four palettes, scene/city/clock, print/export,
  model validation, history and local-first behavior. No new runtime dependency.
- Store one nonrecursive baseline snapshot in the project. Keep valid drawings
  when comparison metadata is malformed. Pin/promote/restore use normal history;
  share, JSON and reload retain both alternatives.
- Show measured A/B drawings anchored at the same north-west origin with a
  common metre viewport, real furniture/openings and explicit room-level
  distances/fit warnings. Keep the existing envelope comparison and assumptions.
- Add one lazy local 3D comparison canvas. Toggle drawings without changing the
  camera, sun, frame or section; use full-frame PNGs. Reuse existing wall, opening,
  furniture and cached-shadow components. Preview is read-only.
- Expose this preview in room options before Apply. Keep measured 2D previews,
  conservative door buffers, explicit acceptance and one-step Undo.

Design Read: two measured drawings carry the decision; the 3D canvas confirms
what moved under fixed sunlight. Reference: SpaceFactor Layout Studio's public
sample workflow and designon's existing architectural study sheets. Console
controls use current square tokens; geometry uses heavy cut faces, medium opening
lines and fine furniture/dimension lines. Equal drawing panels are a purposeful
comparison exception. Three text roles and the existing four palettes remain.

Invariant: changing a comparison view changes no saved geometry; one metre has
the same apparent size in A and B. Baseline snapshots never contain another
baseline. Both 3D alternatives share one camera and one lighting context.

## Verification

Test baseline sanitization, recursion/size bounds, legacy input, share/reload,
restore/Undo, physical framing, changed furniture measures and missing rooms.
Browser checks compare actual 3D pixels before/after switching, preserving an
orbited camera and preventing AI requests. Verify keyboard/Escape, phone/tablet/
desktop layouts, all palettes, existing print/export and idle GPU behavior.
Run unit/lint/build, fresh adversarial review and the full browser suite.
Commit, push, deploy primary and mirror, then verify shipped bytes and live flows.
