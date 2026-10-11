# SpaceFactor: steal, improve, credit

Reviewed 2026-10-11 for designon / Luma House. Research and proposed implementation only; no new application behavior is shipped by this document.

SpaceFactor adds a useful decision workflow to the drawing discipline we studied in IngeTrazo: explore alternatives within one space, understand the change, choose an arrangement, then carry that choice into a design package and furnishing list.

## Sources and evidence limits

Public sources read over HTTPS:

- [SpaceFactor homepage](https://spacefactor.cn/): HomeFactor's planning/presentation proposition, furnishing substitutions and Hometa's product-selection workflow.
- [Residential Multi-Layout Dataset](https://spacefactor.cn/research/datasets/): structured room boundaries, furniture configurations and linked alternatives; the page describes professional review and partnership licensing.
- [Layout Studio landing page](https://layout-studio.spacefactor.cn/): an upload route and a sample-exploration route, advertised without login.
- [Hometa entry](https://hometa.spacefactor.cn/): login for saved design projects.

The web reader could not retrieve these pages; direct HTTPS retrieval succeeded. The in-app browser timed out on the homepage and could not complete the interactive study. Consequently this review evaluates published product descriptions and page structure, not rendered styling, generation quality or backend behavior. Static markup contains loading/error states and pending-feature notices; their presence alone does not establish the live state of a JavaScript application. No account was created, no personal plan was uploaded and no private API or production bundle was inspected.

Shouheng Chen is acknowledged for the reference supplied through Dr Non. This is not a claim about his corporate title or authorship of a particular implementation.

## SIC map

| Public pattern | Adaptation for designon | What improves it | Status |
| --- | --- | --- | --- |
| Same room, multiple furniture arrangements | A dedicated room-options panel with three named proposals | Hold walls/openings fixed; show explicit fit and circulation tradeoffs | Proposed; current A/B is a starting point |
| Structured spatial representation | Store a proposal as editable room/furniture data | Use actual calibrated dimensions for the plan, 3D model, checks and exports | Existing foundation; option generation proposed |
| Before/after furnishing choices | Compare the current arrangement with a proposed one | Keep camera, city, date and time identical; highlight moved objects | Existing saved cameras; layout comparison proposed |
| Try a sample before supplying a file | Keep the sample entry immediately understandable | Let a user inspect the local model and sun without an account or upload | Sample entry already exists |
| Design connected to a product list | Link chosen furniture to dimensions and an optional product reference | Separate verified supplier facts from concept allowances | Generic catalog exists; supplier records proposed |
| Plan, presentation and material-list delivery | Export an accepted option as a decision package | Include measured drawings, actual model views, assumptions and unresolved questions | A4 sheet exists; fuller package proposed |

This is a product-method reference, not permission to reuse SpaceFactor's code, imagery, catalog or dataset.

## First build: three useful arrangements in the same room

Use the current plan as the source of truth. Lock the room boundary, doors, windows, scale and building systems while generating furniture arrangements. Show one main drawing and three small selectable previews, with plain objectives such as **clearer walking route**, **desk near daylight** and **more storage**. An objective is a goal, not an automatic claim that an option achieved it.

Start with a bounded local placement search using our known furniture footprints and supported orientations. Reject items outside the room, overlapping items and blocked door clearances. Reuse existing conflict checks and add the missing furniture-sensitive measures. If no valid arrangement exists, explain the constraint and keep the current design. Do not silently shrink furniture or move a structural boundary to produce a result.

Preview is separate from Apply. Applying an option is one undoable transaction; save/share must retain the accepted geometry. Opening the options panel or selecting a preview must not overwrite a user's drawing. Cache proposals by room geometry, openings, furniture dimensions and requested objectives. Cache model captures by proposal plus camera/style/sun settings. Routine option generation and display can stay local without a multimodal API.

Acceptance evidence: a deliberately tight room refuses an oversized furniture set; doors and windows remain unchanged; Apply/Undo restores the exact drawing; all previews use the same camera and sun conditions; reopening a preview uses its cache; all four palettes remain usable at phone/tablet/desktop widths.

## Make the comparison explain the choice

`src/analysis/abComparison.ts` currently returns area, concept cost, carbon, daylight coverage, heat and air exchange. Its heat/wind calculations use fixed reference inputs: sun azimuth 180°, altitude 45°, outside temperature 34°C, wind direction 180° and speed 3.5 m/s. These are not the currently selected city's/date's conditions. `src/components/ABComparisonModal.tsx` does not display those inputs.

Before extending that comparison to layout choices, pass a shared, explicit assessment context or clearly label its reference conditions. Use the same conditions for both options. A furniture-only rearrangement may leave envelope metrics unchanged; show that honestly. Add measures that actually respond to furniture placement: fit conflicts, door clearance, remaining circulation space and a declared approximation of desk/window exposure. Do not invent an overall comfort or quality-of-life score.

The user should see a reason tied to the drawing: what moved, which route became clear, what constraint remains and which assumptions were used. Preserve our IANA-aware clock, local SunCalc engine and demand-driven shadow maps. Combine this with the project-north/neighbor-shade work recommended in the [IngeTrazo review](INGETRAZO-REUSE-REVIEW.md).

## Product choices and the delivery package

Our `FurnitureCatalogDrawer.tsx` has generic furniture kinds and explicit footprints, not live supplier SKUs. A future product record should carry dimensions, units, source URL, manufacturer, asset license and verification date. Price/stock belongs in separately sourced fields with currency and freshness; missing data stays missing. A logo or example photograph on another site does not establish access to a supplier's feed.

Let a user compare one furniture substitution while preserving the rest of the arrangement. Check its real footprint before applying it and recalculate any affected quantities. Texture/finish changes should remain distinct from changes to physical dimensions.

An accepted option should produce a compact package: calibrated plan, local model view, selected sun settings, chosen furniture and dimensions, concept quantities/cost basis, and open construction questions. The optional language model can summarize this verified information later. The model, drawings and routine option comparisons remain deterministic.

## Credit and possible collaboration

Record SpaceFactor as the source of the comparison/furnishing workflow pattern, with a link to the exact public page. Suggested acknowledgment after an adaptation is implemented:

> Spatial layout comparison and furnishing-workflow inspiration: SpaceFactor（空间因子）; acknowledgment to Shouheng Chen. Independently implemented in designon.

No permissive source-code or asset license was identified in the inspected pages. Independently implement the behavior and use our own design tokens/content. Do not copy their website, screenshots, brand imagery, supplier photographs, product data or proprietary methods into the application on the strength of a credit line.

The dataset page explicitly offers full-data access through cooperation licensing. A useful future collaboration would be a small licensed evaluation set of room boundaries, fixed openings and several professionally reviewed furniture layouts, with documented units, provenance and permitted use. Clarify evaluation, publication, redistribution and training rights separately. Benchmark our independent proposals against it before claiming designer-level generation. No data or contact request has been sent in this study.

Current action: this SIC review and its research-reference link are documented. Layout generation, supplier integration and a revised comparison engine are recommendations, not newly verified features.
