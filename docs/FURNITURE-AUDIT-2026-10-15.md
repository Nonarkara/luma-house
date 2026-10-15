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

## Confirmed findings and repairs

1. **Imported lighting changed the sun study.** The velvet sofa contains a
   directional studio light with intensity 3. Furniture now mounts isolated
   clones with lights/cameras removed. All 21 meshes across the six shipped
   assets remain; source scenes and shared materials remain unchanged.
2. **Loaded furniture cast two shadows.** An invisible measured box still cast
   a shadow behind the real mesh. Only schematic/failure boxes keep that proxy;
   loaded meshes cast their own shadows. Representation changes refresh existing
   cached light maps, without enabling continuous shadow rendering.
3. **Fallback heights disagreed with real assets.** Generic decor and sofa
   heights could turn a 0.2032 m vase into a 0.6 m box, or shorten the wood sofa.
   Loaded, sectioned, loading and failed models now share the measured height.
4. **Rebuilding assets could corrupt node references or undo scale.** The
   normalizer now keeps node indices and composes corrections onto an existing
   active-scene wrapper. Repeated target heights .36, .36, .5, .5 remain centred
   and floor-seated, without adding nodes or cycles. Skin/animation references
   and the active-scene choice are covered by regression checks.
5. **The sample tests lost five existing checks.** Restored area, overlap,
   opening, BOQ, systems and window coverage alongside the new bedroom checks.
   Added whole-footprint containment for all three authored variants. Moving the
   bed to x=0,y=0 makes these checks fail, proving they catch an unowned piece.
6. **Timing assertions remained machine-dependent.** Replaced the remote-plan
   ratio with a coordinate-work budget and exact proposal comparison. Actual
   remote reads: 41,664; budget: 99,200. Restoring the original repeated remote
   search throws at read 99,201. No production instrumentation was added.
7. **A selected comparison could remain below the visible dialog.** Full-house
   and representation choices now focus/reveal their content with native scroll.
   Apply/Undo and read-only preview behaviour remain. Screenshots reviewed at
   375, 768 and 1280 px; automated phone/desktop checks measure canvas visibility.
8. **Asset notices were incomplete in the shipped bundle.** The catalogue now
   links a bundled notice with creators, copyright, source, license/legal URLs,
   adaptations and the lighting exclusion. Original GLB metadata is retained.
9. **The lazy-load response deadline started before the requesting action.**
   A 180-second test budget did not change the response wait's own 15-second
   deadline. It could reject before Solid was clicked while 3D initialized.
   The wait now starts alongside Solid in `Promise.all`, after explicitly proving
   Plan and Architectural requested no GLB. The trace confirms the original
   failure; the corrected case passes on desktop and phone.

Independent review reproduced the original failures and rechecked the repairs.
No remaining confirmed finding was reported within this scope. This is a
furniture/layout audit, not a claim of a comprehensive application pentest.

## Evidence before release

- Lint, TypeScript/production build and 474 unit tests across 61 files pass.
- Worker type check, 54 tests and SQLite quota concurrency check pass: the
  configured users admit 5 and 7 requests, exactly the global limit of 12.
- Production dependency audit and full Worker audit: zero vulnerabilities.
  Seven existing development-only advisories remain (two moderate, five high).
- All 80 compressed buffer views in the six shipped GLBs decode with the exact
  bundled Meshopt decoder. The exact GLTFLoader parses 21 meshes. Actual browser
  indexed draw calls distinguish meshes (>1,000 indices) from boxes (36).
- Focused desktop/phone furniture, comparison and study-sheet browser run:
  30 passed. Delayed mesh arrival adds its real shadow; moving only the camera
  reuses the cached map. Missing files and corrupt HTTP-200 files leave a drawn
  building, with no uncaught page error on the corrupt-file path.
- Full merged-release browser suite and public deployment checks are recorded
  below when completed. Port 4186 belonged to another preview; this audit uses
  an isolated preview on 4191 and does not stop that service.
- The local full run was stopped after 23 passes, two failures and one
  interrupted test. The city first-frame wait timed out under host load; the
  second failure exposed the response-deadline bug above. An isolated rerun of
  both failures plus the interrupted shadow/wireframe case passed all six
  desktop/phone cases in 36.6 seconds. Complete-suite verification uses CI's
  separate runner; the interrupted local run is not reported as a full pass.
- Source and built-output scan found no direct OpenAI/Anthropic provider calls,
  builder hosts, generator metadata or localhost URLs. No new dependency or
  credential is introduced. The largest file reduction is 13.4%, within the
  30% anti-regression limit. Existing canvases, controls and content remain.
- `npx axiom-audit . --strict` still returns registry HTTP 404. Its source/dist
  design gate is unavailable; no automated Axiom pass is claimed. Existing
  palette/type/target checks and visual review provide the available evidence.

## Upstream sources

- [Glam Velvet Sofa](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa): embedded studio light and asset credits.
- [Sheen Chair](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair), [Damask Chair](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChairDamaskPurplegold), [Wood Leather Sofa](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa), [Glass Vase](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlassVaseFlowers), [Lantern](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern): per-asset authors and licenses.
- [Bundled notice](../public/licenses/furniture.txt) and [CC BY 4.0 legal text](https://creativecommons.org/licenses/by/4.0/legalcode.en).

Verified lessons are stored once in SecondBrain: imported furniture lighting and
cached shadows; repeat normalization without node reindexing. The report is the
project evidence source, not a replacement memory store.
