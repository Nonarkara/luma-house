# Luma House

Luma House is a local-first home design prototype that turns a rough plan into an interactive conversation about space, daylight, intelligent systems, and cost. Users can move rooms, place windows and doors, trace an uploaded sketch, test the sun by place and time, compare plan directions, select energy systems, and export a live concept BOQ.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite. Production checks:

```bash
npm test
npm run lint
npm run build
npm run preview
```

## What is real in this prototype

- Draggable percentage-based plan geometry with undo/redo
- Doors and windows placed directly on the drawing
- Solar altitude and azimuth from latitude, day, and hour
- Live area, systems, energy, and construction-cost calculations
- Uploaded-sketch tracing layer
- Local browser persistence and JSON export
- Responsive plan and conceptual spatial views

The “trace” action is intentionally presented as a verification-first concept workflow, not a construction-grade computer-vision claim. Structural, code, cost, and procurement decisions must be checked by local professionals.

## Architecture

- Vite + React + strict TypeScript
- Tailwind foundation plus project-specific CSS design tokens
- Vitest for domain calculations
- Browser `localStorage` for the zero-setup prototype
- SQLite-compatible schema in `data/schema.sql` for production persistence
- GitHub Pages and Render static deployment configurations

For production, wire `house_projects` and `pageviews` to Supabase or D1 and sync aggregated analytics to Google Sheets using the placeholders in `.env.example`.
