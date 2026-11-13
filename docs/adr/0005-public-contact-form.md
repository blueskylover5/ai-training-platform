# ADR 0005: A public contact form before member sign-in

- **Status:** Accepted
- **Date:** 2026-11-13
- **Design reference:** system design v3.2, §6 (`CON-01` to `CON-06`)

## Context

The product owner asked for a contact section on the Platforms page, so that people who are struggling with AI training, or whose field is stopping them from earning, can reach the team: an email form, plus Telegram and Discord links. The design's expert contact flow (§6) needs signed-in members and a chosen expert (`EXP-01`), and sign-in is not built yet (phase 2).

## Decision

- Add a general contact section that anyone can use without signing in. It reaches the team, not a chosen expert, so `EXP-01` still holds for expert contact requests.
- The form has an email address, a topic from a fixed list, a message (20 to 1,000 characters), an optional name and the same rules confirmation as `EXP-02`. A Server Action checks every field again.
- Store messages in the database (`contact_messages`) and never show them on a public page. The team reads them with `npm run contact:list` until an email provider and the product domain are chosen (§13).
- Protect the open form with a per-address limit (3 an hour) and a hidden field for bots (`SEC-04`). Keep the address only as a salted hash.
- Show the Telegram and Discord buttons only once their links are set in `src/config.ts`. They must be team or community channels, never personal accounts (`SEC-03`).

## Consequences

- Visitors can ask for help today, before phase 2.
- Messages hold personal data (an email address, sometimes a name). They fall under the privacy policy and the deletion rule in `SEC-05`, which still need writing (§13).
- Nobody is notified of a new message until email delivery exists, so someone must check `npm run contact:list` regularly. Behind a hosting proxy, the per-address limit relies on its forwarded address header.
- The section repeats the community rules: no platform logins, no assessments or tasks done for anyone, no task content (`EXP-12`, Appendix A).
