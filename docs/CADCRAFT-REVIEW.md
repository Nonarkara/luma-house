# CADCraft review · 19 October 2026

Source: `https://github.com/storytold/cadcraft`, README and repository page,
read 19 October 2026. Facts below are transcribed from those. Claims the
README makes about itself are marked as claims; no source code was read.

## What it is

CADCraft is an open-source 2D/3D CAD application in pure Rust with an egui
front end, part of the ArtCraft family (PhotoCraft, VectorCraft, FilmCraft,
LightCraft, PdfCraft, EffectCraft, DesignCraft). MIT OR Apache-2.0. The
repository page showed 5.8k stars, 2.6k forks and 47 watchers, with a status
badge of **early development**.

Cadence matters here: a repo can be popular and still unfinished. CADCraft says
so itself, which is the first thing worth copying.

## What it does, from the README

- Native on macOS, Windows, Linux and FreeBSD, plus a WebAssembly build.
- DXF read R12–2018 in ASCII and binary, written R2000. DWG read and written
  through the `acadrust` library. SVG, PNG and PDF export.
- Paper-space layouts, viewports with per-viewport layer freeze and scale,
  page setups, PLOT to PDF.
- Full AutoCAD command surface: LINE through POLYGON, the DIM* family with
  DIMSTYLE variables and associative dimensions, MLEADER, TABLE, hatches with
  islands, BLOCK/INSERT, geometric and dimensional constraints that re-solve
  after every edit.
- Fourteen interface languages with live switching.
- MCP server, JSON control channel, and `cadcraft-cli` (info, convert, run,
  commands, mcp). MCP tools include `command_line`, `execute`,
  `inspect_drawing`, `query_entities`, `render`, `screenshot` and `ui_click`.

## The five things worth taking

**1. CI enforces the crate layering.** `cargo xtask ci` checks formatting,
clippy, tests, asset attribution, *the crate layering* and the wasm build. The
README states the rule plainly: nothing below `ui-egui` knows about egui, so
the front end can be replaced. That is a boundary a test holds, not a comment
that hopes. **This is the highest-value idea in the repo.**

**2. Honest parity, measured.** A status table per area, `ROADMAP.md` with
measured parity numbers and an estimate of remaining work, and `docs/gaps.md`
listing everything still missing. "CADCraft is in early, fast development.
Honest status" is the first line of the feature table.

**3. Documented lossiness.** "Entities CADCraft doesn't model yet are not kept
on save", linked to a file-format parity document. It tells you in advance what
a round trip through its writer will drop.

**4. Every tool is a command, so an agent can drive and then verify.** An
agent types at the command line exactly like a person, or calls a command with
JSON, then *inspects and renders the drawing to check its own work*. The
verification loop is the point, not the automation.

**5. Accessibility treated as behaviour, not a checklist.** The system cursor
can be restored because a custom crosshair breaks screen magnifiers; animation
follows the OS setting and changes mid-session; and it distinguishes drafting
feedback (rubber bands, snap markers, text cursor) from decoration, which does
not move when animation is off.

## What designon already does

- **Reduced motion** is honoured in two places: `App.tsx` skips the fitting
  animation under `prefers-reduced-motion`, and `styles.css` has the media
  query. CADCraft's care is the part worth extending — it distinguishes
  drafting feedback from decoration, and designon does not.
- **Draft honesty** matches. CADCraft's parity doc and designon's
  "anything the model produced is labelled a draft" are the same instinct.
- **A renderer-free domain layer** is the stated intent in AGENTS.md: roof
  vocabularies live in pure `roofStyles.ts` "so validation cannot eagerly load
  Three.js". That was prose, not a gate.

## What was adopted, and what was found

`src/layering.test.ts` now enforces the boundary CADCraft's CI enforces. Pure
`.ts` modules under `src/analysis`, `src/drawing`, `src/export`, `src/location`
and `src/study`, plus `plan.ts`, `openingGeometry.ts` and `sharePlan.ts`, may
not import `three`, `three-stdlib`, `@react-three/*`, `react-dom` or `react`.
It ratchets: the two current exceptions are named with their reasons, and an
exemption pointing at a file that no longer exists fails the test.

**Writing the gate found a real coupling.** `src/study/geometry.ts`, which owns
camera framing, imports `Box3`, `OrthographicCamera` and `Vector3` from
`three`. That is not wrong — the maths is genuinely 3D — but it means the
framing code cannot be unit-tested without a renderer, and it is now written
down rather than left implicit.

Mutation-checked: dragging `import { Vector3 } from 'three'` into
`src/drawing/labels.ts` fails with "src/drawing/labels.ts imports three", and
renaming an exemption away fails with "exemption … names a file that no longer
exists".

## What was not taken, and why

- **A command line.** designon draws from a napkin; a typed command grammar is a
  different product, not a feature this one lacks.
- **A web build.** designon is already a web app and already local-first.
- **Fourteen languages.** Nothing in the request, and a locale nobody reads is
  a translation bill, not a feature.
- **Constraint solving.** Genuinely useful for parametric work, and a large
  system. Not a gap to close opportunistically.

## Limits of this review

The README describes the product; it is not evidence about the code. Parity
claims, the accessibility behaviour and the layering rule were read as written.
Only the layering rule was checked against anything, and only because designon
had the same rule in prose. Before treating any CADCraft feature as a reference
implementation, someone should read the corresponding crate.