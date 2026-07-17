# Luma House

Luma House is a local-first home design prototype that turns a rough plan into an interactive conversation about space, daylight, intelligent systems, and cost. Users can move rooms, place windows and doors, trace an uploaded sketch, test the sun by place and time, compare plan directions, select energy systems, and export a live concept BOQ.

The default project, **Lantern Courtyard 100**, is a complete 100.0 m² demonstration package: eight measured rooms, coordinated furniture and openings, daylight and climate analysis, six lighting-control channels with four scenes, solar/battery/climate automation, nine priced BOQ packages, a section axonometric, and three deterministic architectural render views.

## Deploy (Cloudflare Pages)

```bash
npm run deploy:pages
```

Live: **https://luma-house.pages.dev**

GitHub: **https://github.com/Nonarkara/luma-house**

```bash
npm test
npm run lint
npm run build
npm run preview
```

## What is real in this prototype

- Pan / zoom canvas with wheel, pinch, and working zoom controls
- Drag rooms in any direction; corner + edge resize; pinch-to-scale a room
- Draggable doors and windows that snap onto the nearest room wall
- Keyboard operation: Delete removes selection, Ctrl/Cmd+Z history, Esc deselects, arrows nudge
- Room-overlap detection with an explicit double-counted-area warning
- Undo/redo, local browser persistence, JSON export **and import**
- Share links that embed the full plan in the URL hash (`#plan=…`)
- Solar altitude and azimuth from latitude, day, and hour
- Live area, systems, energy, construction-cost, and embodied-carbon calculations
- Per-room annual overheating-hours estimate (directional monthly sampling)
- Sketch underlay (honest tracing layer — not auto-traced walls)
- Limited Gemini concept photos via Cloudflare Worker (`workers/concept-render`)

Concept photos are labeled as design visualizations, not photographs of finished buildings. Structural, code, cost, and procurement decisions must be checked by local professionals.

## Concept photo setup

```bash
cd workers/concept-render
npm install
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Put the Worker URL in `.env` as `VITE_CONCEPT_API_URL`, then rebuild the frontend. Browser quota is 3 renders/day.

## Architecture

- Vite + React + strict TypeScript
- Tailwind foundation plus project-specific CSS design tokens
- Vitest for domain calculations
- Browser `localStorage` for the zero-setup prototype
- SQLite-compatible schema in `data/schema.sql` for production persistence
- GitHub Pages and Render static deployment configurations

For production, wire `house_projects` and `pageviews` to Supabase or D1 and sync aggregated analytics to Google Sheets using the placeholders in `.env.example`.
