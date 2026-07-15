# Luma House — live context

## Concept photo API

- Worker project: `workers/concept-render`
- Deploy: `cd workers/concept-render && npm i && wrangler secret put GEMINI_API_KEY && npm run deploy`
- Client env: `VITE_CONCEPT_API_URL` = Worker URL (no trailing path needed; POST root)
- Browser daily quota: 3 renders / day / localStorage key `luma-house:concept-quota`
- Server IP daily cap: `DAILY_IP_LIMIT` (default 20) when KV `RATE_LIMIT` is bound

## Deploy targets

- Frontend: GitHub Pages via `.github/workflows/deploy.yml`
- Optional static: Render (`render.yaml`)
- Concept renders: Cloudflare Worker (required for image gen on share links)

## After first Worker deploy

1. Copy the Worker URL into repo `.env` / GitHub Actions secret `VITE_CONCEPT_API_URL` if builds inject it, or bake into Cloudflare Pages/Render env.
2. For GitHub Pages static hosts without build-time env injection, set a default in `src/concept/generateConcept.ts` only if the Worker URL is permanent — prefer `VITE_CONCEPT_API_URL` at build time.
