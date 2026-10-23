# Correcting the rejected property-sheet geometry

The owner rejected runtime031a3e2's preview despite its fitting the viewport.
That review was correct: stacked labels, full-width numeric fields and a blanket
44px phone input minimum still imposed unnecessary space. Viewport fit alone
was the wrong acceptance test for box density.

This correction uses a CAD-style label/value schedule. Name, Width/Depth and
Height are three short rows. Calibration follows the primary edits. Numeric
boxes fit their expected digits; Name fits22characters. Dense controls are32px,
per the workspace's MSH rule. The existing13px value text is unchanged. Room
metrics, standards references, code findings and every action remain present.
No information is hidden to achieve the smaller primary editor.

## Rendered comparison

Same50m² sample, Quiet bedroom, same browser viewports and actual DOM rectangles.
Before is the deployed031a3e2; after is this candidate production build.

| Phone390×844 | Before | After |
|---|---:|---:|
| Panel width |360px|300px|
| Width input |161×44px|81.45×32px|
| Height input |334×44px|64×32px|
| Room heading through Height |327px|140px|
| Height field bottom |511.8px|256.8px|
| Value type |13px|13px|

The primary room editor is57% shorter. The width box occupies63% less area;
the height box86% less. On1440×900, the same room editor is140px instead of295px;
the panel is300px instead of344px. The drawing receives those reclaimed pixels.

The gallery checks390×844,1024×900 and1440×900 in all four palettes. Assertions
bound actual field width/height, preserve minimum value type, require primary
fields to remain grouped within150px, and contain each approximation marker
inside its own input. These checks catch a regression that “fits on screen”
missed. Save/reload/Undo, scale refusal, known-length calibration and focus/error
states remain covered by the existing browser flows.

Fresh independent review inspected all palette phone views, tablet/desktop and
expanded/focused calibration. It confirmed the reduction and no clipping or
wrapping in the selected arrangement. A marker-positioning defect found during
visual review was fixed and received its own containment assertion. A trial
wider label track wrapped dimensions; the compact proven track was retained.

The code-findings list may scroll: it contains substantive building guidance.
This correction covers the plan property sheet, not a claim that every other
workspace surface has completed an MSH audit.
