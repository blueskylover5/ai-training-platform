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
| Hosting | Vercel (free plan) with Neon Postgres; see [Deploying to Vercel](#deploying-to-vercel) |
| Tests | Vitest, with recorded fixtures |
| CI | GitHub Actions: lint, type check, tests, build |

## Getting started

Requires Node.js 26 (see [.nvmrc](.nvmrc)).

```bash
npm ci
npm run db:migrate       # create the local database in .data/pglite
npm run dev              # http://localhost:3000; collects the figures by itself (see below)
```

The home page shows the trends overview from the newest published figures. `/platforms` shows the Platforms guide: the platform race, projects by sector and pay. `/contact` is the Contact us page with the contact form (`CON-01`). The figures update themselves: the app server collects them at 00:30, 06:30, 12:30 and 18:30 UTC, and about 30 seconds after it starts if it missed one (`TRD-01`, [ADR 0006](docs/adr/0006-collect-every-6-hours.md)). A run takes 2 to 3 minutes, most of it spent on gently paced per-platform searches (`TRD-11`). A later run on the same day replaces that day's figures with the newer file, so the history keeps one point per day. To collect with a cron job instead, set `TRENDS_SCHEDULE=off` and run `npm run trends:collect`, or call `/api/trends/collect` (see [Deploying to Vercel](#deploying-to-vercel)). With several servers, keep the schedule on in one.

In production, set `CONTACT_HASH_SECRET` to a random value of at least 32 characters; the server will not start without it (`CON-04`, see `.env.example`).

The local database (PGlite) can only be open in one program at a time, so stop `npm run dev` before running `db:migrate`, `trends:collect` or `contact:list`. While `npm run dev` runs, it does the collecting itself. Production uses PostgreSQL (`DATABASE_URL`), which has no such limit.

## Deploying to Vercel

The site runs on Vercel's free plan with a Neon Postgres database ([ADR 0007](docs/adr/0007-host-on-vercel.md)). `vercel.json` already holds the rest:

- **Build:** each build runs `npm run db:migrate` first. Only production builds migrate.
- **Schedule:** `collect-trends` calls `/api/trends/collect` at 00:30, 06:30, 12:30 and 18:30 UTC. On the free plan, a run may start up to 15 minutes late.

One-time set-up:

1. On [vercel.com](https://vercel.com), sign in with GitHub, choose **Add New → Project** and import this repository.
2. Under **Environment Variables**, add these for Production and Preview. Generate each value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `CONTACT_HASH_SECRET`: at least 32 characters (`CON-04`).
   - `CRON_SECRET`: at least 16 characters.
   - `RESEND_API_KEY`: from [resend.com](https://resend.com) → **API Keys**. Open the Resend account with the address that should receive contact messages.
   - `CONTACT_NOTIFY_TO`: that address. Each contact message is emailed there (`CON-03`).
   - `ADMIN_PASSWORD`: at least 12 characters. It opens the visitor log at `/admin/visits`, with the user name `admin` (`VIS-03`).
3. Deploy. The first build stops with "DATABASE_URL is not set"; that is expected.
4. In the project, open **Storage → Create Database → Neon**, choose the free plan and connect it to the project. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
5. Open **Deployments**, then **Redeploy** the latest one. Its build creates the tables.

The pages say "The first update has not run yet" until the schedule's first run. To collect straight away, run `collect-trends` by hand from the project's **Schedules** page, or call the address yourself:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-site>.vercel.app/api/trends/collect
```

On Vercel:

- **Deployments:** every push to `main` deploys the site. Other branches get preview deployments, which don't migrate the database and don't collect.
- **Collection:** the schedule inside the app server stays off; `TRENDS_SCHEDULE=on` turns it back on.
- **Raw copies** of downloaded files go into the `trend_raw_files` table instead of a folder.
- **Visitor log:** Vercel adds each visitor's approximate location (country, region, city); in local development it shows as "Unknown".

## Visitor log

Every page view is recorded with its time, page, IP address, approximate location and browser, and kept without a time limit; the footer says so (`VIS-01` to `VIS-04`, [ADR 0008](docs/adr/0008-visitor-log.md)). Open `/admin/visits` to see it. The browser asks for the user name `admin` (or `ADMIN_USER`) and `ADMIN_PASSWORD`. While no password of at least 12 characters is set, the admin pages answer "not found". **Download all as CSV** on that page gives every visit as a spreadsheet.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then run the TypeScript compiler |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:migrate` | Apply database migrations (on Vercel, before each production build) |
| `npm run trends:collect` | One collection run by hand or from cron: download, check and store the latest trend figures, then count each platform's new and big-pay roles (`TRD-01`, `TRD-02`, `TRD-11`) |
| `npm run contact:list` | Print the newest contact-form messages (`CON-03`), which are also emailed when `RESEND_API_KEY` and `CONTACT_NOTIFY_TO` are set; with the local database, stop `npm run dev` first |

Before opening a pull request, run `npm run lint && npm run typecheck && npm test && npm run build`.

## Working on this repository

- Read [AGENTS.md](AGENTS.md) first; it applies to people and AI coding agents alike.
- Cite requirement IDs from the design (for example `TRD-04`) in commits, tests and pull requests.
- Work on a branch and open a pull request; `main` stays deployable.

## Data credit

Market data: [AITraining.jobs open data](https://aitraining.jobs/data), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Every page, chart and export that shows this data credits AITraining.jobs and states the data date (`TRD-04`).
