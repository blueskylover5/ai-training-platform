# ADR 0003: Trends come from AITraining.jobs open data

- **Status:** Accepted
- **Date:** 2026-11-09
- **Design reference:** system design v3.0, §5 (`TRD-01` to `TRD-10`)

## Context

AITraining.jobs publishes `roles.json` and `pay.json` under CC BY 4.0. Reuse is allowed when AITraining.jobs is credited and the data date is given. Each file describes only the current day. `roles.json` also includes the number of new roles per week for recent weeks.

## Decision

- Download both files once a day. Keep the raw copy (with its SHA-256) and the parsed rows, keyed by the file's own date (`temporal_coverage`).
- Validate the schema and hold publishing when total open roles changes by more than 50% from the previous snapshot.
- Store weekly new-role counts by week; a newer file updates a week's value and records which file it came from.
- Publish charts and summary figures only, always with the credit line and data date.

## Consequences

- Daily history starts on the first collection day. Missing days stay as gaps and are never filled in.
- Weekly charts have history from day one, because each file carries recent weeks.
- AITraining.jobs sells a role-by-role dataset, so we never publish role-level history.
