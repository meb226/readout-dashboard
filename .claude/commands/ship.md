---
description: Commit, push, open a PR, merge to main, close the Linear issue, and update CLAUDE.md
---

Ship the current work to `main` and close out its tracking issue. Follow the
project's Task Completion Checklist. Work through the steps in order; if a step
genuinely doesn't apply (e.g. there is no associated Linear issue), say so and
skip it rather than inventing work.

## Environment awareness

You may be running on a local desktop or in the cloud execution environment.
Use whichever GitHub interface is available — do not assume:

- If the `gh` CLI is available and authenticated, you may use it for PR
  creation and merge.
- If GitHub MCP tools (`mcp__github__*`) are available (the cloud
  environment), use those instead — `gh` is not installed there.
- For Linear, use the Linear MCP tools (`save_issue`, `get_issue`). Per the
  project conventions, use `save_issue` (never `create_issue`), and set state
  with `state: "Done"`.

## Steps

1. **Sanity check.** Run `pwd`, `git branch --show-current`, and
   `git status --short`. Confirm you are in the intended repo and not on a
   detached HEAD. Never ship directly from `main` — if the working changes are
   on `main`, branch first.

2. **Identify the issue.** Determine the Linear issue ID for this work (from
   the branch name, recent commits, or by asking me if it's ambiguous). If
   there is no associated issue, note that and continue.

3. **Commit.** Stage and commit any uncommitted changes with a clear,
   descriptive message. Lead the subject with the issue ID when there is one
   (e.g. `ML-500: ...`). If everything is already committed, skip.

4. **Push.** Push the branch with `git push -u origin <branch>`. On network
   failure, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s).

5. **Open a PR** against `main` with a body that summarizes the change,
   references the issue, and notes how it was verified. Do NOT open a duplicate
   if an open PR for this branch already exists — reuse it.

6. **Merge** the PR to `main` (squash merge preferred). Report the merge commit.

7. **Close the Linear issue** — set its state to `Done` via the Linear MCP
   tools. Skip if there is no associated issue.

8. **Update CLAUDE.md** only if the work introduced new patterns, env vars,
   structural changes, or notable decisions worth recording. A small bug fix
   usually needs no CLAUDE.md change — use judgement, don't pad it.

When done, report a concise summary: branch, PR number/URL, merge commit, and
the issue's new state.
