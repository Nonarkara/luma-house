# Building-science usability audit

Date: 30 July 2026  
Scope: sketch → scaled plan → spatial model → sun, heat, air, egress and value decisions  
Status: implementation audit plus the first production-facing remediation

## Executive finding

The product has the right emotional sequence, but the science was still organized like a set of destinations. A person does not want to “go to ventilation”; they want to move a window and immediately understand what changed, whether the change is worth keeping, and what remains unknown.

The recommended product grammar is therefore one contextual comparison layer:

1. **Where** — show the consequence directly on the plan or 3D model.
2. **Why** — expose the smallest useful equation or rule.
3. **Value** — state the lived/aesthetic, technical and expense consequences together.
4. **Confidence** — label the output as measured, modeled, reference-only or geometry-only.
5. **Next move** — eventually let the person apply or compare the suggested change without leaving the view.

The implemented **Value Lens** has five live layers: Windows, Shade, Air, Escape and Envelope. It is local, deterministic and dependency-free. Its current remediation and reported-work findings are detailed in [GROK_45_IMPLEMENTATION_AUDIT.md](./GROK_45_IMPLEMENTATION_AUDIT.md). The ordinary 2D application remains about 101 kB gzip; the 3D engine remains lazy-loaded.

## What was audited

- First-run welcome and the seven-decision sequence
- Drawing, scale calibration, room/opening placement and editing
- Plan, spatial and render views
- Sun patches, solar position, heat-flow snapshot and science disclosure
- Existing ventilation, overheating, thermal and suggestion models
- Existing BOQ and the link between recommendations and costs
- Mobile use at a 390 × 844 viewport
- Build size, calculation complexity, tests and loading boundaries
- The evidentiary basis for daylight, wind, shading, envelope and escape claims

## Highest-priority findings

| Priority | Finding | Why it matters | Resolution / next action |
|---|---|---|---|
| P0 | Environmental results were scattered across stages and inspector panels. | A user could not compare a design move where it was made. | Added a single in-canvas Value Lens with a common decision grammar. |
| P0 | The prior ventilation score counted walls with openings but ignored wind direction, speed, pressure and downstream outlet continuity. | “Cross ventilation” could look strong for a wind that produces almost no pressure separation—or no outdoor outlet. | Added a pressure-oriented airflow graph across real exterior apertures and modeled internal doors. Keep it concept-only until terrain, obstructions and opening data exist. |
| P0 | Escape was not represented as a connected system. | A door symbol did not prove that a room could reach outdoors. | Added a door graph, approximate route centerlines and an explicit geometry-only warning. |
| P0 | Some thermal and annual overheating outputs are more precise than their inputs justify. | Latitude bands and synthetic weather can be mistaken for a load calculation. | Do not promote these values in the primary lens. Replace with real weather before using annual hours or bills as decision claims. |
| P1 | Insulation and low-SHGC glass are coupled behind one boolean. | The app cannot say which intervention created the benefit. | The lens describes the current comparison honestly. Split wall, roof, glazing, airtightness and shading assemblies next. |
| P1 | All windows and doors use fixed hidden dimensions. | Airflow, solar and conduction can change materially with opening size and operability. | Add visible width, height, sill/head height, operable fraction and glazing properties to opening data. |
| P1 | Cost began as a static sample BOQ unrelated to user geometry. | “Worth it” could not become even a concept financial comparison. | The BOQ now responds to area, openings and systems, and the lens exposes narrow allowances. Add regional editable ranges and weather/tariffs before claiming payback. |
| P1 | A four-hour direct-sun threshold is used across climates and orientations. | Desirable winter sun and harmful cooling-season sun are not the same. | Replace it with occupied-hour, season and heating/cooling intent. |
| P1 | Room rectangles and compass-level exterior walls simplify partial shared boundaries. | Irregular plans can misattribute an opening or exposed façade. | Shared length is now unioned correctly; next store explicit exterior wall segments and opening offsets. |
| P2 | The mobile lens is a scrollable bottom sheet over a short canvas. | It preserves the plan but only the decision summary is visible at first. | Correct for first release; later add a one-swipe collapsed/expanded state and keep the selected room visible above it. |
| P2 | The interface uses small technical text in places. | Method details are accessible but demanding on a phone. | Keep headline copy at plain-language level; reserve formulas for expandable method sections. |
| P2 | The 3D chunk is approximately 250 kB gzip and 936 kB minified. | It is the dominant download if the user asks for 3D. | Lazy loading already protects drawing. Later isolate controls, load lower-detail geometry first and measure real-device interaction latency. |

## The implemented decision views

### 1. Windows: useful daylight reach

**Question answered:** Does this window put useful daylight where the room needs it, or only brighten the edge?

**Visualization:** a clipped, window-centered translucent zone extends inward from each exterior window. Moving a window changes its zone and overlap. The summary reports the approximate share of room plan inside at least one zone and identifies rooms with no exterior daylight.

**Current model:**

```text
reach = 1.5 × window head height
zone width = assumed opening width + indicative lateral spread
plan coverage = sampled room area inside any window-centered zone
```

The conservative 1.5 multiplier comes from Lawrence Berkeley National Laboratory early-design guidance; 1.5–2 times head height is a rule of thumb, not a photometric result.

**What it can teach now**

- Higher window heads usually send daylight deeper.
- A window can have value beyond its area: placement affects distribution and the dark back of the room.
- Moving a window is cheap in a sketch and expensive after structure, façade and waterproofing are fixed.

**What must come next**

- Store actual head/sill height, width, visible transmittance and external obstruction angle.
- Add a low-resolution daylight coefficient grid in a Web Worker.
- Show glare risk separately from useful diffuse light; never turn “more light” into an unconditional score.
- In 3D, project daylight on workplanes and eye-level view zones rather than coloring an entire room.

### 2. Shade: stop the beam before the glass

**Question answered:** Is direct sun useful at this time, and how much heat could an external control prevent?

**Visualization:** the existing sun patch remains spatial. The lens adds current transmitted solar power and a clearly stated external-shade comparison.

**Current model:**

```text
solar heat = direct irradiance × glass area × SHGC × incidence
comparison benefit = current solar heat × 80% assumed direct-beam blockage
```

The 80% value is a visible scenario assumption, not a product rating. It allows a quick A/B comparison without claiming an annual saving.

**Better geometry for the next iteration**

Use solar profile angle rather than altitude alone:

```text
tan(profile angle) = tan(solar altitude) / cos(horizontal shadow angle)
required projection ≈ vertical distance to shade / tan(profile angle)
```

This explains why a horizontal overhang can control high sun on a suitable façade while low east/west sun often needs fins, screens, shutters or vegetation.

**Education sequence**

1. Show the ray and sun patch.
2. Let the user drag shade depth in section/3D.
3. Show “view kept,” “daylight kept,” and “direct beam blocked” as separate outcomes.
4. Compare fixed shade, operable external screen, interior blind and lower-SHGC glass. Interior blinds can control glare but do not stop heat before it enters as effectively as external shade.

### 3. Air: orientation-driven ventilation

**Question answered:** For this wind, is there a high-pressure inlet, a lower-pressure outlet and a clear path between them?

**Visualization:** arrows cross rooms where a pressure path exists. Rotating the wind can make a good path disappear, teaching resilience rather than rewarding opening count.

**Current model:**

```text
wind pressure difference = ΔCp × ρ × wind speed² / 2
equivalent opening area = 1 / √(1/Ain² + 1/Aout²)
flow potential = Cd × equivalent area × wind speed × √|ΔCp|
```

Representative early-design pressure coefficients and fixed operable areas are used. A raw full-open ACH is deliberately not the headline: with large openings and a design wind, that ideal capacity can be very high and is easy to misread as a prediction.

**What it can teach now**

- Opening count is not airflow.
- Openings on pressure-separated faces are more useful than two openings on the same pressure zone.
- The internal route matters; a closed bedroom door can break the path.
- A plan should be tested across several common wind directions, not optimized for one arrow.

**What must come next**

- Ask for prevailing and seasonal wind roses, ideally from an EnergyPlus weather file or a local weather service.
- Add terrain/exposure class, surrounding obstruction, opening size, operable fraction, insect screen and secure-night-opening limits.
- Extend the implemented door-connected airflow network with transfer grilles, cracks and explicit operable opening data.
- Separate **comfort ventilation** from **minimum indoor-air-quality ventilation**. Wind is intermittent; an ERV/exhaust strategy may still be needed.
- Display a wind-rose robustness score: percentage of common wind hours that preserve at least one usable path.

### 4. Escape: get out of every room

**Question answered:** Is there a continuous modeled door path from this room to outdoors?

**Visualization:** route centerlines end at an exterior door; amber-hatched rooms have no modeled path.

**Current model:** a shortest-path search on a graph of rooms connected by doors. Length is an approximate centerline through door and room centers.

**Critical boundary:** this is not a code or life-safety verdict. It does not know jurisdiction, occupancy, travel-distance rules, clear width, locking, accessibility, fire resistance, smoke, stairs, escape windows or door swing. The UI says “geometry only” and links to one authority as an example—not as a universal standard.

**What must come next before any compliance language**

- User selects jurisdiction and building/occupancy type.
- Rule packs are versioned, dated and source-linked.
- Validate door clear widths, swing, hardware and furniture conflicts.
- Model protected routes, level changes, stairs, final exits and alternative escape where required.
- Require professional sign-off for any “passes code” state.

The current sample exposes a real modeling problem: only the entry room reaches the exterior entry door through explicit door objects. The rest of the apartment needs modeled openings/open-plan connections before the app should imply a continuous route.

### 5. Envelope: better assembly and better installation

**Question answered:** At the same indoor/outdoor temperature, how much heat transmission changes when the shell improves?

**Visualization:** exposed walls are highlighted; baseline and upgraded transmission are compared in watts at the current weather snapshot.

**Current model:**

```text
conductive heat = U-value × exposed area × (outside temperature − inside temperature)
baseline wall U = 2.10 W/m²K
upgraded wall U = 0.45 W/m²K
```

**What it can teach now**

- Continuity matters: nominal insulation is not installed performance.
- Gaps, compression, thermal bridges and air paths can erase theoretical value.
- Surface comfort, condensation resilience and quiet may be valuable even when energy payback is slow.
- Envelope work is most economical when coordinated with work already opening the wall, roof or façade.

**What must come next**

- Separate roof, wall, floor, glazing, doors, airtightness and thermal bridges.
- Store complete assemblies and allow side-by-side U-value, thickness, embodied carbon and moisture-risk comparisons.
- Add climate-specific condensation checks; do not recommend interior insulation generically.
- Treat installation quality as an input/range, not a footnote.

## How “worth it” should be calculated

The current lens gives an area/opening/system-responsive concept allowance for a new opening and envelope upgrade. It still lacks location-specific editable rates, a real weather year and tariffs; numeric saving or payback now would be fabricated precision.

The production model should add a user-editable **Value Study** with these layers:

### Capital cost

```text
intervention cost = quantity from geometry × local low / likely / high unit rate
                    + access / enabling work
                    + design / approvals
                    + contingency
```

Every rate must expose currency, region, date, source and whether tax/labor/access are included.

### Annual operating effect

Run an hourly comparison using an EPW weather file:

```text
annual cooling electricity avoided = Σ(max(0, cooling-load baseline − option) × timestep / seasonal COP)
annual heating electricity avoided = Σ(max(0, heating-load baseline − option) × timestep / seasonal COP)
```

Natural ventilation should only offset cooling when outdoor temperature, humidity, pollution, noise and security constraints permit it.

### Financial value

```text
net present value = present value of energy + maintenance savings − capital cost − replacement cost
simple payback = capital cost / first-year operating saving
```

Show a range, not a single number. Allow the person to change tariff escalation, discount rate, service life and replacement assumptions.

### Non-energy value

Do not force all value into money. Report separately:

- useful daylight coverage and glare hours
- hours when natural ventilation is viable
- direct-sun hours in occupied zones
- mean radiant/surface comfort
- acoustic/privacy/view effect
- escape connectivity and unresolved safety checks
- embodied carbon and material quantity

The decision card should end with one of four states:

- **Do now** — high benefit, low regret, cheaper before design locks.
- **Compare** — meaningful benefit but sensitive to cost or climate.
- **Verify** — promising, missing a decisive input.
- **Do not justify yet** — weak benefit under the current scenario.

## Usability architecture

### Preserve the sketch-to-reality speed

- All early checks remain synchronous, local and under a few hundred operations per room.
- Recalculate only the active lens and memoize by plan and environmental inputs.
- Keep 3D and later annual simulation out of the drawing bundle.
- Use progressive fidelity:
  - **Instant:** geometry rules and steady-state comparisons.
  - **Fast background:** hourly weather, low-resolution solar/daylight grids in a Worker.
  - **Deliberate:** EnergyPlus/CFD/code review, requested explicitly and cached.
- Never block drawing on location lookup, weather download, AI or cloud simulation.
- Cache results by a hash of geometry + assemblies + weather + scenario.

### Visual hierarchy

- Keep the plan as the primary evidence; the panel explains rather than replacing it.
- Use amber for the active analytical layer, hatch/dash for unresolved routes, and neutral gray for unavailable data; do not make color alone carry meaning.
- Avoid one composite “green score.” Good daylight, low cooling load, view, privacy and escape can conflict.
- Use the same three value rows everywhere: **Aesthetic + lived**, **Technical**, **Expense**.
- Put assumptions behind a Method disclosure but keep the confidence label always visible.

### Mobile

- The five lens targets are 48 px tall and the close target is 44 px.
- The lens is a scrollable bottom sheet, leaving part of the plan visible.
- Next iteration: two detents. The collapsed state shows metric + verdict; expanded state shows the value rows and method.
- Keep the selected room above the sheet using automatic pan only after the person chooses a room; never fight manual pan/zoom.

## Accuracy ladder and language policy

| Level | Required input | Allowed language |
|---|---|---|
| Geometry rule | scale, rooms, explicit openings | “connected,” “inside indicative reach,” “orientation opportunity” |
| Concept physics | geometry plus visible assumptions | “comparison,” “potential,” “at this hour” |
| Weather model | geometry, assemblies, EPW, schedules | “modeled annual range” |
| Compliance model | jurisdiction, occupancy, verified dimensions, rule version | “check result,” never professional certification |
| Professional model | verified survey, engineer/architect inputs | exportable calculation/report with author and revision |

Forbidden from sketch-only data: “compliant,” “safe,” “will save X,” “will be X °C,” “needs an X kW AC,” or a guaranteed payback.

## Verification completed

- 107 unit tests pass across 19 files, including uniform scale calibration, shared AI quota, WASD movement, window-centered reach, connected wind paths, door-to-outside connectivity and partial shared-wall length.
- TypeScript production build passes.
- Desktop visual test completed with the sample plan and each contextual control.
- 390 × 844 phone test completed; layer targets are usable and the sheet scrolls to all content.
- No new runtime package or network dependency was added.
- Main JavaScript: approximately 314 kB minified / 101 kB gzip.
- 3D remains a separate lazy chunk: approximately 936 kB minified / 250 kB gzip.

## Recommended delivery sequence

### Release 1 — now

- Ship the Value Lens as concept education after project-specific review.
- Fix the sample apartment’s missing route/open-plan connections.
- Split the envelope boolean into wall and glazing assumptions.
- Add opening width, height, head height and operable fraction.
- Keep all confidence and exclusion language.

### Release 2 — trustworthy local context

- Location-driven EPW file and seasonal sun/wind summaries.
- User-editable unit-rate ranges linked to geometry.
- Low-resolution annual shade/daylight/thermal comparison in a Worker.
- Wind-rose robustness rather than one wind direction.
- A/B option pinning: “current” versus “proposed.”

### Release 3 — professional bridge

- Explicit wall segments, assemblies and obstruction geometry.
- Export model assumptions, quantities, sources and unresolved checks.
- Versioned jurisdiction rule packs for assisted review.
- EnergyPlus/OpenStudio adapter for annual loads; validated airflow network before CFD.
- Professional handoff instead of pretending the sketch is construction documentation.

## Primary technical references

- [NIST — Application of Natural Ventilation for U.S. Commercial Buildings](https://nvlpubs.nist.gov/nistpubs/gcr/2001/gcr01-820.pdf)
- [Lawrence Berkeley National Laboratory — Tips for Daylighting](https://eta-publications.lbl.gov/sites/default/files/tips-for-daylighting-2013.pdf)
- [U.S. Department of Energy — Building envelope heat flow](https://bsesc.energy.gov/energy-basics/building-envelope-building-science-intro-heat-flow)
- [U.S. Department of Energy — Window U-factor and SHGC](https://www.energy.gov/cmei/femp/purchasing-energy-efficient-residential-windows-doors-and-skylights)
- [NREL — Passive Solar Technology Basics](https://www.nrel.gov/research/re-passive-solar.html)
- [UK Government — Approved Document B, fire safety](https://www.gov.uk/government/publications/fire-safety-approved-document-b)

These sources support the physics and reference rules. They do not convert the current sketch model into a jurisdiction-specific design, energy rating or safety certification.
