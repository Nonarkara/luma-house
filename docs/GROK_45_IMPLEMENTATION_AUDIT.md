# Reported-work implementation audit

Date: 30 July 2026  
Scope: uncommitted guided-tour, condition, walk-mode, 3D-vector, shortcut, Value Lens, calibration, and cost changes  
Verdict: the interaction ideas were worth retaining, but several reported capabilities were placeholders or visually convincing claims without the required data path. Those claims were removed or replaced before acceptance.

## Acceptance invariant

Every added control must shorten this chain:

```text
rough mark → shared real scale → spatial consequence → decision value → disclosed uncertainty
```

A feature does not pass because it has a button, animation, test snapshot, or plausible number. It passes only when its output changes from the user’s current geometry and inputs, does not invent missing facts, and leaves drawing performance intact.

## Claim-by-claim audit

| Reported capacity | Authoritative finding | Resolution |
|---|---|---|
| Guided 3D tour | Chapters contained sample identifiers, budgets, systems, and targets unrelated to the active drawing. | Rebuilt as four chapters generated from the current plan: scale, volume, sun/heat, and routes. Blank plans cannot emit sample facts. |
| Walk mode | Pointer lock existed, but there was no WASD movement. | Added frame-rate-independent WASD movement at 2.2 m/s, eye height 1.6 m, field clamping, keyboard cleanup, and pure movement tests. The UI discloses that concept walk has no wall collision. |
| Wind vectors | Arrows crossed openings without proving a pressure-separated path. An interior door could stand in for a nonexistent outdoor outlet. | Replaced with a door-connected airflow graph. A room receives a path only when two actual exterior apertures with different pressure coefficients are connected through modeled doors. Series opening area is included; doors are explicitly assumed open. |
| Thermal tint | Room colors were assigned from room type, not computed temperature. | Removed. The current heat comparison stays in watts and disclosed components until a defensible spatial temperature model exists. |
| Climate scenarios | Cards included invented batteries, HVAC, glazing ratios, costs, and “optimal” states. | Replaced with four explicit what-if input sets evaluated at the current project latitude and current drawing. They are labeled as comparison inputs, not weather records or code simulations. |
| Keyboard help | The modal listed shortcuts that did not exist. | Reduced to implemented commands only: T, G, WASD, ?, Esc, Delete, undo/redo, and arrow nudge. |
| Top-bar controls | Tour, conditions, walk, and help competed with project/share/export actions globally. | Tour, conditions, walk, sun rays, and air paths now live inside 3D, where their consequences are visible. The top bar retains only global project actions and help. |
| 3D vector materials | Per-render geometries and materials were not disposed. | Vector line resources now dispose on cleanup. Sun vectors are limited to exterior windows. |
| Daily AI limit | AI trace checked the shared quota but did not decrement the browser-visible count. | Successful traces and concept images now consume the same visible three-use quota; failures do not consume it. |
| Design-system fit | New surfaces added rounded cards, shadows, and cyan/green/red analytical colors. | Reworked the added tour, scenario, shortcut, calibration, and analytical layers to sharp edges, no decorative shadow, and one amber semantic accent. Missing-route state uses hatch/dash rather than a second color. |

## Additional defects found during the journey audit

### Scale was described, not completed

The welcome screen told users to type one real dimension, but editing a room dimension resized only that room. It did not calibrate the drawing.

The selected-room inspector now has a **One known measurement** action. If a room occupies share `s` of a normalized axis and its real dimension is `d`, the field dimension is:

```text
field dimension = d / s
uniform scale = new field axis / previous field axis
```

Both field axes change by the same scale factor, preserving real-world aspect ratios across every room and opening. The result is rounded only for usable display. The calibration card is immediately below shared scale on phone and desktop.

### Window placement did not change the daylight picture

The initial daylight layer filled a band across an entire wall whenever any window existed on it. Moving a window along that wall had no effect.

Each exterior window now creates its own clipped, window-centered reach zone. The depth remains the conservative `1.5 × head height` reference rule. A visible 1.6 m opening-width assumption plus indicative lateral spread makes placement and overlap matter without claiming illuminance.

### Opening placement was blocked by the room layer

The room button swallowed clicks while the window or door tool was active. Placement now bubbles to the snap-to-wall logic. The tool returns to Select after a completed room stroke, preventing accidental additional rooms.

### Sample content could overwrite a user sketch

A blank user plan inherited Shanghai style keywords and three sample “generated directions.” Applying one replaced the user’s rooms with the sample apartment. Sample variants and style language are now scoped to the authored sample only. Blank and traced projects are titled **Untitled sketch** and export with generic identity.

### The BOQ did not follow the drawing

The authored 50 m² BOQ kept most of its cost when the plan was blank or a different size. It now scales from measured area, opening count, and selected lighting/climate/envelope/solar systems. The 50 m² sample remains the calibration anchor. Blank geometry returns zero cost.

The Value Lens exposes two deliberately narrow deltas:

- an added-opening unit allowance, excluding structure and façade repair;
- an area-scaled envelope/air-sealing allowance including contingency.

Neither is called a quote, saving, or payback.

### Mobile science controls obscured the model

At 390 px the full science dock consumed most of the available 3D height. It now defaults to a compact strip showing sunlit floor and net heat. **Adjust** expands time, season, outside temperature, and method. Guided tour and condition launch clear the room-height selection so 3D controls cannot sit above their overlays.

## Scientific scope retained

| Layer | Present answer | Explicitly not claimed |
|---|---|---|
| Daylight | indicative window-centered plan reach | lux, glare, sky/obstruction/finish effects |
| Shade | current direct-beam comparison at an explicit 80% blocking assumption | annual savings or universal shade geometry |
| Wind | pressure-separated path through real exterior apertures and modeled open doors | CFD, terrain, gusts, screens, security, comfort or IAQ guarantee |
| Escape | shortest approximate door-graph centerline to an exterior door | code compliance, fire/smoke protection, clear width or accessibility |
| Envelope | steady-state wall/opening transmission at the current temperature difference | roof/floor/infiltration/thermal bridges, annual load or AC sizing |
| Cost | geometry/system-responsive concept allowance | tender price, local quote, tariff saving or payback |

## Performance and verification evidence

- 107 unit tests pass across 19 files.
- ESLint passes with zero warnings.
- TypeScript production build passes.
- Main JavaScript: approximately 314 kB minified / 101 kB gzip.
- Lazy 3D chunk: approximately 936 kB minified / 250 kB gzip.
- The drawing bundle still avoids loading Three.js until Spatial is requested.
- No new runtime dependency was added.
- Desktop interaction verified: first-run, blank draw, uniform calibration, window placement, daylight update, wind path, exterior-door escape, envelope apply/revert, 3D, tour, conditions, and walk state.
- Phone interaction verified at 390 × 844: welcome, blank drawing, priority calibration, Value Lens, compact/expanded science controls, guided tour, and condition cards.

## Remaining boundaries before professional claims

1. Store opening width, height, sill/head, operable fraction, glazing properties, screen resistance, and secure-open limits.
2. Store explicit exterior wall segments and irregular/non-rectangular geometry.
3. Split the single envelope boolean into walls, roof, floor, glazing, airtightness, and thermal bridges.
4. Use an EPW weather year plus schedules before annual comfort, energy, bill, or payback language.
5. Add terrain and surrounding obstruction before stronger ventilation claims; use CFD only as an explicit slower fidelity.
6. Add jurisdiction, occupancy, verified clearances, stairs, fire/smoke data, and versioned rules before compliance language.
7. Replace sample-derived CNY allowances with user-editable regional low/likely/high rates, dates, sources, access, tax, and procurement scope.
8. Add an A/B option pinning workflow so users can preserve “current” and “proposed” geometry rather than relying only on undo.

## Primary references

- [Lawrence Berkeley National Laboratory — Tips for Daylighting](https://eta-publications.lbl.gov/sites/default/files/tips-for-daylighting-2013.pdf)
- [NIST — Application of Natural Ventilation](https://nvlpubs.nist.gov/nistpubs/gcr/2001/gcr01-820.pdf)
- [U.S. Department of Energy — Building envelope heat flow](https://bsesc.energy.gov/energy-basics/building-envelope-building-science-intro-heat-flow)
- [U.S. Department of Energy — Window U-factor, SHGC, visible transmittance, and cost](https://www.energy.gov/cmei/femp/purchasing-energy-efficient-residential-windows-doors-and-skylights)
- [U.S. Department of Energy — Orientation, daylighting, and solar control](https://www.energy.gov/cmei/buildings/zeb-technologies-building-envelope-architectural-considerations)
- [UK Government — Approved Document B](https://www.gov.uk/government/publications/fire-safety-approved-document-b)

These sources support reference rules and physics. They do not turn a rough sketch into a weather-calibrated simulation, tender, or safety certification.
