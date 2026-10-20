# designon — Shipping Audit

**Date:** 2026-10-20
**Subject:** Can this be shipped? A second pass, measured rather than argued.
**Supersedes nothing.** `docs/AUDIT-2026-10-20.md` mapped the system. This
document answers the narrower question: what would stop this reaching a
person's browser today, and what happens after it does.

Every number below was produced by running the built application. Where a
claim could not be measured, it says so. The findings marked **Fixed** were
fixed in the same commit as this document.

---

## 0. The short answer

It can ship. Nothing in this pass found a defect that blocks release.

What it found instead was a set of things that make a good product feel
cheap: 375 kB of brand artwork for a 150-pixel wordmark, a cache policy that
re-downloaded the whole app on every release, no boundary between a crashed
component and a blank page, an installed app that could not open without a
signal, and a `verify` script that did not run the browser tests.

Four of those five are now fixed and measured. The fifth — the two solar
models, 39° apart — is still open and is the one thing in the system that
should worry a person who trusts a number on the screen.

### What changed in this pass

| | Before | After |
|---|---|---|
| Cold landing, transferred | 673 kB | **348 kB** |
| Brand artwork | 375 kB | **50 kB** |
| Warm revisit, transferred | 0 kB / 77 ms | **0.7 kB / 13 ms** |
| Render crash | blank page | **recovery sheet, drawing recoverable** |
| Hashed assets | `max-age=14400` | **immutable, one year** |
| Installed app, no network | fails | **opens and draws** |
| `npm run verify` | 4 of 5 gate families | **all five** |

---

## 1. Why it feels instant

The observation was that moving anything shows its result at once, with no
loading. The hypothesis was that the system is light.

**The system is light. But that is not why.**

Measured over 2.5 s of idle, in a real Chromium, through the DevTools
protocol:

| | 2D desk | 3D scene |
|---|---|---|
| Layouts | 0 | 0 |
| Style recalculations | 0 | 0 |
| Script time | ~4 ms | ~2.7 ms |

Input to painted frame during a wall drag: **median 14 ms** (min 2, max 30),
2 ms to commit.

An application that does *nothing* is not competing for the frame budget. It
is not "light" in the sense of being cheap to load — the 3D scene alone is
1,077 kB of raw JavaScript — it is light in the sense that it is **idle**.
The system re-renders on demand and then stops. That is the entire reason
the interaction feels immediate, and it is a property of the architecture
(React state, demand frames, no polling loop), not of the payload size.

The honest corollary: the speed will survive a 3× larger payload, and it
would not survive a design that started working continuously. Neither is
true today.

---

## 2. Payload

### 2.1 Brand artwork was 375 kB for a 150-pixel wordmark — **Fixed**

Four PNGs, each far larger than the size they are displayed at:

| File | Was | Displayed at | Now |
|---|---|---|---|
| `designon-wordmark.png` | 800×188, 75 kB | 150 px | 400×94, 30 kB |
| `designon-app.png` | 512×500, 175 kB | 28 px | 64×62, 6 kB |
| `designon-symbol.png` | 512×415, 123 kB | 36 px | 128×103, 10 kB |
| `designon-mono.png` | 256×209, 30 kB | favicon | 64×52, 4 kB |

**375 kB → 50 kB.** That is more than the entire JavaScript and CSS of the
application combined, spent on four logos.

The rule is now a test (`src/brandAssets.test.ts`): each asset has a width
ceiling and a byte ceiling, and the manifest icons are pinned to the 192 and
512 px they declare. Re-inflating `designon-app.png` to 512 px fails the
gate with `expected 512 to be less than or equal to 64`.

### 2.2 The cold landing now transfers 348 kB

Measured against the production build through the DevTools protocol, on the
wire (encoded):

```
requests: 20   transferred: 347.9 kB   DCL 34 ms   load 34 ms
  js      167.5 kB      fonts 93.2 kB      images 49.6 kB
  css      35.7 kB      html    1.8 kB
```

A warm revisit transfers **0.7 kB in 13 ms** — the application is entirely in
the browser's cache.

The 3D scene remains the heaviest thing in the product: `Spatial3D` is
1,077 kB raw / 295 kB gzip, lazy-loaded, and the landing page does not
request it at all. That is the correct trade and it was already made.

---

## 3. Cache policy — **Fixed**

Production served every hashed asset as:

```
cache-control: public, max-age=14400, must-revalidate
```

Four hours. Every release therefore re-downloaded the whole application for
every returning visitor, despite the filenames being content-hashed — the
one case where a long cache is unambiguously safe.

`public/_headers` now sets:

| Path | Policy | Why |
|---|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` | The filename is the hash of the content. It cannot change under the same name. |
| `/brand/*` | `public, max-age=3600, must-revalidate` | Stable names; a change must be picked up. |
| `/sw.js` | `public, max-age=0, must-revalidate` | A stale worker is a worker that never gets corrected. |

`vite.config.ts` now parses that file with a rule-aware parser and mirrors
it path-for-path in the preview server, so what is tested locally is what is
served in production. **The build refuses to ship** if the CSP is missing or
if `/assets/*` is not `immutable`. That guard was written first and caught a
malformed `_headers` during this pass — which is the only interesting way to
find out that a guard works.

`Strict-Transport-Security` was added to the shared rule set.

### What the CDN in front of the custom domain does with them

Measured on `designon.nonarkara.org` after deploying, against the deployment
URL for comparison:

| Path | `_headers` says | The deployment serves | The custom domain serves |
|---|---|---|---|
| `/assets/*.js` | immutable | **immutable** | **immutable** |
| `/brand/*.png` | `max-age=3600` | `max-age=3600` | `max-age=14400` |
| `/sw.js` | `max-age=0` | `max-age=0` | `max-age=14400` |
| `/` | (unset) | `max-age=0` | `max-age=0` |

The custom domain sits behind a zone cache with a four-hour edge TTL, and it
rewrites `Cache-Control` to match — except for `immutable`, which it
honours. So the rule that matters most, the one that stops every release
re-downloading the application, is the one that survives. `/brand/*` lands on
four hours instead of one, which is harmless for artwork that changes
rarely.

`/sw.js` landing on four hours is not harmless, and it cannot be fixed from
the repository, because the header that would prevent it is exactly the
header the zone rewrites. So the application does not depend on it:
**`registerOfflineShell()` calls `registration.update()` on every load.** The
browser then asks for the worker script with `cache: 'no-cache'`, the edge
revalidates it against the origin, and a corrected worker is in place on the
next load rather than up to four hours later. Freshness stops depending on a
cache policy that somebody else controls.

This is worth recording as a rule rather than a fix: *a service worker whose
freshness depends on a `Cache-Control` header is a service worker whose
freshness depends on someone else's CDN.*

---

## 4. A crash must not blank the page — **Fixed**

There was no application-level error boundary. `FurnitureMesh.tsx` had one;
nothing above it did. A render error anywhere in the desk produced a white
page and a lost drawing.

`src/components/AppErrorBoundary.tsx` now catches it and shows a recovery
sheet that offers the saved plan back as a file, read from `localStorage`.

The gate is behavioural, not textual. `selftest.html` is a second build entry
(`src/selftest.tsx`) that throws during render on purpose; `e2e/error-boundary.spec.ts`
loads it in a real browser and asserts that the recovery sheet appears, that
the download yields the saved plan's JSON, and that no download is offered
when nothing was saved. Removing the boundary makes the gate fail.

---

## 5. The installed app could not open without a signal — **Fixed**

This is the finding that changed the product's shape.

The application markets installation: `manifest.webmanifest`, dedicated
192/512 and Apple touch icons, and an onboarding panel that says *Available on
Android and iPhone — Add to Home Screen*. `docs/BRANDING.md` said plainly:

> There is no offline shell or service-worker cache; loading the application
> and AI features needs internet.

But the truth was more interesting than the sentence. Every drawing, sun
study, climate number and cost estimate is computed in the browser. The AI
trace is disabled. **Once the application is loaded, nothing in it needs the
network at all.** The gap was only the first load — and for an installed app
opened on a site, that is the only load that matters.

`public/sw.js` is now the offline shell:

| Request | Policy |
|---|---|
| Navigation | Network-first. The cached shell is the fallback when the network is gone. A visit that reaches the network always gets the current build. |
| `/assets/*`, `/brand/*` | Cache-first. Filenames are content-hashed, so a cached file is by definition the file the page asked for. |
| Everything else | Not intercepted. The page keeps its own request events, and the furniture models are never cached. |

The worker lives beside the application and takes its scope from its own
location, so one file serves the root domain and the `/luma-house/` mirror.

### The bug the gate caught

`Vary: Origin`. The build's files are served with it, and the document loads
its module scripts with the `crossorigin` attribute — so the page's request
carries an `Origin` header that the worker's own fetch did not. A
request-keyed cache lookup therefore missed **every** build file, the
application loaded with no code at all, and the offline start silently
failed.

The fix is to look the files up by URL. The finding matters more than the
fix: the first version of the test passed against a build where the worker
was doing nothing, because the browser's own HTTP cache was answering. The
test now clears the HTTP cache before going offline, so only the worker can
answer.

### The gates, mutation-checked

| Mutation | Result |
|---|---|
| Asset lookup keyed by the request instead of the URL | **caught** |
| The offline marker header removed | **caught** |
| The install-time precache removed | **caught** (after the fix below) |
| The navigation fallback removed | **caught** |

The third one was **missed** on the first run. That is the honest record: the
test asserted "the app opens offline", which was true — but the browser's
HTTP cache was serving the files, so the worker was never exercised. The
gate now clears the HTTP cache first, and the precache mutation fails it.

The worker marks the shell it serves with `X-Designon-Shell: offline`, so an
offline start is visible in the network panel rather than looking like an
ordinary page load.

The worker asks to be re-checked on every load. The browser only re-fetches
a worker script on its own schedule, and the CDN in front of the custom
domain holds it for four hours — see §3. A corrected worker therefore
reaches the next visitor rather than the next visitor four hours later.

---

## 6. The gate set did not include the browser tests — **Fixed**

`npm run verify` ran lint, build, unit tests and the worker's tests. It did
not run Playwright. The browser suite is where the defects that matter have
actually been caught — the inspector overlay that covered the top bar, the
print scale, the label collisions, the cache headers, the crash, the offline
shell. A gate that excludes the suite where the defects live is a gate that
certifies the easy half.

```
"verify": "npm run lint && npm run build && npm test && npm run verify:worker && npm run test:e2e:fast"
```

One build, then the browser. `npm run verify` now runs everything.

---

## 7. Robustness checks that found nothing

Recorded because "we looked and it was fine" is a result, and because the
next person should not have to look again.

- **21 malformed share links** fuzzed against production — null names,
  unknown kinds, string coordinates, `1e400` infinities, negative sizes,
  garbage assemblies, 5000 rooms, `rooms: "nope"`, `{}`. **21/21 handled
  cleanly**: no blank page, no recovery sheet, zero console errors. The
  sanitiser in `src/sharePlan.ts` is genuinely robust.
- **No service-worker/analytics/offline listeners** outside the ones added
  here. No third-party calls on the landing page.
- **`npm audit --production`**: 0 vulnerabilities.
- **Storage writes** are wrapped for quota and private-mode failures.
- **`public/404.html`** exists.

---

## 8. Still open

### 8.1 Two solar models, 39° apart — **not fixed here**

Carried over from the first audit and still the largest open defect.
`src/plan.ts:360-379` uses a local-solar-time approximation; the 3D scene
uses SunCalc in civil time (`src/location/solar.ts:36-38`). Measured
divergence reaches **39.1° of azimuth** (New York, 13:00) and about 10° in
Bangkok and Shanghai.

Two numbers on one screen, from two models, disagreeing by 39° — in a
product whose entire claim is that its numbers can be argued with. This
should be fixed before the app is shown to anyone whose opinion matters.

### 8.2 A release still re-downloads the app for a first-time visitor

Expected, and now much smaller (348 kB rather than 673 kB). The
content-hashed filenames mean returning visitors pay nothing.

### 8.3 The custom domain rewrites `Cache-Control`

The zone cache in front of `designon.nonarkara.org` applies a four-hour edge
TTL and rewrites the header to match. Only `immutable` survives untouched.
The hashed build files — the ones that matter — are immutable, so the cost is
small. It does mean the repository's `_headers` rules are not the last word
on the primary host, and anything that depends on a header there should
depend on something else too. Measured in §3.

### 8.4 The mirror has no cache headers at all

GitHub Pages ignores `_headers` — it is a Cloudflare Pages feature — and
serves everything with `cache-control: max-age=600`. A returning visitor to
`nonarkara.github.io/luma-house/` therefore re-downloads the whole
application every ten minutes, 341 kB at a time.

The offline shell repairs this without the mirror's cooperation: the
worker's cache-first rule for `/assets/*` applies whatever the server says
about caching, and the filenames are content-hashed, so a cached file is
always the right file. The mirror's own header policy stops mattering
because the browser stops asking.

The worker is served correctly on the mirror — `/luma-house/sw.js`,
`content-type: application/javascript` — and takes its scope from its own
location, so the same file serves both hosts.

### 8.5 No declared browser targets

`browserslist` is absent. The application uses `dialog`, `navigator.clipboard`
and `ResizeObserver` — all modern-browser assumptions, declared nowhere. The
offline worker uses `Cache Storage` with `ignoreVary`, which needs Chrome 46+,
Firefox 44+ or Safari 15.4+.

---

## 9. What this audit did not do

- It did not re-audit the mathematics. `docs/AUDIT-2026-10-20.md` §4 covers
  it, and its headline finding stands.
- It did not test a physical phone. Every browser measurement here is
  Chromium at 1280×800 and 390×844.
- It did not load-test, and did not measure the worker on a cold device with
  an empty cache directory.
- It did not test the offline shell on a physical phone or on iOS Safari;
  every offline measurement here is Chromium.

---

## Appendix — how to reproduce the numbers

```bash
npm run build && npm run preview -- --port 4186 --strictPort
```

- **Payload**: a DevTools-protocol session counting `Network.loadingFinished`
  `encodedDataLength` over a cold and a warm load.
- **Idle cost**: `Performance.getMetrics` sampled 2.5 s after load, before
  and after opening the 3D scene.
- **Input latency**: pointer events dispatched against the wall tool,
  timestamped to the next painted frame.
- **Offline**: `Network.clearBrowserCache` followed by
  `context.setOffline(true)`, then a reload whose response must carry
  `X-Designon-Shell: offline`.
