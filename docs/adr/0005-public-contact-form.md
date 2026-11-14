# ADR 0005: A public contact form before member sign-in

- **Status:** Accepted, amended 2026-11-14 and 2026-11-15 (see the amendments at the end)
- **Date:** 2026-11-13
- **Design reference:** system design v3.2, §6 (`CON-01` to `CON-06`)

## Context

The product owner asked for a contact section on the Platforms page, so that people who are struggling with AI training, or whose field is stopping them from earning, can reach the team: an email form, plus Telegram and Discord links. The design's expert contact flow (§6) needs signed-in members and a chosen expert (`EXP-01`), and sign-in is not built yet (phase 2).

## Decision

- Add a general contact section that anyone can use without signing in. It reaches the team, not a chosen expert, so `EXP-01` still holds for expert contact requests.
- The form has an email address, a topic from a fixed list, a message (20 to 1,000 characters), an optional name and the same rules confirmation as `EXP-02`. A Server Action checks every field again.
- Store messages in the database (`contact_messages`) and never show them on a public page. The team reads them with `npm run contact:list` until an email provider and the product domain are chosen (§13).
- Protect the open form with a per-address limit (3 an hour) and a hidden field for bots (`SEC-04`). Take the address from the entry the hosting proxy appends to the forwarded-address header (`CONTACT_ADDRESS_HEADER`, `CONTACT_TRUSTED_PROXY_HOPS`), never one the visitor sends. Count and insert under a lock on the address. Keep the address only as a hash mixed with `CONTACT_HASH_SECRET`; production refuses to start without one.
- Show the Telegram and Discord buttons only once their links are set in `src/config.ts`. They must be team or community channels, never personal accounts (`SEC-03`).

## Consequences

- Visitors can ask for help today, before phase 2.
- Messages hold personal data (an email address, sometimes a name). They fall under the privacy policy and the deletion rule in `SEC-05`, which still need writing (§13).
- Nobody is notified of a new message until email delivery exists, so someone must check `npm run contact:list` regularly. The per-address limit is only as good as the proxy setting: `CONTACT_TRUSTED_PROXY_HOPS` must match the number of proxies in front of the app. Without a proxy (local development), Next.js fills in the header only when the visitor sent none, so the limit is easy to get around there; that is acceptable because the local site is not public.
- The section repeats the community rules: no platform logins, no assessments or tasks done for anyone, no task content (`EXP-12`, Appendix A).

## Amendment (2026-11-14): personal accounts until team channels exist

The team has no Telegram or Discord channels yet (§13), so the buttons would stay hidden. The owner approved an exception to `SEC-03` in #3:

- Telegram links to the personal account `@happyman01110` (`https://t.me/happyman01110`).
- Discord shows the personal username `sina2949`. Discord has no link that opens a chat from a username, so the section shows "Message us on Discord: sina2949" with a copy button instead of "Join us on Discord". Once a numeric user ID is set (`contactConfig.discord.userId`), the username also links to `https://discord.com/users/<id>`.
- Both values live in `src/config.ts` and are swapped for team channels as soon as those exist. `CON-05` records the exception.

Consequence: visitors reach individual people rather than the team, so replies depend on those people being available, and the accounts must follow the same community rules as the rest of the section (no logins, no assessments or tasks).

## Amendment (2026-11-15): a shorter contact section

The owner decided to simplify the section (#7). Two points above no longer hold: the form has no topic and no rules confirmation, and the section no longer repeats the community rules.

- Removed from the page: the "We can help with" list, the "Your account stays yours" box, the "Where are you stuck?" list and the rules checkbox. The form asks for an email address, a message and, optionally, a name. The hidden anti-bot field and the per-address limit stay.
- The Server Action no longer accepts or stores a topic or a confirmation. Migration `0003` makes `topic` and `policy_confirmed_at` nullable, so messages stored before the change keep their values and new ones leave both empty. `npm run contact:list` prints a topic only when a message has one.
- `CON-02`, `CON-06` and `AT-15` record the change.

Consequences: nothing on the section asks visitors to keep task content, assessment questions or logins out of their message, so some messages may contain them. `EXP-12` and Appendix A are unchanged. Messages also arrive without a topic, so the team learns what each one is about only by reading it.
