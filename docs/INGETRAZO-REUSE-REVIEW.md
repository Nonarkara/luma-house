# IngeTrazo: what to borrow, improve and credit

Reviewed 2026-10-11 for designon / Luma House. This is a research and implementation proposal, not a record of newly shipped features.

The useful next step is better architectural communication from the model we already have: correct building orientation, surrounding shade, clear vector drawings and dimensions that follow edits. Keep the existing local Three.js/SunCalc stack and cached sun views.

## Evidence and current baseline

I inspected the [public site](https://ingetrazo.com/en/), its enlarged sheet-composer screenshot, selected source files and tests, the extension catalog and their license notices. The main repository currently resolves to [6be29fe](https://github.com/ingelibre/ingetrazo/commit/6be29fe437a7cd992d4e079f71720821b25216b9), the same revision examined for our October 6 implementation. No desktop application or extension was installed or executed. Source tests were read, not run. The example PDF could not be rendered through the web reader because its host returned an unsupported content type.

Our existing implementation already supplies parallel Axonometric/Top-Down cameras, opaque horizontal cutaways, full shadow casters, saved camera/city/date/time settings, cached comparisons and an A4 study sheet. In `src/study/StudySheet.tsx`, the plan and wall section are vector SVG; the 3D panel is a JPEG capture. Its section is a north-parallel wall slice, not a general section through roofs and arbitrary solids. `SiteSpec` currently has no project-north angle or neighboring-obstruction data. Do not mistake the October 6 work for a complete sheet composer.

## Borrowing map

| Source pattern | Existing position | Proposed improvement | Adoption |
| --- | --- | --- | --- |
| Project north separate from drawing axes | Every drawing assumes north up | Let a house face any bearing while the chart keeps true geographic north | Independently implement |
| Model-derived vector drawings with cut, profile and edge classes | SVG plan/section, raster 3D panel; viewport line hierarchy | Export visible model edges, filled cuts and elevations as vectors, with paper-unit pen weights | Independently implement; core is GPL |
| Dimensions anchored to model features | Field dimension and calibrated room sizes | Bind room widths, openings, sills and heights to stable entity/feature IDs so edits remeasure them | Independently implement |
| Context geometry around a project | Shadows contain only our building | Add simple neighboring blocks, boundary walls and shading devices before full terrain imports | Independently implement |
| Saved view frames on paper | Six saved scenes and one fixed A4 layout | Reference named views in multiple sheets, with per-view style/scale, revision and detail markers | Extend our existing study system |
| Real-size component catalog | A small furniture catalog and primitive masses | Add a small curated set of people, plants and furniture, downloaded only when selected and cached locally | Asset-by-asset license review |
| Open model exchange | Shared plan JSON and captured images | Export GLB first, then classified SVG/DXF drawings; test opening the model in IngeTrazo | Use our own exporter implementation |

The drawing classification is supported by [their line-class and section-fill tests](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/tests/test_hlr_line_classes.py). Their [composition module](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/core/composition.py) separates model metres from paper millimetres and attaches view frames to saved or standard cameras. Their [glTF exporter](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/formats/gltf.py) includes geolocation metadata. These are useful reference contracts; we have not tested interoperability yet.

## Build order and acceptance evidence

1. **Orientation and surrounding shade.** Add a persisted north bearing, with legacy drawings defaulting to zero. Transform geographic sun/wind directions into the drawing frame once, consistently across 3D, window rays, plan sun patches and climate calculations. Add explicitly user-drawn context blocks in metres, allowing them outside the plot. Include context bounds in the shadow frustum and cache identity. If analytical daylight/heat still excludes those blocks, label that distinction until its occlusion model is connected. Acceptance: a 90° orientation change rotates the correct window exposure; a neighboring block interrupts a known sun ray; save/share/undo preserves both.

2. **Vector views and anchored dimensions.** Expose shared model geometry to a separate visibility/section pipeline; compute visible line segments and closed cut loops in a worker on demand. Cache by geometry, camera and section, and discard stale jobs. Project to SVG in paper millimetres. Keep the interactive shadow renderer independent so a printable drawing does not start an endless render loop. Acceptance: an occluded rear edge disappears, an opening remains a void in section fill, a roof slice agrees with the model, and a measured length survives PDF export at its stated scale. Dimensions follow moved/resized entities and visibly flag missing anchors.

3. **Delivery and scene legibility.** Offer a few sheet templates with selectable scene frames, graphic scale bars and editable project/revision fields. Add small scale figures and a restrained asset catalog. Export GLB with metre units, correct axis conversion and attribution metadata. Acceptance: another viewer opens the exported model at the right size; imported geometry is identified as a reference mesh unless we can genuinely reconstruct its editable room/opening semantics.

Invariant: plan, perspective, sections, annotations and quantities describe the same calibrated model; presentation cuts never shorten its physical shadow casters. Preserve every existing palette and tool. Test changes at phone, tablet and desktop widths.

## Improvements we should retain or make

- **Keep our civil-time handling.** Their [core sun module](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/core/sun.py) defaults to an integer UTC offset derived from longitude. Our `src/location/solar.ts` already uses IANA zones and handles daylight-saving gaps/repeats. Borrow their orientation controls while retaining our time engine.
- **Keep the interface focused on a decision.** Give users a small set of named views and a clear route to a sheet. Their desktop toolbar and extensible modeling UI are larger than our phone-first sketch workflow needs.
- **Give assets explicit provenance.** Store source URL, original author, exact license/version, physical dimensions and adaptation history. Preserve credit through model exports. Their [texture metadata](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/resources/textures/library.json) demonstrates author and real-size fields, but those fields alone are not permission to redistribute an asset.
- **Use deterministic actions if AI is added later.** A typed, validated action should be previewable and undoable. Construction summaries can describe verified geometry and quantities. Rendering, drawing exports and routine edits do not require a multimodal API. Do not add arbitrary generated Python execution to the web app.

## Reuse and credit

**Patterns.** Our architectural presentation and study-sheet workflow were independently implemented. Add an acknowledgment naming IngeTrazo, Marco Sumari Tellez and contributors, with links to the project and this review. Their [AUTHORS file](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/AUTHORS) also identifies the drafting practitioners behind its representation improvements. Credit is useful provenance, not an endorsement claim.

**Core code.** IngeTrazo's files carry GPL-3.0-or-later notices. Copying or adapting those files cannot be treated as MIT code merely by adding a credit line. A distributed covered derivative must meet the GPL terms, including applicable notices, licensing and corresponding-source requirements; see [LICENSE, sections 4–6](https://github.com/ingelibre/ingetrazo/blob/6be29fe437a7cd992d4e079f71720821b25216b9/LICENSE). Recommendation: keep this browser implementation independent and exchange files with the separate desktop tool. That does not grant rights to bundled assets.

**One concrete permissive candidate.** [Polygon properties](https://github.com/ingelibre/ingetrazo/blob/v0.5.7/examples/extensions/propiedades_poligono.py) is explicitly MIT, copyright 2026 Rony Leonel Janampa Monago, with adaptation by the IngeTrazo maintainers. Its plain mathematical helpers calculate regions with holes. They are a candidate for future nonrectangular geometry/quantity work, with the complete MIT notice retained and fresh tests for winding, holes and degenerate polygons. It is not a rendering engine and has not been integrated here.

**Extensions.** Licenses and authors vary. The [JA Sun catalog entry](https://github.com/ingelibre/ingetrazo-extensions/blob/main/extensions/ja_sun.toml) credits Julio Angulo and declares GPL-3.0-or-later. The catalog marks it as community, rather than maintainer-reviewed. Its sun-path/navigation pattern is relevant; the Python extension is not a browser drop-in. A catalog integrity hash is not a security audit.

**Examples and assets.** The site's Yanque example documents are offered under CC BY 4.0. Reusing an example requires appropriate creator/source/license credit and identification of changes, without implying endorsement; see the [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/). Models and textures need their own original notices, including embedded third-party content. Prefer selecting assets from their original library and verifying each license over copying the entire bundled collection. No IngeTrazo screenshots, example documents, models, textures, logos or source code are shipped by this review.

Suggested acknowledgment, adopted in the README:

> Architectural drawing and study-sheet workflow inspiration: IngeTrazo by Marco Sumari Tellez and contributors. These features are independently implemented in designon; no IngeTrazo source code is included.

Research limits: source inspection and public examples support these recommendations, but no native runtime, exported-model round trip or future implementation has been validated in this pass. The existing application source is unchanged.
