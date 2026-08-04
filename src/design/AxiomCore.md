# Axiom Design Core

The design system that governs **designon** (Design + Non). Axiom is the umbrella
design language for the company; Luma House was the first product under it. The Core
is the minimum every product must honour; each product adds its own product-specific
tokens (e.g. a climate product gets a sun-patch accent; a finance product gets a
ledger accent).

## Principles

1. **Subtraction is beauty.** If a screen can lose a control, the control goes.
   The next motion is the one that earns its keep.
2. **Algorithm first, then graphics.** A real number, labelled honestly, beats
   a styled illustration. We never use graphic decoration to make a fake
   number look credible.
3. **Real data, no placeholders.** Empty states show a real empty state, not
   a marketing render. Loading states are honest. Failure states explain.
4. **Sharp edges only.** No rounded corners. No drop shadows. No gradients.
   No blur. No transparency tricks. The geometry of the page is the geometry
   of the content.
5. **One accent.** A single accent colour carries the meaning. The accent is
   reserved for: selection, primary action, the live value the user is
   looking at. Never decoration.
6. **One voice.** No "marketing" copy in the product. No exclamations. No
   exclamation marks. The product says what the product does.
7. **Type does the work.** Hierarchy is set in the type. No badges-instead-
   of-text, no colour-coding-instead-of-headings.
8. **Disclosure is a feature.** When the model is directional, the UI says
   so. When a number is order-of-magnitude, the UI says so. We trust the
   reader to want the truth.

## Token groups

### Surface

| Token            | Value     | Use                                |
| ---------------- | --------- | ---------------------------------- |
| `--axiom-ink`    | `#0e1014` | The ink. Text, primary surface.    |
| `--axiom-paper`  | `#faf7f1` | The page. Default background.       |
| `--axiom-mute`   | `#e6e1d6` | Mute fills, dividers.              |
| `--axiom-quiet`  | `#8a8478` | Quiet text, secondary metadata.    |

### Single accent

| Token               | Value     | Reserved for                      |
| ------------------- | --------- | --------------------------------- |
| `--axiom-accent`    | `#a3ff00` | Selection, primary action, live value |

(Accent is **the same citron** Luma used — it's the company's signature.
Each product picks a single accent and does not deviate.)

### Type

| Token              | Value                | Use                                |
| ------------------ | -------------------- | ---------------------------------- |
| `--type-display`   | `'IBM Plex Sans', sans-serif` | Stage headlines         |
| `--type-body`      | `'IBM Plex Sans Thai', sans-serif` | Body, controls  |
| `--type-mono`      | `'IBM Plex Mono', monospace`      | Numbers, code   |
| `--type-base`      | `15px`               | Default body size                  |
| `--type-leading`   | `1.5`                | Default body leading               |

### Spacing (4 px rhythm)

| Token           | Value | Use                                |
| --------------- | ----- | ---------------------------------- |
| `--space-1`     | `4px` | Tight                             |
| `--space-2`     | `8px` | Default                           |
| `--space-3`     | `12px`| Comfortable                       |
| `--space-4`     | `16px`| Card padding                      |
| `--space-6`     | `24px`| Section                           |
| `--space-8`     | `32px`| Stage                             |
| `--space-12`    | `48px`| Hero                              |

### Type scale

| Token           | Value | Use                                |
| --------------- | ----- | ---------------------------------- |
| `--fs-xs`       | `11px`| Eyebrows, meta                     |
| `--fs-sm`       | `12px`| Captions                           |
| `--fs-base`     | `15px`| Body                               |
| `--fs-md`       | `18px`| Lead                               |
| `--fs-lg`       | `24px`| Section title                      |
| `--fs-xl`       | `36px`| Stage title                        |
| `--fs-2xl`      | `56px`| Hero                               |

### Borders & shapes

- All corners are `0`. The product has no rounded corners anywhere.
- Hairline borders: `1px solid var(--axiom-mute)`. No drop shadows.
- Focus ring: `2px solid var(--axiom-accent)`. Outline offset 0 — sharp.

### Motion

- Default easing: `cubic-bezier(0.4, 0, 0.2, 1)`. No bounce, no spring.
- Default duration: `180ms` for state, `240ms` for entrance, `120ms` for exit.
- No motion on text. No parallax. No background animation.

## Component contract

A component is Axiom-compliant when it:

1. Has a single accent (or zero). Multiple colours = a violation.
2. Has at most one shadow. Zero shadows = the goal.
3. Has at most one border-radius. Zero = the goal.
4. Uses the 4 px spacing rhythm. Exceptions require a comment.
5. Renders the same on `prefers-reduced-motion`.
6. Renders the same on `prefers-color-scheme: dark` if the product supports dark.
7. Has keyboard support: focus ring visible, Tab order correct, Esc dismissable.
8. Has a real test for its critical behaviour.

## Audit checklist (CI-gateable)

- No `border-radius > 0` outside `--axiom-mute` or one specific exception.
- No `box-shadow` other than `none`.
- No `linear-gradient` or `radial-gradient` in component CSS.
- No `backdrop-filter: blur` other than a single value at `--blur-page: 12px`
  for the top-bar only.
- All colors are tokens. No `rgb(...)` or `#abc` literals in component CSS.

## Spacing assertion

```ts
// In design tests, this should be a passing assertion for every component.
expect(spacingScale).toEqual([4, 8, 12, 16, 24, 32, 48])
```

## Naming

- Files: `kebab-case.tsx`, `PascalCase.ts` (types), `camelCase.ts` (utilities).
- Components: `PascalCase`.
- CSS classes: `kebab-case`, scoped to the component (no global `.button`
  or `.card` outside the design system itself).
- Tokens: `--axiom-{category}-{name}` for shared, `--{product}-{name}` for
  product-specific.
- Storage keys: `designon:{domain}:{key}` — one colon between product and
  domain, not `luma-house:...`.

## The single rule

**If a screen looks like it could be from any other product, it is not yet
Axiom-compliant.** Axiom is not a visual style — it is a posture toward the
user: nothing on the page exists for any reason other than to help the user
make a real decision. If the page is decoration, remove the page.
