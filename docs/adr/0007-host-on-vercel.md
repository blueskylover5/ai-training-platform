# ADR 0007: Host on Vercel, with Neon Postgres and a Vercel Schedule

- **Status:** Accepted
- **Date:** 2026-11-19
- **Design reference:** system design v3.2, §4 and §13 (`TRD-01`, `CON-04`); amends ADR 0006

## Context

The owner decided on 19 November 2026 to host the site on Vercel's free plan (Hobby).

Vercel runs the app as functions. Nothing runs between requests, and files that a function writes don't last. Three parts of the app assumed a long-running server with a lasting disk:

- **The 6-hour schedule.** It ran inside the app server (ADR 0006).
- **The database.** Local development uses PGlite, which keeps its files on disk.
- **Raw copies of downloaded files (`TRD-01`).** They were written to a folder.

Vercel offers two ways to call an address on a timer:

- **Cron Jobs (older).** On the free plan, they run at most once a day.
- **Schedules (beta).** On the free plan, they can run every 15 minutes, start up to 15 minutes late, and allow 5,000 runs per billing period. Every 6 hours is about 120 runs a month.

## Decision

- **Database:** Postgres from Neon, added to the Vercel project from the Vercel Marketplace (Neon's free plan).
  - The app uses `DATABASE_URL` (pooled). Migrations use `DATABASE_URL_UNPOOLED` when it is set.
  - The app refuses to start on Vercel if `DATABASE_URL` still points to PGlite.
- **Migrations:** the build command in `vercel.json` runs `npm run db:migrate` before `npm run build`.
  - Only production builds migrate. Preview builds of unmerged branches share the production database, so their migrations must not reach it before review. `MIGRATE_PREVIEWS=1` turns this on for previews that have their own database.
  - A production build without `DATABASE_URL` stops with an error, instead of publishing pages that cannot reach their data.
- **Collection:** `/api/trends/collect` runs one collection (POST or GET).
  - It needs the header `Authorization: Bearer <CRON_SECRET>`. Without a secret of at least 16 characters, the address is switched off.
  - The schedule `collect-trends` in `vercel.json` calls it at `30 */6 * * *`: 00:30, 06:30, 12:30 and 18:30 UTC. On the free plan, each run may start up to 15 minutes later. A test keeps `vercel.json` in step with `trendsConfig.schedule`.
  - The address may run for 300 seconds, the most the free plan allows. A run takes 2 to 3 minutes.
  - It answers 500 when a file was rejected, so the schedule's history shows the failed run.
- **The in-app schedule** (ADR 0006) is off on Vercel by default (Vercel sets `VERCEL`). `TRENDS_SCHEDULE=on` or `off` still overrides it.
- **Raw copies** are kept in the database table `trend_raw_files` on Vercel (`RAW_STORAGE=database`, the default there). That adds about 150 KB a day. Servers with a lasting disk keep using a folder (`RAW_STORAGE_DIR`).
- **Contact form (`CON-04`):** on Vercel, the sender's address comes from `x-forwarded-for` with one trusted hop, which are the defaults. `CONTACT_HASH_SECRET` is needed in every Vercel environment, previews included, because preview deployments also run in production mode.

## Consequences

- **Cost:** hosting is free on the Vercel and Neon free plans. Vercel's free plan is for non-commercial use. Move to Pro once the site earns money (§3).
- **Schedules are in beta,** so their behaviour and limits may change. If they stop working, any timer service (for example cron-job.org) can call the same address with the same header.
- **No retries:** a failed run waits for the next one, 6 hours later. The out-of-date notice appears after 8 hours (`TRD-09`).
- **Repeated or late calls are harmless.** A collection skips files it already has and replaces a date's rows under a lock (ADR 0006).
- **The 300-second limit:** a run must finish within it. Most of the time goes on about 190 paced platform searches. If the number of platforms grows a lot, the searches would need Vercel Pro (800 seconds) or splitting into several calls.
- **Previews:**
  - Schedules on preview deployments are inactive by default, so previews don't collect.
  - Previews skip migrations, so a preview whose branch adds a table shows errors until that branch is merged.
- **Local development is unchanged:** PGlite, the in-app schedule and raw copies in `.data/raw`.
