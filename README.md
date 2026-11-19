# AI Training Opportunity & Expert Support Platform

A free service with two parts:

- **Trends:** charts and figures showing the AI training job market (open roles, growth and advertised pay by kind of work), built from AITraining.jobs open data. They help experts see where their skills are in demand.
- **Experts:** a directory of our own team members who have done AI training work. Members send a contact request, and the conversation continues by chat or meeting.

The product baseline is [docs/system-design-v3.md](docs/system-design-v3.md). Architecture decisions are in [docs/adr](docs/adr).

**Status:** Phase 1 (Trends) is in development. Collection every 6 hours, the trends overview page, the Platforms guide (platform race, sectors and pay) and the Contact us page work; separate chart pages and share images are next.

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
npm run db:migrate       # create the local database in .data/pglite
npm run dev              # http://localhost:3000; collects the figures by itself (see below)
```

The home page shows the trends overview from the newest published figures. `/platforms` shows the Platforms guide: the platform race, projects by sector and pay. `/contact` is the Contact us page with the contact form (`CON-01`). The figures update themselves: the app server collects them at 00:30, 06:30, 12:30 and 18:30 UTC, and about 30 seconds after it starts if it missed one (`TRD-01`, [ADR 0006](docs/adr/0006-collect-every-6-hours.md)). A run takes 2 to 3 minutes, most of it spent on gently paced per-platform searches (`TRD-11`). A later run on the same day replaces that day's figures with the newer file, so the history keeps one point per day. To collect with a cron job instead, set `TRENDS_SCHEDULE=off` and run `npm run trends:collect`. On serverless hosting, where nothing runs between requests, that is the only way. With several servers, keep the schedule on in one.

In production, set `CONTACT_HASH_SECRET` to a random value of at least 32 characters; the server will not start without it (`CON-04`, see `.env.example`).

The local database (PGlite) can only be open in one program at a time, so stop `npm run dev` before running `db:migrate`, `trends:collect` or `contact:list`. While `npm run dev` runs, it does the collecting itself. Production uses PostgreSQL (`DATABASE_URL`), which has no such limit.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then run the TypeScript compiler |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:migrate` | Apply database migrations |
| `npm run trends:collect` | One collection run by hand or from cron: download, check and store the latest trend figures, then count each platform's new and big-pay roles (`TRD-01`, `TRD-02`, `TRD-11`) |
| `npm run contact:list` | Print the newest contact-form messages (`CON-03`); with the local database, stop `npm run dev` first |

Before opening a pull request, run `npm run lint && npm run typecheck && npm test && npm run build`.

## Working on this repository

- Read [AGENTS.md](AGENTS.md) first; it applies to people and AI coding agents alike.
- Cite requirement IDs from the design (for example `TRD-04`) in commits, tests and pull requests.
- Work on a branch and open a pull request; `main` stays deployable.

## Data credit

Market data: [AITraining.jobs open data](https://aitraining.jobs/data), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Every page, chart and export that shows this data credits AITraining.jobs and states the data date (`TRD-04`).
