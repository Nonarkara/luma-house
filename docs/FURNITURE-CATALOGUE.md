# Measured furniture catalogue

The furniture catalogue is a progressive enhancement of the local 3D view. The plan remains usable when a model is unavailable: every piece always has a measured 2D footprint and a schematic 3D box, while supported pieces may replace that box with a measured GLB in the Solid view.

## Runtime contract

- Models load only after the user opens 3D and chooses **Solid**. They do not enter the first-paint bundle.
- Meshopt compression uses the decoder bundled with the lazy 3D code; the app does not fetch a Draco decoder from a third-party CDN.
- Loading and error boundaries are per piece. A slow, missing, or unreadable model falls back to its measured box without hiding the building.
- The generated manifest records footprint, height, byte size, source, credit, and licence. Tests re-read the shipped GLB envelopes and compare them with those values.
- An explicitly selected model is preserved in saved plans and share links. Unknown model IDs fail closed to the measured box.

## Sources and licences

The source files come from the [Khronos glTF Sample Assets repository](https://github.com/KhronosGroup/glTF-Sample-Assets). Keep the credit below with any redistributed build.

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
