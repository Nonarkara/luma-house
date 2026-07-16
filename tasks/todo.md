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

Remaining (vision gap, next increments): true 3D walkthrough view, sketch
auto-trace assist, material/installation guidance feeding the BOQ.
