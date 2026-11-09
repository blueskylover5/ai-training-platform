# ADR 0002: PostgreSQL through Drizzle ORM, with PGlite locally

- **Status:** Accepted
- **Date:** 2026-11-09
- **Design reference:** system design v3.0, §4 and §8

## Context

Production needs PostgreSQL. Developers and CI should be able to run the app and the tests without installing PostgreSQL or Docker.

## Decision

- Use **Drizzle ORM** for queries and **drizzle-kit** for SQL migrations kept in the repository.
- Production uses **PostgreSQL 16**.
- Local development and tests use **PGlite**, PostgreSQL compiled to WebAssembly, through Drizzle's PGlite driver. Tests run against a fresh in-memory database.

## Consequences

- The same SQL dialect and the same migrations run everywhere.
- Before launch, CI also runs the test suite against a real PostgreSQL 16 service, to catch any difference between PGlite and PostgreSQL.
