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

Remaining (vision gap, next increments): sun patches cast into rooms through
openings (real light, not a ray icon), true 3D walkthrough view, sketch
auto-trace assist, material/installation guidance, honest light score.
