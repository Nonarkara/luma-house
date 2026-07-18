# Luma House — live context

## Concept photo API

- Worker project: `workers/concept-render`
- Live Worker URL: `https://luma-concept-render.drnon.workers.dev`
- Frontend default: same URL (overridable via `VITE_CONCEPT_API_URL`)
- Deploy: `cd workers/concept-render && npm i --legacy-peer-deps && wrangler secret put GEMINI_API_KEY && npx wrangler deploy`
- Browser daily quota: 3 renders / day / localStorage key `luma-house:concept-quota`
- Server IP daily cap: `DAILY_IP_LIMIT` (default 20) when KV `RATE_LIMIT` is bound
- Latest Worker version (2026-07-15): `190d924e-e8c5-4e9e-b8df-cd61bde029fe`

## Deploy targets

- **Frontend (primary):** https://luma-house.pages.dev (Cloudflare Pages, project `luma-house`)
- Latest deployment: https://520d7424.luma-house.pages.dev (commit `3837693` — draw→model→sun→advice→cost journey)
- Mirror: https://nonarkara.github.io/luma-house/ (GitHub Pages workflow)
- Repo: https://github.com/Nonarkara/luma-house
- Concept renders: Cloudflare Worker above

## Deploy commands

```bash
npm run build
npx wrangler pages deploy dist --project-name=luma-house --commit-dirty=true
```

## Required secret (one-time)

```bash
cd workers/concept-render
printf '%s' "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY
```

Source of key in workspace inventory: `GEMINI_API_KEY` (see `_toolkit/superpowers/apis.md`).
