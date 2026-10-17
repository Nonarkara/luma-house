# RHIKNOWBOT: capability gap review

Reviewed 2026-10-17. References: [RHIKNOWBOT](https://www.rhiknowbot.com/),
[features](https://www.rhiknowbot.com/features), [demo](https://www.rhiknowbot.com/demo).

RHIKNOWBOT is a parametric architecture CAD from Shouheng Design and Technology
Co., Limited, selling a tower-scale workflow: draw a massing rule once, and
components — balconies, railings, mullions, windows — propagate across every
surface. Its demo material is AF Tower, WOZOCO, and high-rise tower form-making.

It is not a like-for-like competitor. It is a desktop parametric modeller aimed
at tower practice; we are a browser napkin sketch aimed at deciding one
building's worth of light. What follows is a **vantage-point comparison**, not a
feature-count comparison, and every claim about their product is taken from its
public marketing pages and two published demo stills.

## Method and evidence boundary

Their site is a client-rendered React shell with no server-rendered text, so the
pages were read in headless Chromium against the production site. Evidence is
limited to:

- rendered text and outbound network targets of `/`, `/features` and `/demo`;
- two published still images from `/demo` (`FZ6YGxS10thE.webp`,
  `ARtXSjpPhpnx.webp`), showing a parametric facade with balconies, railings and
  mullions, and a live shading study over the same massing.

No account was created, no licence was purchased, no application was downloaded,
and no private API was called. **We did not run their software.** Every statement
about how their tools behave under a drawing is therefore read off marketing
copy and stills, and is marked as such. Claims about our own product are backed
by the test suite and are cited to files.

## Their published feature set, transcribed

General: introduction, detailed, components, massing, constructs, 2D to 3D,
projection, parametric design, automated city construct, 2D and 3D diagrams,
quick render, creative booklet.

Features page, in full: convert line to solid · modify section type · customize
section type · unroll solid object · match plan with 3D surfaces · construct a
component · define a component · apply components to 3D surfaces · massing ·
morphing · interference · city road · city block · diagram · render · booklet.

## Gap table

| Their capability | Our position | Verdict |
| --- | --- | --- |
| Convert line to solid | A pencil stroke is a wall (`src/canvas/napkinStroke.ts`); four walls become a room | **Parity.** Ours is the entry point, not a feature. |
| 2D to 3D | The whole product; plan and 3D share one geometry model (`src/study/geometry.ts`) | **Parity, different origin.** |
| Massing | Rooms, wall heights, section cut | **Parity** at house scale. |
| Diagram | Solar position, sun-hours, heat, wind, air, daylight, egress (`src/analysis/`) | **Parity.** Ours is analysis-first and quantified; theirs ships a shading still. |
| Quick render | Local Three.js, no image service, PNG export | **Parity by different means.** We refuse the AI-render wait on purpose. |
| Booklet | A4 study sheets, one page each, physical scale | **Weaker.** We produce single sheets, not a composed multi-page document. |
| Projection (elevation) | We cut **sections**; we do not draw elevations | **Gap.** A real one, and cheap. |
| Components applied to surfaces | Furniture catalogue bound to measured footprints (`src/catalog/`) | **Weaker.** Ours is a catalogue of placed objects, not a rule that propagates across a surface. |
| Modify / customize section type | Wall assemblies and thickness (`src/assemblies/`, `src/analysis/walls.ts`) | **Partial.** Thickness and U-value, not a drawn section profile. |
| Morphing | Plan A / Plan B could only be at one end or the other | **Gap — closed here**, see below. |
| Interference | Furniture overlap, door buffers, room overlap (`src/options/roomOptions.ts`, `src/plan.ts`) | **Partial.** Real clash checks at furniture and room level; no general solid-solid interference. |
| Unroll solid object | Mesh export to GLB/STL/3MF with printability checks (`src/fabricate/`) | **Gap.** We export solids but never unfold them. |
| City road / city block | — | **Deliberately out of scope.** They are a city tool; we are a single-building decision tool. |

## What this review changed

**Morphing.** Their features page lists "morphing" under massing. We had Plan A
and Plan B and could only show one or the other, so arguing with an arrangement
meant flipping between two stills and remembering what moved.

`src/comparison/morph.ts` adds a slider between the two pinned alternatives:
every continuous measured quantity — room position and size, wall height,
opening position and its explicit dimensions, furniture position and explicit
size, pencil wall endpoints — is a straight line between the two plans, at a
fixed camera and a fixed sun, so the shadow moves with the furniture and the
light does not quietly change underneath the argument.

The part that mattered more than the slider was deciding what the slider is not
allowed to do. A piece that exists in only one plan cannot slide in from
nowhere, and a sofa is not half a bed on the way there, so those swap at the
midpoint. `rotated` is a boolean and 90° is not a point on the line between
`true` and `false`, so a piece turns rather than spinning. `morphCoverage`
counts how much of the drawing is genuinely continuous, and the 3D view prints
that count on screen. A smooth animation that quietly hides four swapped pieces
is the same class of lie as an estimate labelled as a measurement, which is the
one thing this product does not do.

**A named gate.** Reaching for `npm run verify` during this review found no such
script, while gates sat in four invocations across two working directories. It
now exists and runs lint, the build, the unit suite and the worker's tests.

## What this review did not do

- We did not add elevation drawings. It is the clearest remaining gap and the
  cheapest to close, and it is left open deliberately rather than half-built.
- We did not add component propagation. Our furniture is placed, not ruled
  across a surface, and pretending otherwise would misrepresent what the
  catalogue does.
- We did not verify any of their behaviour under a real drawing. Everything in
  the table above about their product is marketing copy and two stills.
- Their tower, city-block and parametric-facade workflows are not reachable from
  a napkin sketch, and this review does not pretend otherwise. Where their
  vantage point is genuinely different, the honest answer is that we are not
  building that tool.