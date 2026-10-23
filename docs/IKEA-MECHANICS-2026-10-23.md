# Furnishing mechanics: IKEA study and implementation

## Scope and decisions

The owner authorized improving the complete draw/furnish/inspect workflow. This
pass closes the disconnected furnishing loop without replacing the room model.
No account, image generation or external furniture service is required.

## Sources, patterns and credit

| Source | Public pattern | Designon implementation |
| --- | --- | --- |
| [IKEA Kreativ](https://www.ikea.com/us/en/home-design/) and its [room builder](https://www.ikea.com/us/en/home-design/room-builder/) | Establish the room before furnishing; edit its dimensions | Keep the existing drawing and measured-room tools; additions target the selected room |
| [IKEA Kreativ help](https://support.home-design.ikea.com/hc/en-us/articles/360038999793-What-can-I-design-in-my-space) | Select, move, rotate and duplicate a placed item | Direct local 3D editing plus the same saved furniture objects used by Plan |
| [Blueprint3D](https://github.com/furnishup/blueprint3d) | One model shared by the floor plan and editable perspective | Retain PlanState as the authority; commit one edit per drag |

Observed IKEA's public room-builder entry in Chromium: six room shapes followed
by the dimension-editing instructions (drag walls and toggle ceiling height).
The next rendered state rejected this browser's device/graphics setup; furniture
interaction beyond that point is documented behavior, not an observed session.
Marketing/help claims are distinct from observed flows.
No vendor source, private APIs, product models or artwork are copied. Blueprint3D
is prior art for the method; no dependency or source is imported from it.

## Preserved behavior

Measured mesh identity, physical dimensions, fallback boxes, existing palettes,
room calibration, opening geometry, local solar shadows, comparison, saved
views, print sheets, Undo, save/share and the landing guide remain available.
No file is reduced by 30%; no working canvas or chart is removed.

## Proposed changes

- `src/canvas/furniturePlacement.ts`: bounded placement into rooms, preserving
  dimensions, avoiding occupied footprints and existing door clearance rules.
- `src/App.tsx`: use placement for both catalogues and duplication; share edit
  callbacks between Plan and Spatial.
- `src/canvas/SpatialFurniture.tsx`, `Spatial3D.tsx`: floor-plane dragging,
  selection, a compact accessible selection/action row, live shadow geometry.
- `src/study/CameraRig.tsx`: fitting depends on building bounds, not furnishing
  edits. An explicit fit action remains available.
- Scoped CSS: content-sized controls outside the model viewport.

## Verification

Unit checks for bounded placement, rotation, full rooms and door conflicts;
browser journeys for catalogue-to-selected-room, direct 3D movement, cancellation,
rotation, duplication, Undo/save/share and camera stability. Inspect rendered
controls at 390, 1024 and 1440 pixels, obtain independent review, run the release
gates, deploy and verify the actual live workflow and bytes.

## Limits

This is a first mechanics pass, not a claim of IKEA catalogue or scan parity.
Existing rooms are rectangular volumes; arbitrary polygon walls, imported IKEA
products, arbitrary-angle furniture rotation and photogrammetry are separate work.

## Audit results and closed findings

- Seven placement tests pass; the complete local unit suite passes 605 cases in
  74 files with two workers. The unrestricted local run hit seven timing limits
  under workstation load; the bounded rerun passed without changing assertions.
- The first local browser journeys passed drawing a closed room, placing a
  measured sofa, floor dragging, Undo, rotation, safe duplication, save/share and
  cancellation without an extra history entry. The release workflow exercises
  the final build, including mesh hit testing and shadow invalidation.
- Independent review found a clipped phone camera button: bounded, wrapping
  groups and shorter visible Fit/Walk labels repair it without removing tools.
- Independent review found a collapsed R3F viewport: the model now has a definite
  height and an absolutely positioned renderer wrapper.
- Independent review found solar controls overlapping the study controls:
  intrinsic section sizing removes the percentage-height cycle. The summary
  starts exactly after the whole model section; study actions pass hit testing.
- Independent review found a disappearing model after phone-to-desktop resize:
  both owned cameras opt out of R3F's automatic pixel frustum. Building, furniture
  and shadows remain drawn at 390, 1024 and 1440 pixels. This verified lesson is
  captured in shared memory on 2026-10-24.
- Rules 1–7: content-sized utility controls; model remains the focal surface;
  short copy; existing two fonts and palettes; no copied artwork or ornament;
  hierarchy retained; no clipped controls or sibling overlays in reviewed views.
  Study actions and sun metadata share a compact footer rather than separate
  full-width bands.

CI is the final release authority for lint, strict types, app/Worker security and
the complete browser suite. Production must additionally pass live workflow and
asset verification; a local build or Git push is not a deployment.

The saved-camera regression deliberately captures while orbit inertia is still
pending: Save settles that movement before recording. Waiting for idle first
avoids exercising this guarantee and can stall on a slower software GPU. The
direct capture/edit/capture journey passes on the live custom domain at both
desktop and phone widths, with saved positions matching to three decimal places.
