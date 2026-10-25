# IKEA product loop — 25 October 2026

## Design and scope
The decision is whether another real-sized piece works in this room, before
changing the drawing. Reference: IKEA Kreativ's public room builder and product
replacement workflow. The room/model remains dominant; a compact catalogue
holds the target, dimensions, fit result and Apply/Cancel actions. Existing
Source Sans 3/JetBrains Mono, four palettes and differentiated drawing pens.

Invariant: a trial never changes PlanState, history, quantities, city, solar
inputs or saved studies. Apply replaces exactly one furniture identity with
its chosen catalogue dimensions; Undo restores exactly the previous object.

## Evidence and prior art
- https://www.ikea.com/us/en/home-design/ — observed quick-start, custom room,
  photo-room and furnished/empty room entry choices in the native browser.
- https://www.ikea.com/us/en/home-design/room-builder/ — observed six shapes,
  wall/ceiling dimension setup and door/window style/size/position setup.
- IKEA Kreativ published help documents adding/swapping, moving and rotating
  products. Furniture-workspace observations will be recorded separately from
  documentation; no private API, vendor bundle, models or artwork are copied.
- https://github.com/nickorzha/threejs-room-planner — public prior art for one
  room model with 2D/3D product configuration. Method only; no code/dependency.

## Proposed surgical changes
- New pure replacement helper and tests: exact dimensions, centre/orientation,
  room-wall containment, furniture/door conflicts, refusal without mutation.
- Existing catalogue: explicit target room, fit filtering and replacement mode;
  preview selection is inert, Apply/Cancel explicit. Preserve direct Add.
- App: own the temporary replacement and commit through existing history;
  pass the trial only into local 3D, keep all analysis on the accepted drawing.
- Spatial3D: replacement action, trial notice, disable editing/capture while
  trying; retain orbit/presets/sun controls and cached physical shadow updates.
- Scoped catalogue CSS, keyboard dismissal/focus and no new full-width bands.

## Sacred items
No schema/dependency/provider change. No deleted canvas, chart, view, tool,
licensed asset or authored sample. No file reduced by30%. Existing units,
opening wall-point convention, physical meshes and manual cameras preserved.

## Verification
Unit refusal/identity/containment cases; browser trial/cancel/apply/Undo/share,
selection of a target room from3D, no API calls and capture blocked during trial.
Screenshots1440/1024/390, four themes, independent flaw-seeking review. Full
lint/type/unit/Worker/browser gates, commit/push, gated deploy and exact live
asset/workflow verification. Existing rectangular rooms and quarter-turn poses
remain limits; this does not claim IKEA catalogue/scan parity.

## Direct furnishing observation
The native browser reached the actual furnishing workspace on25October. Added
a STORKLINTA dresser in a synthetic rectangular room, selected its actual3D
object, inspected Item options (rotate, swap, copy, remove), then swapped to a
wider STORKLINTA through Swap with similar. The price changed229.99→279.99 and
Revert to original appeared. Top view was available in the same room. Product
colour variants and Dollhouse/Side views, measurements and Edit room were
visible. No checkout, account, user photo or personal data was involved. This
is observed behaviour, beyond the earlier help-only furnishing evidence.

## Review corrections
The first rendered inspection strip overlapped the accepted technical snapshot
and sun controls at1440x900. Inspection actions now participate in Spatial's
normal document flow, and a browser containment assertion checks they finish
before the solar dock. Explicit product replacement opens Solid so catalogue
meshes are visible, while all drawing styles remain available. Removing the
disabled selection row during trials regenerates its controls onCancel; focus
restoration targets the newReplace action if the original element disappeared.
Global drawing shortcuts are suspended with the catalogue open; leaving via
Plan/Renders or journey navigation cancels the trial.
