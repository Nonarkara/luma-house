# SpacePlanner, studied — and what we took from it

**Date:** 2026-10-23
**Subject:** `https://spaceplanner.co/` — the rebuilt SpacePlanner (React + Tailwind + Radix,
Base44-hosted), studied as a competitor and as a teacher.
**Method:** the editor was driven in a real browser at 1280 × 720 and its own documentation was
read. Every number below is measured, not paraphrased from marketing. Where a claim comes from
SpacePlanner's documentation rather than from the editor, it is marked **[docs]**.
**Outcome:** one mechanic ported and shipped — *type the real length of a room; the room becomes
that long* — plus an honest list of what we did not take and why.

---

## 1. What SpacePlanner is

A floor-plan editor with no analysis behind it. You draw walls and rooms on a metric sheet, it
keeps the dimensions, and it can push the same model into 3D, elevations and DXF.

The rebuilt product is not Evan Wallace's original SpacePlanner; it is a different product that
borrowed the name. That matters only for one thing — **the ideas below are the current team's
ideas, and they are good.**

---

## 2. Measured: the first screen

Opening the editor from the landing page lands you in the editor. There is no tutorial, no
overlay, no modal, no tour.

**The whole first-run instruction is one line, in the middle of the drawing:**

> **Start with a room**
> Press `R` for a rectangle or `W` to draw walls

That is the entire onboarding. It sits in the drawing's own space, it disappears the moment there
is something to draw, and it names two specific keys.

**Chrome at 1280 × 720, measured:**

| band | extent | share of the viewport |
|---|---|---|
| top bar | y 0 → 52 px | 7.2 % |
| left tool palette | x 0 → 241 px | 18.8 % |
| right panel | x 993 → 1272 px | 21.8 % |
| **the drawing** | x 241 → 993 px, y 52 → 720 px | **54.5 %** |

For comparison, designon's own measured chrome is in §6.

---

## 3. Measured: the mechanics

### 3.1 The palette is an *order of work*, and every tool carries its key

Six numbered groups, each tool showing a visible keyboard badge:

```
01  STRUCTURE              Wall (Straight) W   Room (Rectangle) R   Floor F
                           Roof ⇧R             Balcony & terrace S  Fences & railings NEW ⇧G
02  OPENINGS & CIRCULATION  Door D   Window N   Open pass-through P   Stairs U
03  FURNISH                Furniture library (Living, Bedroom, Kitchen, Bath)
04  MEASURE & LABEL        Section line NEW ⇧K   Measure M   Dimension I   Room area A
                           Room label   Note / callout T
05  OUTDOOR                Lot boundary O   Plants & trees   Garden, pool & patio
06  ELECTRICAL             Electrical C
```

Three things to take:

1. **The number on each group is the order of the task.** A first-time user is told where to
   start and what comes next, without a word of prose.
2. **Every tool shows its shortcut.** Not in a help panel — on the tool. The shortcut is
   discovered by looking at the thing you are about to press.
3. **Each tool names its own variant** ("Wall — Straight", "Room — Rectangle"), so you never have
   to click a chevron to find out what pressing the tool will do.

### 3.2 The sheet tells you where you are, in metres, all the time

- Metric **rulers on the top and left edges** of the drawing.
- A **scale bar** bottom-left (`0 — 2 m`).
- A live **cursor coordinate** readout (`X · Y ·`).
- The **grid size** in the same readout (`grid 0.50 m`).

Four small facts, always visible, in one strip. designon has a scale chip, but the ruler and the
live X/Y readout are worth stealing.

### 3.3 The numbers are on the thing they measure

In the *Grand Villa* template (33 walls, 23 openings, 115 furniture symbols) the dimension
figures are drawn **on the plan**, at 40 % zoom, and they are **colour-coded by what they
measure**:

- **black** — wall lengths (`1.16 m`)
- **blue** — opening dimensions (`0.71 m`, `1.70 m`, `2.10 m`)
- **grey, with a leader line** — room areas (`Gravel 3.39 m²`)

A first-time user can tell at a glance that `1.16 m` measures a wall and `0.71 m` measures a
window. No legend.

### 3.4 The one mechanic that matters: type the length, and the geometry moves

**[docs]** SpacePlanner's own words for the design: *"typing wall lengths rather than writing
geometry."*

- **Double-click a dimension figure → the figure becomes an input box → type → Enter.** The far
  end of the wall moves; the wall keeps its direction.
- **Typed units are accepted**: `3.5m`, `150cm`, `10' 6"`. Feet-and-inches is written `5 6`.
- **Chain dimensions**: where walls meet, one wall's length splits into a chain — one figure per
  room — so the numbers stay consistent across a junction.
- **"Measured from"** is a stated, global convention: Inner face / Centre / Outer face / Both.
  The tape-measure choice is made once, for the whole drawing.
- **Gaps are editable**: double-click the gap between a wall end and an opening → type → the
  opening *slides along its wall*; the wall itself never changes. **An impossible move is
  refused and nothing changes.**
- **Doors and windows belong to the wall**, and move with it.

Everything else in the editor (Ctrl+K command palette, layers with per-layer visibility, DXF
export, 3D and walkthrough from the same 2D model, trace-from-photo, saved views, curved walls)
is a feature list. The five bullets above are the *method*, and the method is what we had to
learn.

### 3.5 The right panel is a layers panel, and it counts

`PLAN → LAYERS 13/14` — every layer has an eye toggle, and the layers with content carry a
count (`Walls 33`, `Doors & Windows 23`, `Furniture & Symbols 115`). Below it: `AREAS 360.75 m²`
and `FINISHES BY ROOM 1/7`.

The count matters: it tells you the layer is not empty without opening it.

---

## 4. The honest comparison

### 4.1 Where SpacePlanner is simpler, and why

**It has exactly one number to fight.** A dimension in SpacePlanner is one number on one wall.
Your sketch is approximate; you replace the approximation with the measurement, per wall. There is
no global scale to reconcile, because there is no global scale.

**designon has one global scale, and that is the whole problem.** The field is calibrated from a
single known measurement (`calibrateSiteFromNapkinLine`, `calibrateRoomFromDimension`), and
*every other length on the sheet is that scale applied to a rough line*. A room you drew 30 % of
the way across the page is 30 % of the field wide. So after one calibration, the areas of the
other five rooms are **estimates wearing a measurement's clothes** — and nothing on screen said so.

**Its numbers are attached to the thing.** SpacePlanner draws `1.16 m` on the wall it measures,
in black; the opening's `0.71 m` in blue. There is no lookup, no index, no "which room was that".

**Its refusals are silent and total.** An impossible move is refused and nothing changes. There
is no error state to recover from, no modal, no red box.

**It never makes you look away.** Every tool shows its key; the first screen names two keys;
the ruler is always on.

### 4.2 Where designon is genuinely stronger

| | SpacePlanner | designon |
|---|---|---|
| Purpose | renders a plan | **argues with a plan** — the numbers are meant to be disputed |
| Sun | none | measured position by city, civil hour, year; **two solar models gated against each other** (worst azimuth Δ 7.5°) |
| Code | none | code check with the fix named |
| Cost / quantity | none | BOQ, money, carbon |
| Egress, air, daylight | none | full analysis |
| 3D | from the same 2D model | same, plus **saved study scenes** with camera, style, city and civil time |
| Offline | account-gated ("Saved here · Sign up to keep it") | **local-first and genuinely offline**; the shell is served with `X-Designon-Shell: offline` |
| Export | DXF | DXF + plan/wall-section SVG at physical millimetres + A4 study sheets |
| Payload | — | **335.7 kB cold**, 1.2 kB warm, **zero third-party requests** |

SpacePlanner draws a plan. designon lets you argue with one. That is the product, and it is the
better product.

### 4.3 Where designon was worse — the one real finding

**A user could not state a real length, and could not see one.**

- The only place a room's size could be typed was the **Inspector**, off to the side of the
  drawing.
- That field was `value={((room.w / 100) * site.w).toFixed(1)}` — a **derived** value fed back
  into itself. The stored length was therefore always a multiple of 0.1 m, and a length with
  more precision than that could not survive a keystroke.
- The **room key beside the drawing showed the area only.** The room's size — the number you
  would actually want to correct — was nowhere near the room.

So: designon had the analysis, and no way to make the analysis's inputs *yours*. The thesis
("every number on screen is meant to be argued with") was only half-true, because the numbers
could not be argued with, only scaled.

---

## 5. What we took — and what we refused to take

### 5.1 Shipped in this change

**The mechanic**, adapted to designon's own law:

- Select a room; the band above the drawing carries its real size: `W 3.92 × D 2.50 m` (where
  the band can carry it — see §5.2).
- Type over a figure and press **Enter**. The room becomes that long: **the wall keeps its
  direction, the edge it was drawn from stays put, and the far edge moves.**
- The length is read **the way a person writes one**: `4.90`, `490cm`, `12in`, `4' 6"`.
- **A length that cannot be drawn is refused and nothing changes**, and the room says why
  ("That width is longer than the 14.0 m drawing field." / "That width will not fit from where
  the room is drawn — move the room first." / "That is not a length. Type a number — 4.90, or
  490cm.").
- **The whole job is done from the keyboard**: Tab to the figure, type, Enter, Escape to put it
  back. SpacePlanner needs a double-click; a double-click is not a keyboard gesture, so we did
  not copy it.
- Both surfaces that could show a size now use **one control** (`src/components/SizeField.tsx`),
  so the Inspector's field and the band above the drawing cannot drift apart.

### 5.2 Deliberately refused, with the measurement

**We did not put the figure on the drawing.** SpacePlanner does. designon's rule is that
controls stay outside the physical drawing viewport and the room key is an external numbered
index — an architectural convention we are not giving up. The size lives in the band above the
drawing, which is where designon already keeps the selected room's ceiling height.

**We did not grow the room key to carry the size.** We built it that way first, measured it, and
took it out. A two-row key cell costs:

| viewport | drawing height before | after | cost |
|---|---|---|---|
| 390 × 844 | 423.41 px | 382.00 px | **−41 px** |
| 1024 × 900 | 443.61 px | 284.61 px | **−159 px (−36 %)** |

At 1024 the key sits *below* the drawing, so a taller key is a shorter drawing: a third of the
drawing spent on a number that is already in the band above it. That is a spatial hallucination
by our own hand, so we reverted it.

**We did not put the size in the band on a phone.** Measured, with the band carrying the size:
the band grows from **58 px to 102 px** and the phone drawing falls from **423.41 px to
371.40 px** — 52 px, 12 % of it. The band also stopped being one row and started to collide with
the journey rail above it. So on a phone the band stays as it was and **the panel states the
length instead** — the panel and the band use the same control
(`src/components/SizeField.tsx`), so the phone is not a lesser version of the feature, it is
the same feature one tap away.

**Measured cost of what we did ship: zero.** The drawing is the same height at 375, 390, 1024 and
1440 as it was before this change — 417.03 / 423.41 / 443.61 / 577.61 px, identical to the parent
commit. The phone band is the same height it was at HEAD (58 px), and the gate
*"the band does not grow to carry the size"* pins that.

**We did not copy "Measured from" yet** — it is the right idea and it needs a decision about
which face our lengths are measured to (see below).

### 5.3 The gates that own each claim

Every rule above has a gate that can fail. Each was mutated; each mutation was killed by the
gate that owns it.

| rule | gate | mutation | result |
|---|---|---|---|
| the edge it was drawn from stays put | `src/canvas/roomSize.test.ts`, `e2e/room-size.spec.ts` | move the near edge | killed by both |
| an impossible length changes nothing | same | delete the fit check | killed by both |
| units are read | same | break the `cm` factor | killed by both |
| the refusal says why | same | replace the message | killed by both |
| a stated small room is not inflated by a later drag | `src/canvas/geometry.test.ts` | restore the old floor | killed |
| the phone band does not grow for the size | `e2e/room-size.spec.ts` | show the size on the phone | killed |

The browser suite is `e2e/room-size.spec.ts` — 13 cases, run on the desktop project and on the
phone project. The two phone-only cases skip on the desktop, and the one band-only case skips on
the phone. The desktop project runs at 1280 × 800 and the phone project at 390 × 844, so the same
gesture is driven on both.

---

## 6. designon's own chrome, for the comparison

Measured on the same method, the drawing and the key:

| viewport | top bar | room key | the drawing |
|---|---|---|---|
| 375 × 844 | 48 px | 56.59 px | **417.03 px** |
| 390 × 844 | 48 px | 56.59 px | **423.41 px** |
| 1024 × 900 | 48 px | 134 px | **443.61 px** |
| 1440 × 900 | 48 px | 688 px (right column) | **577.61 px** |

At 1440 the room key is a 240 px column to the right of the drawing, not a band under it, and
its height does not compete with the drawing. **That is where the size could be shown as well** —
six one-row cells use 264 px of the 688 px available, and six two-row cells would use 582 px and
still fit. See §7.

---

## 7. What we did not take, and the order we would take it

1. **Mark scaled dimensions as estimates.** A length that came from the global calibration is an
   estimate; only a length the user stated is a measurement. designon's law says *"Anything
   approximate says so on screen. Do not present an estimate as a measurement."* Today the areas
   are unmarked. The honest fix is a per-axis flag and a `~` on the figure — and it is the single
   most important thing left in this thread.
2. **A stated length should survive a re-calibration.** Today a stated length is stored as a
   share of the field, so re-calibrating the field rescales it. The honest model stores the
   stated metres and re-derives the drawing from them.
3. **"Measured from" — inner face / centre / outer face.** A stated length should say which face
   it is measured to. SpacePlanner makes this one global choice; so should we.
4. **Show the size in the room key, on wide screens only.** Measured above: at ≥ 1100 px the key
   is a right-hand column with room to spare and the drawing does not shrink. Below 1100 px the
   key competes with the drawing and must stay one row.
5. **The ruler and the live X/Y readout.** SpacePlanner's sheet carries metric rulers on two
   edges and a cursor position readout in the same strip as the scale bar. designon has a scale
   chip; the rulers would make the field's scale legible without counting.
6. **The palette's numbered order of work.** designon's tool palette is a flat row of pills. The
   tools have a natural order (draw → open → measure → label) that is not visible.
7. **"Show in export" per dimension**, and a layers panel with counts. designon has neither; the
   export currently carries everything.
8. **The phone's band costs the drawing 52 px.** Measured, and *pre-existing* — not from this
   change: on a phone, selecting a room makes the band appear, and the drawing falls from
   423.41 px to 371.40 px. The band takes a row of the page instead of overlaying the drawing's
   own margin the way the toast does. It is the last piece of spatial hallucination we know
   about, and it is measured.

---

## 8. What this study changed about designon

Nothing about what designon *is*. It remains the tool that lets you argue with a plan: sun,
code, cost, carbon, egress, offline, export, and numbers you are supposed to disagree with.

What changed is that **you can now put your own numbers into it.** Until this change, every
length on the sheet but one was the calibration applied to a rough line. The mechanic SpacePlanner
teaches is not "draw better" — it is *"the drawing is a sketch and the numbers are the truth,
and you get to write the numbers."* designon had the second half of the product and not the
first.

---

## 9. Production verification

The change is live. The record, measured on the deployed host and not on a local build:

**Deploy.** The feature commit `7706635` on `https://designon.nonarkara.org/`. At the moment of
verification the page's own build stamp read `77066357d268037587166319e8f5a131d8650b02`, and the
GitHub Pages mirror carried the same stamp. The release gate refused to publish until the CI
run for that exact commit reported success.

**The browser suite, run against the live host.** The whole suite — 18 specs, desktop 1280 × 800
and phone 390 × 844 — was re-run with `baseURL` pointed at `https://designon.nonarkara.org/`
rather than the local preview server:

> **232 passed, 20 skipped, 0 failed (17.4 m)**

That is the deployed bytes, not a build that resembles them.

**The mechanic, driven on the live host.** A real Chromium session, three viewports:

| viewport | figure before | stated | far edge | near edge | area before → after | refused at 99 m |
|---|---|---|---|---|---|---|
| 1440 × 900 | `3.92` | `3.50` | 28 % → 25 % | 18.75 % (fixed) | 9.8 → **8.8 m²** | "That width is longer than the 14.0 m drawing field." |
| 1024 × 800 | `3.92` | `3.50` | 28 % → 25 % | 18.75 % (fixed) | 9.8 → **8.8 m²** | same |
| 390 × 844 | `3.92` | `3.50` | 28 % → 25 % | 18.75 % (fixed) | 9.8 → **8.8 m²** | same |

A refused length changed nothing at any viewport: the room's rectangle was byte-identical before
and after, and the figure snapped back to the true value (`3.50`) rather than keeping `99`.

**Chrome on the live host.** Top bar 48 px at every viewport; the contextual band 58 px at every
viewport — the same as before the change. The drawing measured 581.61 px (1440), 347.61 px
(1024) and 371.41 px (390, with the band showing because a room is selected — the pre-existing
52 px cost recorded in §7.8).

**The cost of the page did not change.** 337 kB transferred on a cold load, **20 requests, 0
third-party**, one host. Nothing about this feature put a network call on the critical path.

**Console.** Zero page errors and zero console errors across all three viewports.
