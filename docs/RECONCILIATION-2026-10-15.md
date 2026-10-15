# MiniMax and draft PR reconciliation

## Scope and invariant

Keep the measured drawing, chosen city, saved dimensions, solar lighting and all
existing canvases/gestures. A catalogue model may fill only its permitted kind
and footprint. Rotation must use the same dimensions as the plan and renderer.
No file shrinks by more than 30%; no live drawing or content is removed.

MiniMax's report ends at `c4df0be`, already an ancestor of the verified `f86df6f`
release. Its build-first test command and measured catalogue remain. The later
production-CSP repair and complete 126-case gate remain authoritative.

## Reconciliation plan

- PR #2: verify its cloud configuration commit is already an ancestor of main,
  then close the redundant draft without deleting its branch.
- PR #3: reject the conflicting whole-file replacement, which removes newer
  local 3D, controls and references. Record absent elevation/cut ideas below;
  retain current calibrated sheets, city charts and captured scenes.
- PR #4: merge Node engines/lockfile metadata and `.nvmrc`; correct its stale
  README statement to CI's actual Node 22 selector. No dependency upgrades.
- PR #5: extract its canonical-domain correction and pencil-overshoot regression
  cases. Repair bounded short tail consumption in the existing resolver.
  Preserve unrelated/long/detached walls and current alignment/opening resize gestures.
  Keep the hint row stable during inking, and leave the inspector closed after
  a drawn room so the phone drawing and Undo remain reachable.
  Do not import the new global-grid resolver: a remote stroke prevents a closed
  rectangle from becoming a room. Nearest-wall placement also fails full-width
  hosting at corners. Retain the branch and record deferred scope explicitly.
- Fix furniture rotation using actual per-piece dimensions, with browser
  rotation/Undo assertions on catalogue and custom pieces at site boundaries.
- Select the best-fitting permitted mesh when no exact size matches, retaining
  explicit asset choices, semantic/footprint bands and deterministic variants.

## Verification plan

Run old/new targeted unit checks with a failing-before repair; inspect no new
package/dependency content. Run lint, type/build, complete frontend/Worker gates
and one browser suite at a time against newly built bytes with production CSP.
Use independent read-only reviews, then commit, push, deploy the primary with
its scripted command. Verify canonical before custom domain; compare delivered
files and policy with throwaway probe keys and three matching streaks. Exercise
changed paths on primary and mirror in isolated saved plans. Reconcile the PRs
only after the retained changes are tested and pushed.

## Deferred PR ideas (not shipped)

PR #3: add façade elevation and automatic cut suggestions through existing
study geometry, with recessed-façade visibility checks. Decorative palettes in
the old PR add building details absent from the plan and change cost based on
adjectives; these are not adopted.

PR #5: a broader pixel-based loop resolver needs disconnected and connected
extra-wall cases. Nearest-wall placement must clamp the entire opening width.
Toolbar/export rewrites, timezone inference and a Fiber clock patch are not
part of this bounded repair. Legacy plans retain their documented city. These
features are preserved on the original branch, not claimed as merged features.

## Confirmed repairs and review evidence

- A valid measured sofa rotated using the generic 2.2 m depth clamp, reaching
  105.3% of the site. The old-bundle browser assertion fails there; the corrected
  handler uses `furnitureSpecFor`. Both measured sofa and custom desk pass on
  desktop/phone with dimensions/asset ID preserved and exact one-step Undo.
- A 2.7 × .95 m sofa formerly chose velvet geometry covering only 2.040 × .950 m
  despite a permitted wood model fitting 2.700 × .910 m at .989× native scale.
  Permitted candidates now rank by fitted footprint area after the existing
  exact-match preference. Explicit choices and size bands remain unchanged.
  An independent 1,476-case probe confirmed the selection contract.
- Cursor PR #5's .5/.7 m overshoot cases failed against main with four leftover
  wall strokes. The bounded repair consumes only short tails on a wall spanning
  the completed edge; tests retain long, remote and detached saved walls.
  Independent review caught a first draft deleting a detached fragment, which
  is now covered and fixed. The PR's global-grid resolver is not copied.
- Real pointer cases then found the hint row disappearing during inking,
  changing canvas bounds and the resulting wall coordinates. Keeping the row
  mounted fixes this. Automatic inspector opening then blocked phone Undo;
  drawing now leaves it closed, with manual access retained. Both behaviors
  are exercised in every pencil browser case.
- Canonical, Open Graph and JSON-LD URLs now identify the primary domain.
  Metadata is checked in the browser; mirror-relative icons/manifest stay intact.

Focused gates: all 10 new desktop/phone browser cases pass (12.9 seconds),
480 frontend tests /61 files pass, Worker type check +54 tests /5 files pass,
and SQLite quotas admit exactly 5+7=12 globally. Production dependency and full
Worker audits report zero vulnerabilities. Seven existing development-only
advisories remain in Tailwind 3's transitive build tooling; the suggested major
Tailwind migration is not mixed into this surgical release. No dependency
version, model binary, provider endpoint, persisted schema or security policy
changed. The Axiom package was unavailable in the preceding audit (registry
404); no new automated Axiom pass is claimed here.

Review and preservation: PR #2 head `7a2a64d` is an ancestor of main and its
`.cursor/environment.json` is already present. PR #4 head `ec4a2a8` is merged
with its authorship intact; its README selector is corrected to Node 22.
PR #3 was independently compared with current calibrated sheets (17 focused
study tests pass). PR #5's retained fixes are independently rechecked. No
wholesale old snapshot replaces newer alignment, opening resize, scene capture,
comparison or model rendering. Original PR branches are retained for recovery.

Durable lessons were captured in SecondBrain before this result log: rotation
must clamp effective dimensions; inking must retain stable layout bounds.

## Release gate and PR disposition

Release commit: `05d25b01cb06f4f89c563f116d8a5d87a2404e8f`.
[CI 38772314712](https://github.com/Nonarkara/luma-house/actions/runs/38772314712)
passed **480 frontend tests, 54 Worker tests and all 136 browser checks
(5.2 minutes)**, plus lint, type/build, quota and production dependency gates.
Build and GitHub mirror deployment both succeeded.

| PR | Result | Reason |
| --- | --- | --- |
| [#2](https://github.com/Nonarkara/luma-house/pull/2) | Closed | Its exact head/configuration was already in main. |
| [#3](https://github.com/Nonarkara/luma-house/pull/3) | Closed | Superseded measured sheets; whole snapshot would remove newer scene controls/content. Remaining ideas recorded above. |
| [#4](https://github.com/Nonarkara/luma-house/pull/4) | Merged | Node metadata retained; stale README CI selector corrected. |
| [#5](https://github.com/Nonarkara/luma-house/pull/5) | Closed after bounded extraction | Useful cases, metadata and drawing-flow fixes retained; known broken resolver/corner hosting and broader rewrites not imported. |

Zero open PRs remain. Original source branches were not deleted. Cursor's
contribution is credited in the retained code commit. Merging the Node PR
preserved its original commit and added the required Codex merge trailer.

Primary upload: [119236b4](https://119236b4.luma-house.pages.dev).
The scripted deploy rebuilt the same application chunk names as the tested
isolated checkout. Canonical alias, custom domain and mirror each match all
20 checked file hashes for three consecutive probes. Canonical/custom CSP
matches the release policy exactly. Browser profiles used for live verification
block service workers and carry isolated fixture drawings.

The managed audit checkout disappeared after all source was committed/pushed;
root main still held the exact release commit. Deployment continued there.
A later archive request reported that the attachment belonged to another task;
no other task's checkout was removed. Screenshots and the pre-fix rotation
trace are retained outside managed worktrees. Pencil screenshots at
375/768/1280 px and a real one-room Solid furniture scene were visually reviewed.
An attempted manual phone drawing was not dispatched because the IAB CDP call
timed out; it is not counted as a successful walkthrough. Automated real-pointer
phone/desktop closure and Undo checks passed instead.

Primary live verification: **all 30 desktop/phone cases pass (4.7 minutes)**.
These cover the new metadata, measured/custom furniture rotation and Undo,
rough pencil closure with stable bounds and accessible Undo, actual mesh draw,
lazy loading, missing/unavailable/corrupt models, CSP, real late-arriving shadows
and idle cache reuse, stored/shared baselines, A/B geometry/camera/PNG, and
read-only comparison visibility across every palette.

During final live checks another task began modifying
`src/options/roomOptions.ts` and created `src/options/zz_probe.test.ts` in the
shared checkout. These changes are not in the tested/deployed `05d25b0` release;
they are preserved and excluded from this documentation commit. No claim is
made that the shared working directory is clean while that work is active.

Mirror live verification: **all 12 desktop/phone cases pass (37.8 seconds)**,
covering production metadata, measured/custom rotation and Undo, actual mesh
draw, and both rough pencil loops. The temporary test adapter prefixes entry
navigation with `/luma-house/` and preserves the existing assertions; the normal
root-path test configuration would otherwise visit a different GitHub page.
An initial adapter discovery failed because its temporary directory lacked
module metadata/dependency resolution; after supplying those locally, all 12
cases ran and passed. No application repair or policy change was needed.

The final report/context commit is documentation only and uses `[skip ci]`
after the complete passing gate. It changes no tested or published application
bytes. This release is shipped and verified at both public addresses. The
separate in-progress room-options source/probe changes remain untouched.
