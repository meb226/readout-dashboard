# Readout Dashboard

Congressional hearing readout dashboard with gradient mesh UI, flip cards, and memo split view.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite
- **Data fetching:** TanStack React Query
- **Deployment:** Vercel (SPA routing via vercel.json)
- **Linting:** ESLint

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Type-check (`tsc -b`) then build with Vite
- `npm run lint` — Run ESLint
- `npm run preview` — Preview production build

## Project Structure

```
src/
  App.tsx              — Root app component
  main.tsx             — Entry point
  index.css            — Global styles
  api/client.ts        — API client
  components/          — All UI components
    Dashboard.tsx      — Main dashboard layout
    HearingCardGrid.tsx — Card grid with time-based groups
    CommitteeView.tsx  — Committee filtering
    HearingDetail.tsx  — Individual hearing view
    MemoViewer.tsx     — Memo split view
    GradientMesh.tsx   — Background gradient effect
    Header.tsx / Sidebar.tsx — Layout chrome
  hooks/               — Data hooks (useHearings, useCommittees, etc.)
  types/api.ts         — TypeScript API types
```

## Architecture Notes

- Hearings are organized into time-based groups: This Week, Upcoming, Recent, Older (ML-314)
- Hearing cards use a flip interaction to show details on the back (ML-315/316)
- Committee dropdown filters hearings by committee
- SPA routing handled by Vercel rewrites to index.html

## Completed Work

- **ML-65:** Initial dashboard — gradient mesh UI with flip cards, memo split view
- **ML-313:** TypeScript build fixes for Vercel deployment, added vercel.json
- **ML-315/ML-316:** Card readability, flip interaction, and blank card back fixes
- **ML-314:** Replaced "In Pipeline" section with time-based hearing groups (This Week, Upcoming, Recent, Older)
