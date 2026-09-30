# designon (Design + Non) — live context

The product is named **designon** (Design + Non). It is the first product under
the Axiom Design Core. The repo URL is kept as `luma-house` for GitHub Pages
inertia; the product name in the UI, in storage, and in user-facing copy is
designon.

## Concept photo API

- Worker project: `workers/concept-render`
- Live Worker URL: `https://luma-concept-render.drnon.workers.dev`
- Frontend default: same URL (overridable via `VITE_CONCEPT_API_URL`)
- Deploy: `cd workers/concept-render && npx wrangler deploy`
  (the secret below is already set; you do not need to re-put it to deploy code)
- Latest Worker version (2026-09-30): `18c6f2b9-87a7-4bc6-9bd1-19f1c7ba00fe`

### Who may call it

The Worker holds a paid key, so it is not open. A browser call carrying an
`Origin` that is not one of these is refused with 403 before anything is spent:

- `https://nonarkara.github.io` (GitHub Pages — the live site)
- `https://luma-house.pages.dev` (Cloudflare Pages)
- `http://localhost:5173`, `http://localhost:4173` (development)

Non-browser clients (no `Origin`) are still served, and are held down by the
per-IP cap. To add a host, edit `ALLOWED_ORIGINS` in `workers/concept-render/src/index.ts`.

### Quota

- Browser daily quota: 3 renders/day, localStorage key `designon:concept-quota`
  (legacy `luma-house:concept-quota` is read once and migrated). This is a
  courtesy limit only — it is client-side and trivially bypassed.
- Server per-IP daily cap: `DAILY_IP_LIMIT` (20), counted in KV `RATE_LIMIT`
  (namespace id in `wrangler.toml`). This is the real one. It **fails closed**:
  if KV is unreachable the request is refused rather than allowed to spend.
- Inspect the count: `npx wrangler kv key list --binding RATE_LIMIT --remote`

### The key is borrowed, and that is a risk

`GEMINI_API_KEY` is the key from `bots/city-reporter-v2/.env` — it is the only
valid Gemini key in the workspace, and designon does not own one. It is on the
free tier with a 20-request cap, so:

- heavy use of city-reporter-v2 takes the napkin feature offline, and the user
  sees "The AI service is out of capacity right now";
- testing designon exhausts a quota that another project also depends on.

**Fix this with a dedicated key** (a Google Cloud API key with the Generative
Language API enabled), then:

```bash
cd workers/concept-render
printf '%s' "$NEW_KEY" | npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

A dedicated key alone still leaves the image endpoint reachable by anyone who
obtains it indirectly; if the key ever moves to a paid tier, add a shared secret
that the frontend must present. See the CORS note above — that stops drive-by
abuse from other websites, not a determined direct caller.

## Deploy targets

- Frontend: https://nonarkara.github.io/luma-house/ — GitHub Actions deploys on
  every push to `main`, so a green local build is not a deployment. Check the
  live URL, and remember a minified bundle strips comments, so a string probe
  cannot prove a change shipped. Verify behaviour in the browser instead.
- Repo: https://github.com/Nonarkara/luma-house
- Optional static: Render (`render.yaml`)
- AI (trace + concept render): Cloudflare Worker above, deployed separately and
  **not** automatic. Frontend and Worker can be minutes apart.

## Deploy commands

```bash
# frontend (or just push to main and let Actions do it)
npm run build
npx wrangler pages deploy dist --project-name=luma-house --commit-dirty=true

# worker
cd workers/concept-render && npx tsc --noEmit && npx vitest run && npx wrangler deploy
```
