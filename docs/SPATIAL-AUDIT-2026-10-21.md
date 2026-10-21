# Spatial audit — the SHM pass

**Date:** 2026-10-21
**Scope:** the whole system, every surface, at 1600 / 1500 / 1440 / 1400 / 1361 / 1360 / 1280 / 1200 / 1081 / 1080 / 1024 / 1001 / 1000 / 900 / 768 / 390 px.
**Gate:** `e2e/spatial.spec.ts` — 7 tests (6 desktop, 1 phone).
**Result:** 5 findings fixed, 2 candidates refuted by measurement, 1 recorded as deliberate.

---

## What SHM is

**SHM — spatial hallucination.** An interface invents a reason for things to
occupy space, instead of arranging them around how people read, choose and
act. It looks composed at first glance, but it cannot explain its own
geometry.

The failure modes, and the one test that finds them:

| Failure mode | What it looks like in the product |
|---|---|
| Unjustified gaps | space stretched to fill a container |
| Orphan elements | a control stranded beside an empty area |
| Scattered actions | related buttons on different rows or opposite edges |
| False hierarchy | everything gets equal weight, so nothing helps you choose |
| Accidental wrapping | navigation breaks wherever it runs out of room |
| Spatially expensive information | a small decision requires a long scroll |

> **Why is this here, why this size, and why this far from that?**
> If the answer is merely "the grid put it there", the layout has failed.

Whitespace is intentional when it separates meaningful groups, supports
reading, or establishes emphasis. It becomes spatial hallucination when it
asks the reader to supply an intention the designer never had.

## How the pass was run

Every claim below was **measured in the running app**, not read off the CSS:
boxes, `scrollWidth` against `clientWidth`, computed styles, and the rendered
pixels. Two things that looked like findings on the screen were refuted by
measurement and are recorded as such, because a wrong finding is as
expensive as a missed one.

Each fix ships with a gate, and **each gate was mutation-checked**: the fix
was reverted in the built bundle, and the gate was required to fail. A gate
that cannot fail is worse than no gate.

---

## Findings

### SHM-1 — The tool palette stretched, and "Room options" was 315 px from the tools

**Measured.** `.canvas-tools .floating-island-toolbar` carried `flex: 1`, so
it grew to fill the column, and `.room-options-launch` carried
`margin-top: auto`, so it was pinned to the foot of the column. The last tool
ended at y = 496; "Room options" started at y = 811. **A 315 px gap**, and the
button landed on the same row as the assistant bar — a different thing
entirely.

**Why it is a hallucination.** "Room options" is *the last tool*: on the phone
it is the last item in the tool row. The grid invented a reason to separate
it from the tools it belongs with, and the reader had to supply the
reasoning.

**Fixed.** The palette ends where its content ends (`flex: 0 0 auto`);
"Room options" follows it (`margin-top: 0`). The empty space is now at the
*end* of the list, where a reader expects a list to end.

**Gate.** The gap between the palette and the button is ≤ 24 px, and the
palette's height equals the sum of its children's heights — it may not
stretch to fill the column.

### SHM-2 — The journey sequence had no 01

**Measured.** A completed step rendered `<Check/>` *instead of* its number.
The rail read **✓, 02, 03, 04, 05, 06, 07** — the first step had no number
at all, so the reader could not say where they were.

**Why it is a hallucination.** The number is the mark; the tick is a second
fact about the same step. Trading one for the other destroyed the sequence.

**Fixed.** The number is always the mark, and the tick is added beside it:
**01 ✓, 02, 03 …**.

**Gate.** The steps read `01`…`07` in order, and a completed step keeps its
number *and* gains a tick.

### SHM-3 — The top bar crushed its own identity

**Measured, at 1280 px.** The project name received 170 px of the 174 px it
needed — 4 px short, ellipsised. The city was cut to **"Sh"**: `.topbar-meta`
was shrinkable, so it took the shortage and its `overflow: hidden` chopped
the city with no signal at all. At 768 px the name was **33 px** wide and the
meta was **0 px** — both gone.

**Why it is a hallucination.** The bar is a three-column grid whose two
flanks are equal (`minmax(0, 1fr) auto minmax(0, 1fr)`). The left flank
carries the brand, the name and the facts; the right carries four buttons.
Equal flanks meant the left was crushed while the right sat in **154–236 px
of nothing**. The grid invented the space and took it from the wrong side.

**Fixed.** The bar now drops by decision, in priority order, and never
crushes:

| Dropped | At | Where it goes |
|---|---|---|
| area figure | ≤ 1499 px | the More menu (the plan shows it) |
| wordmark | ≤ 1360 px | the house mark stays |
| city | ≤ 1080 px | the More menu — "Change city · Shanghai" is already there |
| project name | ≤ 1000 px | the More menu, as `.menu-project-name` |

**Only the name goes.** The "Saved locally" stamp beside it stays in the bar
at every width. That was not the first attempt: hiding the whole project
picker at ≤ 1000 px took the save state with it, and the theme suite caught
it at 768 px. Dropping a name is a decision; losing the reader's
reassurance is not. The gate now asserts the stamp stays.

The thresholds are measured, not guessed: the left flank is
`(viewport − 385) / 2` px wide, and the surviving group has to fit inside it
with room to spare — 451 px with the wordmark, 313 px without it, 214 px with
the name alone.

Two structural rules now hold at every width: **the city is never cut** (the
meta is `flex: 0 0 auto`, so it never gives ground), and **the name is only
ever cut with an ellipsis** (which says "there is more here" instead of
silently amputating the word).

**Gate.** The fragment rule below, at 15 widths; plus the name is rendered
whole at 1440, 1280 and 1024.

### SHM-4 — The More menu repeated what the bar already showed

**Measured.** The menu always carried the project name and the "Saved
locally" stamp, even at 1440 px where the bar showed both — pure
duplication, two copies of information, neither of them an action. Meanwhile
the bar's own **Share** button *was* duplicated as a "Share link" menu item,
and the bar's city toggle was duplicated as "Change city".

**Why it is a hallucination.** The menu drew no line: it repeated some of
what the bar showed and omitted others, so the reader had to work out the
rule.

**Fixed.** The rule is now explicit: **the menu repeats *actions* — city,
share — so that it is a complete list. It repeats *information* — the name,
the saved stamp — only when the bar has dropped it.** The bands above make
the two halves complementary: at 1440 the bar holds the name and the menu
hides it; at 900 the bar drops the name and the menu shows it.

**Gate.** While the bar shows the name, the menu does not. The moment the
bar drops it, the menu shows the same text.

### SHM-5 — The 3D style row scrolled behind a hidden scrollbar

**Measured.** `.spatial-toolbar` is `overflow-x: auto` with
`scrollbar-width: none`. At 1280 px **"Save view PNG" was entirely
off-screen**; at 1440 px **"Section cut" was cut in half**. There was no
scrollbar, no gradient, no hint — the controls simply were not there.

**Why it is a hallucination.** This is accidental wrapping dressed as a
deliberate scroller. A control the reader cannot see is not available; the
layout asks the reader to supply the intention that the row scrolls.

**Fixed.** The style group wraps instead of scrolling. Every control is now
on screen, at both 1440 and 1280.

**Gate.** Every `.spatial-tb-btn` is inside the toolbar's box, and the
toolbar itself does not scroll.

---

## Candidates refuted by measurement

These looked like findings and are not. Recording them so a later reader does
not "fix" them into bugs.

- **The phone room key looks like an accidental scroller.** Measured: it is
  `display: flex; overflow-x: auto` with `scroll-snap-type: x mandatory` — a
  deliberate, swipeable row — and `e2e/themes.spec.ts` already proves every
  entry is reachable by scrolling. **Unchanged.** The contrast with SHM-5 is
  the point: one scroller is announced by its behaviour, the other was hidden
  behind a scrollbar that was not there.
- **The room key looked duplicated in the Cost inspector.** Measured: it is
  not. **Unchanged.**

## Recorded, deliberately unchanged

- **The two left columns share one 56 px rule grid**, so stage 01 "Draw"
  aligns with "Select", stage 02 with "Pencil", and so on. This is a mild
  *false correspondence* — the reader may briefly think a journey step and a
  tool are related. Measured, and **kept**: the CSS states the grid is
  deliberate, and the two columns have different visual languages (numbered
  stages with labels against icon tools). A later reader should not turn it
  into a bug.
- **The right flank of the top bar still holds dead space** at wide widths.
  That is the price of a centred navigation group, and the gap is between
  two groups rather than inside one — it is breathing room, not an orphan.

---

## The gate

`e2e/spatial.spec.ts` — 7 tests, run against the built bundle in real
Chromium, at real widths.

| # | Rule | Test |
|---|---|---|
| 1 | A sequence shows its numbers. | the journey reads 01 to 07, with or without the tick |
| 2 | A tool belongs with the tools. | "Room options" is the last tool, not the foot of the column |
| 3 | Nothing is cut without saying so. | the top bar never cuts a run of text into a fragment |
| 3 | …and the name is whole while the bar carries it. | the project name is shown whole while the bar carries it |
| 4 | What the bar drops, the menu carries — and only then. | the More menu carries the name exactly when the bar drops it |
| 4 | …and the save state stays in the bar when the name goes. | *(same test)* |
| 5 | A control that cannot be seen is not available. | every 3D style control stays on screen |
| 2 | …on a phone, the tools stay in one row. | the phone keeps the tools in one row and the name in the menu |

**Rule 3 is the general one.** For every element in the top bar it walks up
the ancestor chain, finds the first edge that actually clips it — a clipping
ancestor, or the window — and asks whether that cut is *signalled*. Text cut
by an ancestor is a fragment. Text cut by itself with
`text-overflow: ellipsis` is a labelled truncation, which is a different
thing, and is allowed.

### Mutation check

Every gate was proved able to fail. The mutation was applied to the built
bundle, the gate was required to fail, and the bundle was restored.

| Gate | Mutation | Result |
|---|---|---|
| tool palette | `margin-top: 0` → `margin-top: auto` | **failed** — the gap returned |
| 3D style row | removed `flex-wrap: wrap` | **failed** — controls went off-screen again |
| top-bar fragments | wordmark and area restored at 1280, meta made shrinkable | **failed** — *"location-toggle is cut by topbar-meta with no ellipsis"* |
| the name is whole | the name capped at 60 px | **failed** |
| the menu carries the name | the menu never shows the name | **failed** |
| the menu does not repeat the bar | the menu always shows the name | **failed** — after the assertion was fixed |
| the journey numbers | the tick replaces the number again | **failed** |
| the phone | the phone menu never carries the name | **failed** |

One of those gates was **vacuous on the first run** and had to be repaired
before it counted. The rule "the menu must not repeat what the bar already
shows" was asserted against a *closed* menu, and a closed `<details>` hides
everything inside it — so the assertion passed whatever the CSS said. The
mutation proved it: making the menu always show the name changed nothing.
The gate now opens the menu before asking, and the same mutation then fails
it. A gate that cannot fail is worse than no gate, and the only way to know
is to try to break it.

---

## Known limits

- The top-bar thresholds assume the default project name (174 px). A much
  longer user name ellipsises the name rather than being dropped whole; the
  name is then recoverable on hover and the city is still never cut. Making
  the drop depend on the *measured* name rather than the viewport would need
  a measurement in the component, not a media query.
- SHM is a geometry audit. It cannot see a composition that is *correct* and
  still reads as noise. That judgement still needs eyes on the screen — the
  gate proves the claims, it does not make them.
