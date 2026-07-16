# Lessons

## 2026-07-16 · Draw-stroke threshold + synthetic-event testing
- **What went wrong:** `strokeToRoomRect` required ≥8 stroke points, so fast flicks (and automated drags) produced nothing. Also, browser-automation checks read the DOM in the same tick as dispatched pointer events, before React flushed state — false negatives that sent debugging in the wrong direction.
- **Correct behaviour:** Reject strokes by *size* (bounding box < ~0.8 m), not by point count. When testing React UIs with dispatched events, always re-query the DOM in a separate call/tick.
- **How to recognise:** An interaction that "works by hand but not in tests" (or vice versa) — suspect event timing/pointer capture before suspecting the feature logic. `setPointerCapture` throws on synthetic pointer ids; wrap it.
