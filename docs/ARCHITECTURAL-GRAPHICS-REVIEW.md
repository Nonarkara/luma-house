# Architectural graphics in designon

Reference: American Institute of Architects, *Architectural Graphic Standards,
Student Edition*, Eleventh Edition, edited by Bruce Bassler, Wiley, 2008.
Reviewed printed pages 445–446 (solar representation) and 514–518 (drawing
organization, identification and graphic symbols) in the user-provided copy.
These are historical graphic references, not current building-code authority.

## Adopted and improved

- Separate physical objects from reference symbols: solid wall cuts, lighter
  furniture and glazing, indicative door leaves/arcs, directional section
  markers, centreline dimension chains and a graphic scale.
- Identify each printable sheet: A-01 plan/section and S-01 seasonal sun,
  initial study revision 00, project, city, date/time and physical scale.
- Compare simple solar drawings at one scale. June and December 21 use the
  chosen city, civil hour and year. Labels avoid imposing northern seasons
  on southern or equatorial locations.
- Keep the captured local Three.js view and current SunCalc chart on the
  existing summary sheet. The seasonal companion prints separately to
  preserve legibility and the single-page A4 contract.

All graphics and code are original. No book page, figure, logo, material hatch
or proprietary CAD symbol is embedded. Credit appears on both printed sheets.
No new package or image-generation API is required.

## What the drawings mean

Walls assume 150 mm thickness around the modeled room boundaries. Chain
dimensions measure those centrelines, not finished clearances. Short chain
numbers are omitted to avoid collision; compact plans use a numbered room key
with width, depth and height. Door swings illustrate an opening; hinge and
swing direction are not specified in the saved model. The section looks south,
with levels relative to finished floor and the highest intersected wall level.
No material hatch is used without a material specification.

The grey solar footprints are analytic ground projections of full-height wall
cuboids, including opening holes. Each cuboid corner is projected opposite the
sun by `height / sun.y`; its convex hull forms one opaque shadow polygon. SVG
clipping limits display to the drawing field. This is a walls-only ground
study: roofs, furniture, glazing transmission, terrain and neighbouring
obstructions are excluded. Section arrows project sun direction east-west;
they do not predict indoor illumination. The live 3D view retains its full
building shadow model.

SunCalc 2.1 returns altitude in degrees and azimuth clockwise from north. The
companion reuses the live view's east/up/south vector convention and city civil
time adapter, including the selected year and daylight-saving handling.
Source and BSD notice: https://github.com/mourner/suncalc and
`public/licenses/suncalc.txt`.

## Verification contract

Pure tests cover actual wall thickness, low walls, orphan markers, calibrated
dimensions, explicit swing assumptions, hemisphere/year handling, cardinal
solar vectors, height/shadow ratio and the union of overlapping openings.
Browser tests generate single-page PDFs from desktop and phone viewports,
verify A4 MediaBox dimensions, and measure SVG transforms at 96/25.4 pixels
per paper millimetre. They also check offline computation, distinct dates,
polar night, absence of diagram/footer collisions, and return to the preserved
captured view.

Two failures found during review are now protected: a named `@page` on a child
of a modal could silently yield Letter paper, and flex shrinking could change
the physical scale while the label still read 1:100. Default A4 page rules,
complete annotation budgets and non-shrinking vector drawings enforce the
paper contract. A fresh adversarial review also found sequential aperture
subtraction could retain a false sill inside an overlapping door; wall pieces
now subtract the vertical union in each horizontal interval.
