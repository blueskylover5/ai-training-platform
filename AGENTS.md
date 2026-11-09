<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

These apply to everyone working in this repository, human or AI.

- **Baseline:** [docs/system-design-v3.md](docs/system-design-v3.md). Cite requirement IDs (`TRD-`, `EXP-`, `JOB-`, `SEC-`, `AT-`) in commits, tests and pull request descriptions. Ask before building anything irreversible that an open decision (design §13) affects.
- **Next.js:** read the guides in `node_modules/next/dist/docs/` before writing Next.js code (see the block above).
- **Tests:** use the recorded fixtures in `tests/fixtures/`. Tests never call live endpoints.
- **Configuration:** limits, schedules and thresholds come from `src/config.ts`, never from constants inline in the code.
- **Data credit:** anything that shows market data shows the AITraining.jobs credit line with the data date (`TRD-04`). Publish summary figures only, never a role-by-role history (`TRD-05`).
- **Never:** scrape logged-in pages, store third-party credentials, or submit applications automatically.
- **Commits:** no AI co-author lines or "generated with" attribution in commits or pull requests.
- **Before a pull request:** `npm run lint && npm run typecheck && npm test && npm run build` must pass.
