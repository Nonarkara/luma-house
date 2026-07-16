# Luma House — napkin-magic increment (2026-07-16)

Gap vs vision: the core "draw with a finger, helpers straighten it" interaction and
furniture-fit checking did not exist. This increment adds both.

- [x] Draw tool: freehand stroke on plan → snapped, scaled rectangle room
- [x] Furniture at real dimensions (bed, sofa, dining, wardrobe, desk), draggable
- [x] Door-swing clearance check — furniture blocking a door is flagged
- [x] Tests for stroke snapping and clearance math (36 tests green)
- [ ] Lint, build, deploy to luma-house.pages.dev, verify live on phone width

Verified locally in-browser: sketched a stroke → "Sketched room · 4.2 m²" appeared;
dragged the bed onto door d1 → red flag + "blocks a door swing" chip.
