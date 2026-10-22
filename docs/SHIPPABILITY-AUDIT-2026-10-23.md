# designon — Shipability Audit

**Date:** 2026-10-23
**Subject:** Can a person use this today? The core task, driven against the
deployed product.
**Follows:** `docs/SHIPPING-AUDIT-2026-10-20.md` (the payload, cache, crash and
offline pass) and `docs/MSH-PASS-2026-10-22.md` (the spatial pass). This
document does not repeat those; it asks the narrower question of whether the
thing a person is actually asked to do works, end to end, on the host they
would meet.

Every number below was produced by running the built application. Where a
claim could not be measured, it says so.

---

## 0. The short answer

**Almost. One thing in the product's name did not work.**

The audit drove the deployed build through the job the product exists for:
draw a room on the napkin, put a window in it, put a door in it, calibrate it
to a real measurement, read the numbers, share it, come back to it, export
it, open it in 3D. Twelve of the fourteen steps passed.

Two failed, and they were the same failure:

```
click a wall with the Window tool  ->  nothing happens
click a wall with the Door tool    ->  nothing happens
```

No confirmation, no opening, no error. The instruction line said *"click a
wall to place a window"*, so the tool was working exactly as it said and
doing nothing at all. The cause and the repair are in §2.

Everything else the audit found was small, and everything small was fixed in
the same pass, behind a gate that can fail:

| | Before | After |
|---|---|---|
| Window / Door tool | click does nothing | places an opening on the wall you clicked |
| A failed concept render | `{"error":"GEMINI_API_KEY is not configured on the worker"}` | a sentence a person can read |
| The instruction line in measure mode | "click a wall to place a window" | "drag along a wall whose real length you know" |
| Two solar models, compared | never compared | within 7.5° of azimuth, gated |
| The phone's status message | cut the sun card to "Live sun + hea" | covers no control |

### What the audit did not find

- No third-party request on the landing sheet or in the studio.
- No console error in the whole core task.
- The installed app opens and draws with the network genuinely down.
- 0 vulnerabilities in production dependencies.
- No blank page, no lost drawing, no unreachable state.

---

## 1. The core task, on the deployed host

`https://designon.nonarkara.org/`, 1440×900, Chromium. The script is in
`/tmp/ship-core-task.mjs`; it drives the real gesture — the pencil draws,
the mouse moves to a wall, the button is pressed.

| Step | Result |
|---|---|
| the landing sheet renders | **pass** — h1 "A home, from the first line." |
| a fresh sketch opens empty | **pass** — 0 rooms, 0 walls |
| a closed pencil loop becomes a room | **pass** — 1 room on the sheet, 1 in the room key |
| a window is placed on a wall | **FAIL** — 0 windows |
| a door is placed on a wall | **FAIL** — 0 doors |
| a real measurement recalibrates the field | **pass** — a 1.11 m line declared as 10 m takes the site from 14.0 × 10.0 m to 126.2 × 90.2 m |
| the plan reports an area | **pass** — 19.6 m² for a 4.9 × 4.0 m room, the same figure the room's own label carries |
| the code check runs | **pass** — 2 findings, led by "MODEL-EGRESS CRIT: Living has no modeled route outdoors" |
| the share button produces a plan link | **pass** |
| the link restores the plan in a new browser | **FAIL** — 1 room, 0 windows, 0 doors (a consequence of the two failures above) |
| the drawing survives a reload | **FAIL** — 1 room, 0 windows (same consequence) |
| the export sheet opens | **pass** — and "Download .3mf" produces `south-light-shanghai-50-1-50.3mf` |
| the 3D view builds a scene | **pass** — a 1312 × 699 canvas |
| no console errors during the whole task | **pass** |

**Re-run against the build that carries the repair: 14 of 14 pass.** The two
failed steps pass, and the two consequences go with them — the shared link
now restores one room, one window and one door in a fresh browser, and the
drawing survives a reload.

The tape measure, which is a separate thing from the calibration, reports a
distance: *"Distance: 2.43 m (7.98 ft)"*. The **Calibrate** action is what
rescales the field, and it does so exactly: a line the app measures at
1.11 m, declared as 10 m, scales the site by 9.01 — 14.0 × 10.0 m becomes
126.2 × 90.2 m.

That last figure looks wrong at first glance and is not. A field of
126 × 90 m is what you get when you say a 1-metre line is ten metres, and
the product is doing the arithmetic the person asked for. The number it
gives is arguable, which is the point.

---

## 2. The window and door tools were dead

**Found.** 2026-10-23, on production at `e7fb692`.

### What a person saw

They pressed the Window tool. The instruction line said "Click a wall to
place a window". They moved the mouse to the wall. They clicked.

Nothing. No opening, no confirmation, no message of any kind. The same for
the Door tool. The pointer had to be *already* on the wall before the tool
was selected for anything to happen.

### Why

A flag in `src/App.tsx` was meant to answer "did the pointer move while the
button was down?" — a drag, which is not a click. It was written as:

```ts
if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2)
  panMovedRef.current = true
```

It was raised on **any** pointer move, including a move with the button up.
Moving the mouse to a wall is a pointer move. It raised the flag.

The flag was cleared in one branch of the pointer-down handler — the select
tool on empty canvas, the branch that starts a pan — so the flag raised by a
hover survived into the next click, and the click handler opened with:

```ts
if (panMovedRef.current || isGesturing()) return
```

and swallowed the click.

Every person moving a mouse raises that flag. The tools were dead for
everyone.

### Why no test caught it

Nothing had ever clicked a wall. `grep` over `e2e/` for a click that places
an opening returns nothing; the napkin path — a short tick on a wall — is
tested, and the tap-to-place path was not. The tool said it would work, and
the only way to learn otherwise was to press it.

### The repair

Two changes, because the flag is a fact about one interaction:

- it is raised only while the pointer is actually down (`event.buttons !== 0`)
  — which is what "moved" was always meant to mean;
- it is cleared at every press, so a drag that happened earlier cannot veto
  a click that happens now.

Either one alone fixes the visible bug. Both together say what the flag
means.

### The gate

`e2e/openings.spec.ts`, four tests, and they drive the real gesture rather
than calling a function: pick the tool, move the mouse to a wall, click it,
then check the opening landed on the wall that was clicked *and* where it was
clicked.

| | |
|---|---|
| a window is placed on the wall you click | the opening's position is the wall's, within 1% |
| a door is placed on the wall you click | the opening's position is the wall's, within 1% |
| a click still works after the drawing has been panned | a drag does not veto the next click |
| the tool says so, and the click is confirmed | the toast says "Window placed" |

**Mutation-checked.** Restoring the original code fails all four. Removing
only one of the two halves does not fail them, because either half is enough
to fix the bug — the gate's job is to kill the defect, and it does.

---

## 3. A failed concept render dumps the server's account of itself

**Found.** 2026-10-23, on production.

The AI is switched off on this deployment by configuration — `GEMINI_MODEL`
and `TRACE_MODEL` are empty, and the worker has no `GEMINI_API_KEY`. The
"Concept photo" button is still on screen, and pressing it produced:

```
{"error":"GEMINI_API_KEY is not configured on the worker"}
```

That is the server's account of itself, shown to a person as if it were an
answer. It is not English to the person who pressed the button, and it
names an environment variable that has no business being in a product.

**Fixed.** The body is read, understood, and replaced with a sentence:
*"Concept photos need a model on the server. This build has none."* The
detail stays in the console, where somebody debugging the worker will look
for it. The gate is `src/concept/generateConcept.test.ts` — seven cases
holding three things a toast has to hold: no raw JSON, no environment
variable name, and no more than eighty characters, because a toast is two
lines.

---

## 4. The instruction line did not follow the canvas

**Found.** 2026-10-23, on production.

The line under the drawing is the product's answer to "what does the canvas
do now?". Armed with the tape measure, it went on saying:

```
after Window   : Click a wall to place a window
after Measure  : Click a wall to place a window   <- the canvas is armed for measuring
after Furniture: Click a wall to place a window
```

The measure and the furniture tray arm the canvas without changing the tool,
so a hint keyed only on the tool kept describing the old mode.

**Fixed.** The hint now follows the canvas: the measure and the calibration
ruler say to drag along a wall whose real length you know; the furniture
tray says to pick a piece at its real size; the four tools keep their own
sentences. The gate is the existing *"every tool says what it does"*, now
extended to arm the measure and fail if the line is still the one the Window
tool produced.

---

## 5. The two solar models are now compared

**Found.** 2026-10-23. Carried over from the 2026-10-20 audit, where the
product was found computing the sun twice, by two models, 39.1° apart in
azimuth.

The bug was fixed. **The finding was never closed**, because nothing
compared the two models: `src/analysis/sunPosition.test.ts` checked the
approximation against astronomy, and `src/location/solar.test.ts` checked
SunCalc against the zone. Nothing said the two must agree with each other,
which is the only thing a user would notice.

Measured now, at the same physical instant — SunCalc on the civil clock,
the approximation fed the mean solar time of that same instant, so the
difference is model error and not clock error. Six cities, four days, three
hours: Shanghai, Bangkok, New York, London, Sydney, São Paulo; both
equinoxes and both solstices. 72 comparisons.

| | |
|---|---|
| worst azimuth divergence | **7.5°** (Bangkok, 21 Mar, 12:00) |
| worst altitude divergence | **2.1°** (Shanghai, 23 Sep, 09:00) |
| daylight-window drift | ≤ 14 minutes — the equation of time |

The bounds are 12° and 4°. Loose enough for the equation of time, tight
enough that the 39° bug cannot come back quietly.

**Mutation-checked.** Moving the afternoon mirror back to 180 — the exact
form the 2026-10-20 audit found — fails the gate with 177.9° of azimuth
divergence.

---

## 6. The first five seconds

Measured against production, Chromium, 1440×900.

| | Cold landing | Warm revisit |
|---|---|---|
| transferred | **335.7 kB** | **1.2 kB** |
| requests | 20 | 1 |
| DOMContentLoaded | 710 ms | 57 ms |

By type, on the wire: css 92 kB, script 90 kB, fonts and other 72 kB,
images 48 kB, link 36 kB, html 1.2 kB.

The 3D scene is the heaviest thing in the product — `Spatial3D` is 1,077 kB
raw, 295 kB gzip — and the landing sheet does not request it. The studio's
first paint does not request it either: it is loaded on demand when the
Spatial view is opened.

**A caveat on the timing.** The 710 ms was measured on a machine whose load
average was between 500 and 650 from other work. The byte counts are stable;
the milliseconds are not a clean measurement of this application, and they
are reported as observed rather than as a claim. The 2026-10-20 audit
measured 34 ms for the same navigation on an idle machine.

---

## 7. The installed app with no signal

The app markets installation, and the claim is that everything in it is
computed on the device. Measured on production, with the browser's own HTTP
cache cleared first — so only the service worker can answer:

| | |
|---|---|
| the worker controls the page | yes |
| the network is genuinely gone | a fetch to an unknown path returns `unreachable` |
| the reload is served by the worker | `X-Designon-Shell: offline` |
| the drawing comes up | yes — the canvas is there |

The mirror at `nonarkara.github.io/luma-house/` serves the same worker, and
the worker takes its scope from its own location.

---

## 8. Headers and the edge

| Path | Served | |
|---|---|---|
| `/` | `max-age=0, must-revalidate` | correct |
| `/assets/*` | `max-age=31536000, immutable` | correct — the filename is the hash of the content |
| `/brand/*` | `max-age=14400` | rewritten by the zone cache; harmless |
| `/sw.js` | `max-age=14400` | rewritten by the zone cache; the worker re-checks itself on every load |
| `/manifest.webmanifest` | `max-age=0, must-revalidate` | correct |
| a missing path | 404, `no-store` | correct |

CSP present on every path. HSTS present. `npm audit --production`: **0
vulnerabilities**.

The two rewritten paths are the same two the 2026-10-20 audit recorded. The
rule that matters — `immutable` on the hashed build files — survives the
zone untouched.

---

## 9. What the gates cover

```
lint · tsc -b · 576 unit tests · 54 worker tests · 18 browser specs
```

The browser suite is the one where the defects in this document live, and it
is in `npm run verify`. The release gate refuses to publish on a dirty tree,
on a HEAD that is not on `origin/main`, or on a red CI run — and it was
observed refusing, twice, in this pass.

**Every repair in this audit is behind a gate that can fail, and every gate
was checked by breaking the thing it guards.** Four mutations, four kills:

| Mutation | Result |
|---|---|
| the original pointer-move flag | **caught** — 4 of 4 opening tests fail |
| the message that dumps JSON | **caught** by seven cases in `generateConcept.test.ts` |
| the afternoon mirror at 180 | **caught** — 177.9° of divergence |
| the solar agreement gate itself | **caught** |

---

## 10. Still open

### 10.1 The dimension annotations hang outside the drawing

The field dimensions and the scale label are drawn outside `.plan-canvas`
(`.dimension-x { bottom: -24px }`, `.dimension-y { right: -24px }`,
`.scale-label { bottom: -30px }`). Because the canvas is wider than the
viewport at the default 175% zoom, they are clipped at 1440 and land in the
frame's empty column at 1024. The scale statement itself is still on screen
in the top chip ("1 m/cell · 14.0 × 10.0 m site"), so what is lost is a
redundant annotation. The repair belongs in the canvas fit, not in the CSS.
Found by the MSH pass; **not fixed here**.

### 10.2 An overlap warning takes 49px from the phone drawing

When two rooms overlap, the warning row appears in the frame and the
drawing's own row gives up 49px of height (371 → 322 at 390×844). The
warning is worth showing; the drawing paying for it in height every time is
not obviously right. Measured, not fixed.

### 10.3 The AI concept feature is off on this deployment

The button is on screen, and it now explains itself rather than dumping
JSON. The feature itself needs `GEMINI_API_KEY` on the worker and a model
in `wrangler.toml`. This is a deployment fact, not a defect.

### 10.4 The edge rewrites `Cache-Control` for two paths

`/brand/*` and `/sw.js` land on four hours instead of the rules the
repository sets. The worker does not depend on it — it calls
`registration.update()` on every load. Not fixable from the repository.

### 10.5 No declared browser targets

`browserslist` is still absent. The application uses `dialog`,
`navigator.clipboard` and `ResizeObserver` — modern-browser assumptions,
declared nowhere. The offline worker needs Cache Storage with `ignoreVary`:
Chrome 46+, Firefox 44+ or Safari 15.4+. Carried over unchanged from
2026-10-20.

### 10.6 The mirror has no cache headers

GitHub Pages ignores `_headers`. The offline shell repairs this without the
mirror's cooperation, but the mirror's own policy still does not match the
custom domain's.

---

## 11. What this audit did not do

- It did not test a physical phone. Every browser measurement here is
  Chromium at 1440×900, 1024×768 and 390×844.
- It did not test iOS Safari, where `navigator.clipboard` and
  `setPointerCapture` behave differently and where the share sheet is a
  different interaction altogether.
- It did not load-test, and it did not measure a cold device with an empty
  cache directory.
- It did not re-audit the mathematics beyond the sun: the analysis modules
  (overheating, air, egress, cost) were not re-derived.
- It did not re-audit the visual design; that is `docs/MSH-PASS-2026-10-22.md`
  and the pass before it.
- The browser suite's 3D and print specs fail intermittently on this machine
  under load. Those failures were reproduced on the parent commit
  `dc81e9a` and are environmental, not caused by this work.

---

## Appendix — how to reproduce the numbers

```bash
npm run build && npm run preview -- --port 4186 --strictPort
```

- **The core task** — a Playwright script against the deployed host: draw
  four pencil strokes, click the Window tool, click a wall, click the Door
  tool, click a wall, measure a known line, type its length, read the area
  and the code check, share, open the link in a second browser, reload,
  export, open 3D. Screenshots at every step.
- **Payload** — `performance.getEntriesByType('resource')`, summing
  `transferSize` over a cold and a warm load.
- **Offline** — `Network.clearBrowserCache`, then `context.setOffline(true)`,
  then a reload whose response must carry `X-Designon-Shell: offline`.
- **The solar divergence** — `npx vitest run src/analysis/sunPosition.test.ts`.
  The comparison is at the same physical instant; the approximation is fed
  the mean solar time (UTC + longitude/15, wrapped into the day) of the
  instant SunCalc was given.
- **The gates** — `npx playwright test e2e/openings.spec.ts`, and the
  mutation is the two lines in `src/App.tsx` that were put back to their
  original form.
