# OpenTakeoff takeoff review

Studied: [Kentucky-ai/opentakeoff](https://github.com/Kentucky-ai/opentakeoff),
revision `9624be84c60dc1f7f2ac403e0f05a873ba26b486` checked on 2026-10-12. Open-source PDF takeoff for construction and
flooring, AGPL-3.0.

## Licence decision

OpenTakeoff is AGPL-3.0; designon remains MIT. Its estimator conventions were
implemented independently, without incorporating OpenTakeoff source code. The ideas below were reimplemented against designon's own plan model,
and the credit lives in the README.

## What we took

An estimator does not measure a room on the line someone drew. OpenTakeoff
traces rooms to the innermost wall face, records how each shape was measured,
and keeps a materials buy list apart from the measured quantity. Read with
those rules, designon's interior BOQ had four errors:

| Error | Before | After |
|---|---|---|
| Door sets on a shared wall | counted once per side; the 50 m² demo apartment billed 7 door sets for 4 doors | each opening is owned by one room; units equal openings |
| Floor, ceiling, wall areas | measured on the drawn centreline; a 3 × 4 m room read 12.0 m² | measured to the inner face, 0.075 m in from each line; 10.97 m² |
| Skirting | ran straight across door openings | the run stops at doors |
| Waste | measured quantity billed as bought | order = measured × (1 + waste): tiles 10%, boards 8%, wall tile 10%, skirting 10% |

Every line now carries a `basis` string ("2.85 × 3.85 m to inner wall face")
shown under it in the Budget panel, so each number can be argued with.

Tests in `src/boq/interiorBoq.test.ts` lock all three behaviours. The
conservation test (BOQ door and window units equal openings on room walls)
fails on the previous code with 7 against 4.

## What we did not take, and why

- **Room provenance.** OpenTakeoff stamps every shape with its scale, method
  (hand, traced, agent), and whether a person corrected it, with the
  machine's original boundary frozen beside the correction. designon's AI
  trace passes a review gate, then accepted rooms become indistinguishable from
  drawn ones. This is the strongest next step: an `origin` on `Room` that
  survives share links, shown in the room key until someone edits the room.
- **PDF sheet takeoff and MCP tools.** designon starts from a napkin sketch,
  not a construction drawing set. A measuring engine for bid documents serves
  a different user.
- **Roll-goods seam layout.** Useful for carpet and vinyl, which designon's
  finish palette does not offer yet.

## Known limit

The October 12 review now nets the exact opening intersection with the wet-room
tile band, clips the band and opening deductions to the actual wall height, and
uses opening orientation and full-width fit when assigning a wall face.
The 0.15 m wall is one thickness for every wall; real exterior walls are
often thicker.
