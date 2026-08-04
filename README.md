# designon (Design + Non)

designon is a local-first sketch-to-decision prototype. Draw a room with a mouse or finger, enter one real room measurement, and the entire plan receives a shared scale. The same geometry then drives the 3D massing, window and door positions, furniture footprints, sun and heat comparisons, ventilation paths, escape connectivity, quantities, and a concept BOQ.

The product is built on the **Axiom Design Core** — the design system that governs every product under the Axiom umbrella. See `src/design/AxiomCore.md` for the principles, tokens, and component contract.

The product deliberately uses progressive fidelity:

- **Instant:** drawing, uniform scale calibration, 3D massing, daylight reach, door connectivity, steady-state envelope heat, wind-pressure paths, and cost allowances.
- **Optional cloud:** AI plan trace and concept imagery, both labeled as drafts and sharing a three-use daily quota.
- **Professional bridge:** structure, jurisdictional compliance, final energy loads, moisture, CFD, quotations, and procurement still require verified inputs and qualified review.

The included **South Light 50 · 向阳之家** sample is a 50.0 m² Shanghai apartment. Starting blank or tracing a plan creates an **Untitled sketch** and does not inherit the sample’s variants or style language.

## Run and verify

```bash
npm install
npm run dev
npm test -- --run
npm run lint
npm run build
```

## Implemented journey

1. Draw a rough room or upload a plan image.
2. Calibrate the whole sketch from one known width or depth.
3. Orbit the resulting geometry, take a guided data-derived tour, or walk it at eye level with WASD.
4. Place and move windows and doors; the plan updates daylight reach, wind paths, and escape routes immediately.
5. Scrub sun/time/outdoor temperature or apply explicit what-if condition inputs.
6. Compare envelope transmission and its area-scaled concept allowance.
7. Continue into living checks, systems, detailed fit-out quantities, export, share, and optional concept imagery.

## Science boundaries

The Value Lens keeps four things together: a spatial consequence, a plain-language verdict, lived/technical/expense value, and an expandable method disclosure.

- Daylight is a window-centered reference reach zone—not lux or glare simulation.
- Ventilation requires two real exterior pressure faces connected by modeled open doors—not merely two opening symbols.
- Escape is geometry-only door-graph connectivity—not a fire or accessibility approval.
- Envelope heat is a current steady-state walls-and-openings comparison—not an annual load or AC sizing result.
- Cost is an area/opening/system-responsive CNY concept allowance—not a quote or payback claim.

See [the building-science usability audit](./docs/BUILDING_SCIENCE_USABILITY_AUDIT.md) and [the reported-work implementation audit](./docs/GROK_45_IMPLEMENTATION_AUDIT.md).

## Architecture and performance

- Vite, React, strict TypeScript, React Three Fiber, and Vitest
- Browser `localStorage` for zero-setup persistence
- 3D remains lazy-loaded so drawing does not download it up front
- No new runtime package was added for the decision models

Current production build: approximately **314 kB / 101 kB gzip** for the main JavaScript and **936 kB / 250 kB gzip** for the lazy 3D chunk.

## Optional AI worker

```bash
cd workers/concept-render
npm install
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Set `VITE_CONCEPT_API_URL` to the worker URL and rebuild. Successful AI traces and concept images share the browser-visible three-use daily quota.

## Deployment

```bash
npm run deploy:pages
```

Live: [nonarkara.github.io/luma-house](https://nonarkara.github.io/luma-house/)<br>
Repository: [Nonarkara/luma-house](https://github.com/Nonarkara/luma-house) (URL kept for GitHub Pages inertia; the product is **designon**).

Deployment is intentionally separate from implementation verification; this working tree is not published automatically.
