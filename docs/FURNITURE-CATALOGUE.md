# Measured furniture catalogue

The furniture catalogue is a progressive enhancement of the local 3D view. The plan remains usable when a model is unavailable: every piece always has a measured 2D footprint and a schematic 3D box, while supported pieces may replace that box with a measured GLB in the Solid view.

## Runtime contract

- Models load only after the user opens 3D and chooses **Solid**. They do not enter the first-paint bundle.
- Meshopt compression uses the decoder bundled with the lazy 3D code; the app does not fetch a Draco decoder from a third-party CDN.
- Loading and error boundaries are per piece. A slow, missing, or unreadable model falls back to its measured box without hiding the building.
- The generated manifest records footprint, height, byte size, source, credit, and licence. Tests re-read the shipped GLB envelopes and compare them with those values.
- An explicitly selected model is preserved in saved plans and share links. Unknown model IDs fail closed to the measured box.

## Why a mesh is not drawn everywhere

Each asset declares two things beyond its measured size:

- **`serves`** — the `FurnitureKind` values it may stand in for.
- **`bandM`** — the footprint window, in metres, where it still reads as its own shape.

A piece draws real geometry only when its kind is served *and* its footprint falls inside the band. Outside that, it draws its measured box. An explicit model choice wins within that contract. Otherwise an exact measured size wins; among other permitted models, the one that fills the most footprint area after uniform scaling is selected first. The bands themselves are unchanged.

This is not a performance guard, it is an honesty guard. A 0.83 m chair scaled uniformly onto a 2.2 m sofa footprint is not a sofa — it is a chair you could sit on from across the room. Nothing would catch it: `tsc`, `lint`, the unit suite and the dimension-agreement tests all pass, because the mesh *does* match its manifest, it is simply the wrong mesh for that rectangle. So the band is data, and `furnitureAssets.test.ts` fails when a kind the catalogue advertises stops resolving to a mesh, or when a default footprint is served by a mesh more than ~25% off native.

Concretely, today: a 2.8 m L-shape sectional and a 2.0 m media console have no mesh and draw boxes, because the catalogue has no sectional and no console. That is correct behaviour, not a gap to paper over. If you add one, add the mesh and its band in the same commit — never widen an existing band's edges to make a new piece fit.

## Sources and licences

The source files come from the [Khronos glTF Sample Assets repository](https://github.com/KhronosGroup/glTF-Sample-Assets). Keep the [complete bundled notice](../public/licenses/furniture.txt) with every redistributed build. It includes supplied creators, source and license links, and our normalization/compression changes; the catalogue links to the deployed notice.

| Asset | Credit | Licence |
|---|---|---|
| Sheen Chair | Wayfair, LLC, 2020 | CC0-1.0 |
| Chair Damask Purplegold | Wayfair, 2021 | CC-BY-4.0 |
| Glam Velvet Sofa | Wayfair, LLC, 2021 | CC-BY-4.0 |
| Sheen Wood Leather Sofa | Darmstadt Graphics Group GmbH, 2024 | CC-BY-4.0 |
| Glass Vase Flowers | Public, 2023 | CC0-1.0 |
| Lantern | Microsoft, 2017; Frank Galligan, 2018 | CC0-1.0 |

Exact upstream URLs live in `scripts/build-furniture-catalog.mjs` and are copied into `src/catalog/furnitureCatalog.generated.ts`.

## Rebuilding

1. Download the named upstream GLB files into `scripts/furniture-src/` using the filenames in `scripts/build-furniture-catalog.mjs`.
2. Run `npm run build:furniture`.
3. Run `npm test -- src/catalog/furnitureAssets.test.ts` and `npm run build`.

The large upstream files and scratch directory are intentionally ignored. Commit the optimized files in `public/furniture/models/` and the generated TypeScript manifest together.

## Running the browser suite

`npm run test:e2e` **builds first**. The Playwright server runs `npm run preview`, which serves `dist/` as it happens to be — it never builds. Running `playwright test` on its own tests whatever bundle was last built, so updated specs will be measured against an old app and fail for reasons that have nothing to do with the change under test. Use `npm run test:e2e:fast` only when you deliberately want the existing `dist/`, such as when iterating on a spec without touching app code.


## Audited rendering boundary

Furniture scenes contribute meshes and materials only. Runtime clones omit
source lights/cameras and leave shared source resources unchanged. Resolved
catalogue height, including uniform scale, also drives schematic and error boxes.
Only a box representation keeps a full-height box shadow caster; loaded meshes
cast their own shadows. Representation mount/unmount refreshes the existing
solar shadow cache once, preserving demand rendering and idle reuse.
