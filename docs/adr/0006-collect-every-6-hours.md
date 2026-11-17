# ADR 0006: Collect trends every 6 hours, scheduled by the app server

- **Status:** Accepted
- **Date:** 2026-11-18
- **Design reference:** system design v3.2, §5 (`TRD-01`, `TRD-09`, `TRD-11`); amends ADR 0003 and ADR 0004

## Context

The product owner asked for the figures to be updated to the latest every 6 hours. Two things stood in the way:

- **Nothing ran the collection.** `npm run trends:collect` had to be started by hand, and the design's "scheduled worker" (§4) was never set up. On 18 November the newest figures were five days old.
- **Only one file per day was kept.** Each date kept the first file collected for it, and later runs that day changed nothing. AITraining.jobs rebuilds `roles.json` and `pay.json` about 7 minutes past every hour (their `updated` field), and the date in them (`temporal_coverage`) stays the same all day. So a second run that day would never have shown newer figures.

Hosting is not chosen yet. The local database (PGlite) can only be open in one process, so a worker running beside `npm run dev` could not reach it.

## Decision

- **When:** run the collection at 00:30, 06:30, 12:30 and 18:30 UTC. That is every 6 hours, about 25 minutes after the source's hourly rebuild. The times come from `trendsConfig.schedule` (`everyHours`, `minuteUtc`).
- **One snapshot per date, holding the newest file:** a later run on the same date replaces that date's rows with the newer file, and keeps the raw copy of every version.
  - A file that is unchanged (same SHA-256), or no newer by its `updated` time, changes nothing.
  - A newer file that `TRD-02` would hold never replaces figures already published for its date: they stay up, and an alert is logged. A held date can be replaced by a newer file that passes the checks.
  - The replacement runs in one transaction that locks the date's snapshot. Pages therefore see either the old figures or the new ones, never a mix, and two runs at once replace it one after the other.
- **Platform counts (`TRD-11`)** are counted again on every run and replace the date's counts in the same way. Counts younger than 5 hours are not redone (`platformStats.minHoursBetweenCounts`), so restarts and manual runs between scheduled runs don't repeat the searches.
- **Who runs it:** the app server. `src/instrumentation.ts` starts the schedule when the server starts, in both `next dev` and `next start`.
  - It uses the same database handle as the pages, which works with PGlite.
  - A server that starts after a missed run time collects 30 seconds later.
  - Runs never overlap, and a failed run is logged and the next one goes ahead as planned.
  - `TRENDS_SCHEDULE=off` turns it off: when a cron job runs `npm run trends:collect` instead, on serverless hosting, or on all but one server when several run.
- **Out-of-date notice (`TRD-09`):** shown when the newest figures are more than 8 hours old, which means one missed run plus some slack. The pages say "updated every 6 hours" and show the time of the figures as well as the date ("as of 12:07 UTC", the source's `updated` time).

## Consequences

- The figures are at most about 6 hours behind the source when all goes well, and the history still has one point per day: the last figures of that day.
- **More load on AITraining.jobs:** four downloads of each file a day instead of one, and the platform searches four times a day (3 per platform, 500 ms apart, about 190 searches per run). That is still well within the polling plan they agreed to (§13). The job feed plan was every 30 minutes.
- **Hosting:** a long-running Node server (`next start`, a container or a VM) runs the schedule by itself. On serverless hosting, where nothing runs between requests, set `TRENDS_SCHEDULE=off` and call `npm run trends:collect` from the host's cron. That needs a run time of a few minutes, mostly the paced searches. With several servers, keep the schedule on in one of them. Runs on two servers would only repeat work, because a date's rows are replaced under a lock.
- With PGlite, `npm run trends:collect` still cannot run while `npm run dev` is running. It is not needed then, because the dev server collects by itself. To stop that during development, set `TRENDS_SCHEDULE=off`.
- Alerts still go only to the server log. Email or chat alerts come with the admin module.
