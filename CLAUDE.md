# Luma House

## Build and run

- `npm install` — install dependencies
- `npm run dev` — start the Vite development server
- `npm test` — verify plan, solar, energy, and budget calculations
- `npm run lint` — run ESLint
- `npm run build` — typecheck and create the production bundle
- `npm run preview` — serve the production bundle locally

## Architecture

- Framework: Vite + React + strict TypeScript
- Styling: Tailwind foundation and CSS tokens in `src/styles.css`
- Persistence: localStorage prototype; SQLite schema in `data/schema.sql`
- Deployment: GitHub Pages or Render static hosting
- Analytics: local-first pageview queue, ready for Supabase/D1 sync

## Key files

- `src/App.tsx` — design workspace and interactions
- `src/plan.ts` — domain data, solar math, energy, and BOQ calculations
- `src/styles.css` — responsive Rams-inspired design system
- `src/plan.test.ts` — calculation checks

## Conventions

- Keep TypeScript strict.
- Keep AI suggestions human-confirmed and label concept outputs honestly.
- Preserve the 4 px spacing rhythm and single citron accent.
- Keep domain calculations outside UI components and cover changes with tests.
