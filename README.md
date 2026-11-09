# AI Training Opportunity & Expert Support Platform

A free service with two parts:

- **Trends:** charts and figures showing the AI training job market (open roles, growth and advertised pay by kind of work), built from AITraining.jobs open data. They help experts see where their skills are in demand.
- **Experts:** a directory of our own team members who have done AI training work. Members send a contact request, and the conversation continues by chat or meeting.

The product baseline is [docs/system-design-v3.md](docs/system-design-v3.md). Architecture decisions are in [docs/adr](docs/adr).

**Status:** Phase 1 (Trends) is in development.

## Stack

| Area | Choice |
|---|---|
| App | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL via Drizzle ORM; PGlite for local development and tests |
| Tests | Vitest, with recorded fixtures |
| CI | GitHub Actions: lint, type check, tests, build |

## Getting started

Requires Node.js 26 (see [.nvmrc](.nvmrc)).

```bash
npm ci
npm run dev        # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then run the TypeScript compiler |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

Before opening a pull request, run `npm run lint && npm run typecheck && npm test && npm run build`.

## Working on this repository

- Read [AGENTS.md](AGENTS.md) first; it applies to people and AI coding agents alike.
- Cite requirement IDs from the design (for example `TRD-04`) in commits, tests and pull requests.
- Work on a branch and open a pull request; `main` stays deployable.

## Data credit

Market data: [AITraining.jobs open data](https://aitraining.jobs/data), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Every page, chart and export that shows this data credits AITraining.jobs and states the data date (`TRD-04`).
