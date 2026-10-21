# Spatial audit — the SHM pass

**Date:** 2026-10-21
**Scope:** the whole system, every surface, at 1600 / 1500 / 1440 / 1400 / 1361 / 1360 / 1280 / 1200 / 1081 / 1080 / 1024 / 1001 / 1000 / 900 / 768 / 390 px. The second pass on the top bar swept every band edge as well: 1600 / 1500 / 1440 / 1400 / 1300 / 1225 / 1224 / 1200 / 1150 / 1149 / 1100 / 1025 / 1024 / 1000 / 950 / 920 / 919 / 900 / 860 / 820 / 819 / 800 / 780 / 768 / 740 / 721 / 720 / 390 px.
**Gate:** `e2e/spatial.spec.ts` — 10 tests (9 desktop, 1 phone).
**Result:** 7 findings fixed, 2 candidates refuted by measurement, 1 recorded as deliberate.

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
| area figure | ≤ 1350 px | dropped — the drawing and the inspector both carry it |
| wordmark | ≤ 1200 px | the house mark stays |
| city | ≤ 920 px | the More menu — "Change city · Shanghai" is already there |
| project name | ≤ 720 px | the More menu, as `.menu-project-name`, with the save state |

*(These thresholds were re-derived for the bar's new geometry in SHM-7, which
is where the current table lives. They were correct for the grid this finding
described, and wrong for the flex row that replaced it.)*

**Only the name goes.** The "Saved locally" stamp beside it stays in the bar
at every width the bar has room for. That was not the first attempt: hiding
the whole project picker at ≤ 1000 px took the save state with it, and the
theme suite caught it at 768 px. Dropping a name is a decision; losing the
reader's reassurance is not. The gate now asserts the stamp stays.

The thresholds are measured, not guessed. The left flank is
`(viewport − 233) / 2` px wide — 233 for the bar's own padding, its two gaps
and the centred view switch — and the surviving group has to fit inside it
with room to spare: 530 px with everything, 455 without the area, 317 without
the wordmark, 218 without the city. Each band sits where the next group down
would stop fitting with about 30 px to spare.

Two structural rules now hold at every width: **the city is never cut** (the
meta is `flex: 0 0 auto`, so it never gives ground), and **the name is only
ever cut with an ellipsis** (which says "there is more here" instead of
silently amputating the word).

**Gate.** The fragment rule below, at 16 widths; plus the name is rendered
whole at 1440, 1280 and 1024.

### SHM-4 — The bar's actions were scattered across it

**Measured, at 1440 px.** The centre group held the view switch *and* the
history group (undo, redo, concept photo). The right group held More, the
panel toggle, Share and Export. The two groups were **248 px apart** — the
width of the empty right grid column — and the space sat *between* them.
At 1280 px it was 168 px.

**Why it is a hallucination.** Scattered actions: the controls that act on
the drawing were split from the other controls that act on the drawing, and
the reader had to work out that undo and Share belonged together. Worse,
the void fell *between two halves of the same thing*, and the one group that
deserved the centre — the mode switch, the thing that changes the whole
screen — shared it with a set of buttons.

**Fixed.** The bar is now three parts and says so by its geometry: **what
you are looking at** (brand, name, facts) on the left, **which view you are
in** (Plan / Spatial / Renders) alone in the centre, **what you can do**
(undo, redo, concept, More, panel, Share, Export) as one group at the
right. The void did not disappear — symmetry needs it — but it now falls
between the mode switch and the actions, which are different kinds of
thing, instead of between two halves of the same kind.

A second effect fell out of it: the centre shrank from 341 px to 189 px, so
the left flank grew by 76 px. That is why the drop bands in SHM-3 could
move *later* — the bar now carries the area figure down to 1350 px, the
wordmark to 1200 px and the city to 920 px, each one still shown whole.

**Gate.** The centre holds exactly one child; the history group is inside
the actions group; the gap between the two is ≤ 12 px; and the quiet space
between the mode switch and the actions is > 24 px, so the two are
separated rather than merged.

### SHM-5 — The More menu repeated what the bar already showed

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
hides it; on a phone the bar drops the name and the menu shows it, with the
save state beside it.

**Gate.** While the bar shows the name, the menu does not. The moment the
bar drops it, the menu shows the same text.

### SHM-6 — The 3D style row scrolled behind a hidden scrollbar

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

### SHM-7 — The bar's two equal flanks could not hold the actions

The second pass on the top bar. SHM-3 fixed the bar crushing its identity;
this is the other half of the same fault, and it was still there.

**Measured, at 768 px.** The bar was a three-column grid with two equal
flanks: `minmax(0, 1fr) auto minmax(0, 1fr)`. The identity carries **526 px**
of content and the actions **441 px**, so the left flank needed 526 px and
the right needed 441 — but a flank is only `(viewport − 233) / 2`, which is
**267 px at 768**. The right flank could not hold the actions, so they spilled
**left over the mode switch**: at 768 px the Undo button sat on top of the
"Spatial" tab.

The theme suite found it as a failure, not as a picture: *"`<button disabled
title="Undo">` … intercepts pointer events"* on the Spatial tab, at 768 px, in
nine routes. It was not a cosmetic overlap — the Spatial view could not be
opened at all.

**Why it is a hallucination.** The grid invented a symmetry the content did
not have. Two flanks of equal width, holding 526 px and 441 px, is a shape
with no argument behind it: the left flank was asked to hold more than the
right, and the row answered by crushing one and overflowing the other.

Measured on the live site, which was still running this layout:

| Width | identity track | mode switch | actions | gap to the identity | gap to the actions |
|---|---|---|---|---|---|
| 1440 | 603 px (526 px of content) | 627–817 | 991–1432 | **12 px** | **174 px** |
| 1024 | 395 px | 419–609 | 575–1016 | 12 px | **−34 px (overlap)** |
| 768 | 267 px | 291–481 | 365–760 | 12 px | **−116 px (overlap)** |

At 1440 the mode switch was **12 px** from the identity and **174 px** from
the actions: the bar's centre was not in the middle of anything. At 768 the
actions ran **116 px** over it — and the Spatial tab (344–409) sat under the
Undo button (367–411). A hit test at the middle of the Spatial tab returned
the Undo button, not the tab.

**Fixed.** The bar is a flex row whose space is *shared*. The identity is the
only part that gives ground, because the identity is the only part that drops
by decision; the mode switch and the actions keep their width. The mode
switch now ends the same distance from the identity and from the actions —
at 1440 px, 132 px each side, where before it was 12 and 174.

The bands were re-derived for the new geometry, and the bar now shows *more*
at more widths: the area figure survives to 1224 px instead of 1350, and the
wordmark to 1149 instead of 1200.

| Dropped | At | Where it goes |
|---|---|---|
| the words on Share and Export | ≤ 1024 px | the icons stay, and the screen reader still has the names |
| area figure | ≤ 1224 px | dropped — the drawing and the inspector both carry it |
| wordmark | ≤ 1149 px | the house mark stays |
| city | ≤ 918 px | the More menu — "Change city · Shanghai" is already there |
| project name | ≤ 819 px | the More menu, as `.menu-project-name` |
| save state | ≤ 720 px | the More menu, as `.menu-project-stamp` — the phone only |

**The bands are measured, not guessed, and they are one-way.** The identity's
own widths are 526 px with everything, 451 without the area, 317 without the
wordmark, 218 without the city and 110 without the name; the bar's own
padding, gaps, mode switch and actions take 674 px, or 577 once the action
labels go. Each band sits where the group below would stop fitting with 24 px
of air left for the mode switch. The action labels go at 1024 px because
that is the one width where the identity is the *same* either side of the
change — the labels cost 97 px, so shedding them hands that space straight
back to the identity instead of dropping the city. A thing the bar has
dropped never comes back at a narrower width.

**Gate.** The three parts never overlap, at seventeen widths; the identity
gives ground by decision and never by pressure; and the mode switch is
equidistant from the two flanks.

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
- **The quiet space between the centred mode switch and the actions** is
  still there at wide widths — 174 px at 1440. It is the price of a centred
  control, and after SHM-4 it falls between two *different* kinds of thing
  rather than between two halves of the same kind. Measured, judged
  deliberate, and recorded here so a later reader does not "fix" it into a
  bug by moving the mode switch off centre.

---

## The gate

`e2e/spatial.spec.ts` — 10 tests, run against the built bundle in real
Chromium, at real widths.

| # | Rule | Test |
|---|---|---|
| 1 | A sequence shows its numbers. | the journey reads 01 to 07, with or without the tick |
| 2 | A tool belongs with the tools. | "Room options" is the last tool, not the foot of the column |
| 3 | Nothing is cut without saying so. | the top bar never cuts a run of text into a fragment |
| 3 | …and the name is whole while the bar carries it. | the project name is shown whole while the bar carries it |
| 3 | The bar is three parts, and the actions are one of them. | the bar is three parts: what it is, which view, what you can do |
| 3 | …and the mode switch is the hinge between the two flanks. | *(same test)* |
| 3 | …and the three parts never overlap. | the three parts of the bar never overlap |
| 3 | The identity gives ground by decision, never by pressure. | the identity gives ground by decision, never by pressure |
| 4 | What the bar drops, the menu carries — and only then. | the More menu carries the name and the save state exactly when the bar drops them |
| 4 | …and the save state stays in the bar when the name goes. | *(same test)* |
| 5 | A control that cannot be seen is not available. | every 3D style control stays on screen |
| 2 | …on a phone, the tools stay in one row. | the phone keeps the tools in one row and the name in the menu |

**Rule 3 is the general one.** For every element in the top bar it walks up
the ancestor chain, finds the first edge that actually clips it — a clipping
ancestor, or the window — and asks whether that cut is *signalled*. Text cut
by an ancestor is a fragment. Text cut by itself with
`text-overflow: ellipsis` is a labelled truncation, which is a different
thing, and is allowed.

**The gate measures the real project.** The bar tests load the sample
project — "South Light 50 · 向阳之家", 174 px of name — not the blank plan's
"Untitled sketch". A gate that measures the bar while it carries a short name
cannot see a squeezed identity, because a short name never fills the space:
the first version of this pass measured the blank plan, and a band placed
too late passed it.

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
| the bar is three parts | the history group put back in the centre | **failed** — the actions were two halves of a bar apart again |
| the parts never overlap | the bar put back on the equal-flank grid | **failed** — *"the mode switch must not run into the actions at 1025px"* |
| the identity is never squeezed | the area band moved from 1224 px to 1149 px, so the band is too late | **failed** — *"the name must be whole at 1150px"* |
| the space is shared | `justify-content: space-between` → `flex-start` | **failed** — the mode switch was merged with the actions |
| …and it is shared *equally* | the identity pushed 60 px off the axis | **failed** — *"the mode switch is equidistant from the identity and the actions"* |
| the menu carries what the bar dropped | the menu always shows the name | **failed** — *"the menu must not repeat what the bar already shows"* |

One of those gates was **vacuous on the first run** and had to be repaired
before it counted. The rule "the menu must not repeat what the bar already
shows" was asserted against a *closed* menu, and a closed `<details>` hides
everything inside it — so the assertion passed whatever the CSS said. The
mutation proved it: making the menu always show the name changed nothing.
The gate now opens the menu before asking, and the same mutation then fails
it. A gate that cannot fail is worse than no gate, and the only way to know
is to try to break it.

**Two more were vacuous, in the same way.** The first draft of the second
pass asked whether the identity's *content* grew as the window narrowed, and
asked whether the identity's box was narrower than its content. Both were
true by construction: the drop bands are `max-width` queries, so the ladder
is one-way whatever the widths are; and a flex item that is squeezed shrinks
its children first, so the box always equals the content that is left. The
second question was replaced with the one that actually bites — *is the name
still whole* — and it only bites once the gate measures the real project.

---

## Known limits

- The top-bar thresholds are measured against the sample project's name
  (174 px). A much longer user name ellipsises the name rather than being
  dropped whole; the city is still never cut, because the meta never gives
  ground. Making the drop depend on the *measured* name rather than the
  viewport would need a measurement in the component, not a media query.
- The bands are set for the widths the sample project happens to have. A
  project with a much longer name will see the name ellipsise before the
  city is dropped. That is the intended order — the name gives first, the
  facts give last — but it is an order, not a guarantee.
- The bar's bands assume the action labels are worth their 97 px down to
  1024 px. If the actions grow — a fourth button, a longer label — the
  identity has to give up something else, and the bands move.
- SHM is a geometry audit. It cannot see a composition that is *correct* and
  still reads as noise. That judgement still needs eyes on the screen — the
  gate proves the claims, it does not make them.
