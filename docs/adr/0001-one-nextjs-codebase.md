# ADR 0001: One Next.js + TypeScript codebase

- **Status:** Accepted
- **Date:** 2026-11-09
- **Design reference:** system design v3.0, §4

## Context

The service is free, the team is small, and the trend pages must rank in search engines because they are how experts find us. Earlier versions of the design proposed a separate FastAPI backend.

## Decision

Build one Next.js (App Router) + TypeScript application. It serves the pages and the API routes. Background jobs (trend collection, request expiry, follow-ups) are TypeScript modules in the same repository, run by a scheduler.

## Consequences

- One language and shared types from database to UI; one build and one deployment.
- Trend pages are rendered on the server, which search engines can index.
- Python is not used for now. If heavy data or ML processing is needed later, it can be added as a separate worker without changing the app.
