# Release reconciliation — 26 October 2026

Invariant: accepted geometry, physical dimensions, city and solar inputs remain
shared by plan, local3D, analysis, history, save/share and study sheets. A refused
edit must not create geometry or consume an Undo step. The model owns the space;
controls remain operable outside its viewport.

## Inventory and decisions

| Work | Audit decision |
| --- | --- |
| MiniMax984e3df on main | Retain content-sized bottom surface, bounded canvas width, phone toolbar scrolling, visible primary sun metric. Its CI40242528692 failed; a pushed commit alone was not a release. |
| Seven uncommitted files | Preserve launcher-containment tests and corrected science-dock selectors. Fix the gallery overlay; retain Previous/Next in the thumbnail row under the no-deletion rule. Remove obsolete floating CSS. |
| Cursor draft PR6, headfd6a2e8 | Conflicting108-file draft; extract bounded wall-hosting idea, independently implemented and credited. Keep remaining branch available; no whole-snapshot merge. |
| Recover branch857e2f7 / closed PR5 | Already audited in RECONCILIATION-2026-10-15.md. Keep bounded pencil resolver and overshoot fixtures already on main; retain original recovery branch. |
| PRs1–5 |1/4 merged;2/3/5 closed. No additional open PR beyond6 at audit start. |

## PR6 useful work, limits and deferred items

- Wall hosting: use24screen pixels rather than plan-percent reach; clamp the
  entire physical width to the chosen wall. Improve the draft helper's
  half-width clamp: a wall shorter than the aperture is rejected, never silently
  accepted. Current one-shot tool behavior is preserved.
- Existing main already has independent browser-zone default location,
  worldwide search/manual coordinates, retained shared cities, actual local
  shadows, measured replacement trials, calibration and study sheets. Retain
  these newer implementations and their tests.
- The branch's DOM translation layer rewrites React text/attributes after
  rendering. Do not import it wholesale; multilingual UI needs explicit owned
  strings and complete interaction tests. No full Thai/Chinese support claimed.
- The branch's continent/timezone currency mapping is not a local rate source
  (America includes countries using other currencies). Preserve explicit rate
  cards and their stated scope instead of claiming worldwide local prices.
- The branch's latitude temperature cosine is an assumption, not measured city
  climate. Retain user-controlled outside temperature; no forecast claimed.
- Broader room-tool, metadata, icon and header rewrites need separate comparison
  with current measured controls. No newer tool, scene or palette is replaced.

## IKEA and open-source reference

Public source: https://www.ikea.com/us/en/home-design/ and room-builder entry.
Direct behavior observed25October is recorded in
IKEA-PRODUCT-LOOP-2026-10-25.md: draw/measure a room, add actual-size products,
orbit/top view, swap/revert. This audit verifies our implementation, because
IKEA's customer testing does not prove our geometry or integration correct.
No vendor assets, private API or production bundle copied. Existing credited
Three.js, SunCalc and catalogue licensing remain intact; no dependency added.

## Gates

Independent pixel review found two further defects:1024px Spatial/Renders
toolbar wrapped to112px (including a row for section cut alone), and the empty
room callout overlaid the footer. Extend deliberate toolbar scrolling through
1100px, reclaiming72px, and put the preserved empty-state action in normal flow
under the model in both views. New browser gates assert both repairs.

Opening unit fixtures cover corners, real dimensions, pixel reach after resize,
off-wall/undersized-wall refusal and input immutability. Real browser cases
check corner placement, off-wall refusal and Undo/Redo. Existing whole-suite
tests cover rendering, shadows, cities, quantities, captures, furniture trials,
drag cancellation, sharing, accessibility and responsive density.

The new gallery check probes actual launcher hit targets in both Spatial and
Renders. Independent screenshots/review are required at1440/1024/390 before
release. Ship only after lint/type/build/unit/Worker/browser/security gates,
then verify primary and mirror build bytes plus live changed interactions.

## Remaining scope

The first complete CI run40262098235 passed289 browser cases but caught one
additional failure: after selecting furniture, the footer grew40px before
R3F's ResizeObserver updated the canvas's inline pixel height. Its DOM surface
temporarily extended into the control row. Keep the canvas's CSS display size
at100% of the model immediately; retain the original strict containment and
painted-geometry assertions, with no sleeps or relaxed tolerances.

Rectangular rooms, quarter-turn furniture and the small licensed catalogue
remain deliberate implementation limits; no scan/photo reconstruction parity
with IKEA is claimed. Existing Plan room-key/coach footprint and tablet toolbar
wrapping remain audit targets, not cleared by passing font/colour checks.
