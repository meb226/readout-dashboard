# Readout Dashboard

Frontend for the Readout congressional hearing intelligence tool. React SPA that displays hearing memos, audio briefs, and pipeline status.

## Stack

- **Framework:** React 19 + Vite + TypeScript
- **Styling:** TailwindCSS
- **Data:** React Query for API calls
- **Exports:** docx (Word docs), file-saver
- **Markdown:** react-markdown for memo rendering
- **Module type:** ES modules

## Development

```bash
npm install
npm run dev      # Vite dev server
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint
```

## TanStack Query gotchas (v5)

**Never gate route guards or redirects on `isLoading`.** In React Query v5, `isLoading` means *actively fetching* (`isPending && fetchStatus === 'fetching'`). It is **false on the very first render**, because the query fires inside a `useEffect` that runs *after* render. The component sees `isLoading: false` + `data: undefined` and concludes "no answer, not loading either" — which is wrong. The right signal for "do I have an answer yet" is `isPending` (status === 'pending'), or check `data === undefined`.

This bit us in [ML-534](https://linear.app/meridian-logic/issue/ML-534): `RequireAuth` gated on `isLoading`, saw it false on first render after `/auth/callback`, navigated to `/login`, kicked off another WorkOS round-trip, repeat. Cookie was valid the whole time. Six hours of layered debugging missed it because every backend log said "auth works."

The fix in `src/auth/AuthProvider.tsx`:

```ts
// wrong — isLoading is false on first render
const { data, isLoading } = useQuery({ ... });

// right — isPending is true until the fetch resolves
const { data, isPending } = useQuery({ ... });
```

Expose `isPending` from your context as the "still resolving" signal, even if you call it `isLoading` in your interface (the rename is a v4→v5 footgun for anyone reading the docs).

## Auth flow + cookie scope

The dashboard never talks cross-origin to the API. All paths are same-origin via Vercel rewrites in `vercel.json`:

- `/api/*` → Railway backend (FastAPI)
- `/auth/*` → Railway backend (`/auth/login`, `/auth/callback`, `/auth/logout`)
- everything else → SPA `index.html`

`API_BASE` in the SPA is hardcoded to `""` (relative paths). Do **not** read `VITE_API_URL` — a stale env var pointing at the Railway hostname will bake a cross-origin URL into the production bundle, the `.meridianlogic.ai` cookie won't match, and `credentials: 'include'` requests will silently drop the cookie. ML-534 burned hours on this.

For local dev, `vite.config.ts` has a proxy block forwarding `/api` and `/auth` to `localhost:8000`. Run the FastAPI backend on `:8000` separately (`python3 -m src.main --api`).

## Related Repos

- **Readout Backend:** `~/Desktop/Readout` — Python FastAPI backend that this dashboard consumes
- **Dossier:** `~/Desktop/Dossier`
- **PitchSource:** `~/Desktop/Platform`
- **MeridianLogic site:** `~/Desktop/meridianlogic`

## Git Workflow

- **Always verify before editing:** Run `pwd`, `git branch --show-current`, and `git worktree list` before making any changes. Confirm you're in the right repo and on the right branch.
- **Never checkout main from within a worktree.** If you need main, exit the worktree first.
- **Worktrees live in `.claude/worktrees/`.** Each has its own branch. Don't confuse worktree paths with the main repo path.

## Task Completion Checklist

After finishing work on a task, follow this sequence:
1. Stage and commit with a descriptive message (include Linear issue ID if applicable)
2. Push the branch
3. Create PR and merge to main (if on a feature branch)
4. Close the Linear issue via MCP tools
5. Update this CLAUDE.md if the work introduced new patterns, env vars, or structural changes

Or just run `/ship` — it does all of this automatically.

## Multi-Repo Awareness

This dashboard talks to the Readout backend. Before editing any file, confirm you're in the right repo:
- **Readout Dashboard:** `~/Desktop/readout-dashboard` — this repo
- **Readout Backend:** `~/Desktop/Readout` — the API this consumes

If the user mentions backend code, read it for reference but don't edit it unless explicitly asked.

## UI/CSS Guidelines

- **Never guess at CSS fixes.** Before changing any styles, read the component and list ALL places where the element's styles are set (Tailwind classes, inline styles, parent containers).
- **State your diagnosis before writing code.** Tell the user what you think the root cause is and why.
- **Make ONE targeted fix at a time.** Don't change multiple CSS properties hoping one works.
- **If "still broken," your diagnosis was wrong.** Step back and look for a fundamentally different cause.
- Or just run `/css-fix` — it enforces this workflow automatically.

## Debugging Principles

- **If the user says "still broken," do not repeat the same approach.** Re-examine the actual state and consider a fundamentally different cause.
- **Read before guessing.** Always inspect the actual code/output/error before proposing a fix.
- **One change at a time.** Make a single targeted change, verify it worked, then move on. Don't batch multiple speculative fixes.
- **Don't force past obstacles.** If an approach isn't working after 2 attempts, step back and consider an alternative strategy.
