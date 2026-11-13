# ADR 0004: Per-platform counts come from the AITraining.jobs job search

- **Status:** Accepted
- **Date:** 2026-11-12
- **Design reference:** system design v3.1, §5 (`TRD-11`)

## Context

The platform race page ranks platforms three ways: open roles, new roles in the last 7 days and roles advertising $100+ an hour. `roles.json` gives open roles per platform only. The free AITraining.jobs job search (`/api/v1/jobs`, CC BY 4.0, no key) answers any filtered search with a `total`, and it can filter by platform, by first-listed date (`since`) and by advertised hourly ceiling (`min_hourly_usd`).

## Decision

- Once a day, right after `roles.json`, run three searches for each platform in it: no extra filter, `since` set to 7 days ending on the data date, and `min_hourly_usd=100`. Ask for one role per search and keep only `total`.
- Pause 500 ms between searches (about 180 searches, 2 to 3 minutes a day).
- Date the counts with the `roles.json` date. Skip when that file is more than a day old, since the search describes the market now.
- Store each count with the settings it was made with (`new_since`, `big_pay_min_hourly_usd`), plus a raw record of all counts, like a downloaded file.
- Store nothing when any search fails. Hold the counts for review when they add up to more than 50% away from `roles.json`, or when a filter looks ignored.

## Consequences

- We never store or publish individual roles (`TRD-05`).
- "Big pay" uses the top of each role's advertised range, so a role advertising $8 to $65 does not count but $40 to $120 does. The page says "advertised", never "earnings" (`TRD-07`).
- Counts from the live search can differ slightly from `roles.json`, which is made earlier in the day. The race shows open roles from `roles.json` and the other two races from the search.
- If AITraining.jobs changes or limits the job search, the two extra races go back to "starts after the next daily update", and the open-roles race keeps working.
