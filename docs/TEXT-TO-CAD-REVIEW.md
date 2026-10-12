# text-to-cad review

Studied: [earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad),
default branch on 2026-10-12. MIT, Copyright (c) 2026 Thompson Labs LLC.
19k stars. A plugin that lets coding agents generate CAD (build123d and
OpenCascade, in Python), check it for manufacturing, and send it to 3D
printing, sheet-metal and CNC services, with a three.js viewer.

## What designon lacked

The only export was a JSON project file. A design could not leave the
browser as geometry: not to Blender, not to a printer. text-to-cad's loop is
generate → check → fabricate. That loop is what we took.

## What we took

| From text-to-cad | In designon |
|---|---|
| Binary STL writer, deterministic stored zip, 3MF package (`meshFormats.js`, `packageMeshExport.js`) | `src/fabricate/formats.ts`, ported to TypeScript with attribution |
| DfAM process limits (`skills/dfam-check/references/process-limits.md`) | `src/fabricate/printability.ts`: FDM and SLA wall and bridge limits |
| GLB container layout | `meshToGlb`, written fresh against the glTF 2.0 spec |

New in designon, not in text-to-cad:

- **Plan → model.** `houseMesh` turns rooms into wall runs, builds a shared
  wall once, and cuts real door and window openings by splitting each wall
  into pieces around them. No CSG library.
- **Scale-model printing.** Choose 1:50 to 1:250. The check reports model
  size against a 256 mm plate, wall thickness against the printer's minimum,
  and the longest lintel against the bridge limit.
- **Honest findings.** A 0.15 m wall at 1:100 is 1.5 mm, under FDM's 1.6 mm
  freestanding minimum. Walls can be thickened to print; the dialog then says
  the model is not true to scale in wall thickness. A long lintel asks for
  supports instead of blocking the download, because slicers add them.
- **Verification by independent readers.** three.js's STL and glTF loaders
  read the files in tests; its 3MF loader was checked in the browser
  (432 of 432 triangles, both coloured parts).

## What we left, and why

- **The Python CAD kernel** (build123d, OpenCascade). designon runs in the
  browser; a B-rep kernel would mean WASM or a server.
- **Fabrication service connectors** (SendCutSend, Bambu cloud). A print-
  shop upload is a next step once the files have been used by real people.
- **Exploded view, section caps, 3D measuring** in their viewer
  (`packages/core/src/lib/viewer`, MIT, tested). Good candidates for the
  Spatial view next; not copied yet.
- **AR on phones.** iOS Quick Look needs USDZ; three.js has an exporter.
  Not built, because it must be tested on a real iPhone.

## Known limits

Roofless model; terraces get no walls. A merged wall run takes the tallest
adjoining room's height. Overlapping openings on one wall keep the first.
