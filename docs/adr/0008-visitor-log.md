# ADR 0008: A visitor log with IP addresses, for the owner only

- **Status:** Accepted, amended 2026-11-19 (no footer notice; deleting visits; see the amendments at the end)
- **Date:** 2026-11-19
- **Design reference:** system design v3.2, §10 (`VIS-01` to `VIS-04`, `SEC-05`)

## Context

The owner asked for a way to track and record who visits the site: their IP addresses and visit times. On 19 November 2026 they chose to keep full IP addresses without a time limit, with a notice in the footer, over two alternatives: deleting records after 90 days, or Vercel's analytics, which keeps no IP addresses.

IP addresses count as personal data in many places (in the EU under the GDPR, for example). Until now the site kept the contact form sender's address only as a salted hash (`CON-04`), in line with data minimization (`SEC-05`).

## Decision

- **What is recorded (`VIS-01`):** one row per page view in `site_visits`:
  - the time (UTC) and the page's path (without query or `#`)
  - the IP address as Vercel's proxy recorded it, read the same way as for the contact form
  - the approximate location Vercel adds (country, region, city)
  - the browser's user agent
  - on the first page of a visit only, the other site it came from
- **How:** a small client component in the root layout posts `{ path, referrer }` to `/api/visits` on every page view, including moves between pages without a full load. A script is needed for those moves: static pages such as `/contact` are often served from the browser's prefetch without reaching the server. So visitors without JavaScript, including most crawlers, are not recorded, and admin pages are skipped.
- **Kept without a time limit (`VIS-02`):** the footer of every page says that visits are logged and what is recorded.
- **Who sees it (`VIS-03`):** only the owner, on `/admin/visits`.
  - The page shows totals, the top pages and countries of the last 7 days, every visit newest first (100 per page), and **Download all as CSV**.
  - `src/proxy.ts` asks for a user name and password with the browser's own sign-in box (HTTP Basic: `ADMIN_USER`, default `admin`, and `ADMIN_PASSWORD`). The page and the download check again themselves.
  - While no password of at least 12 characters is set, the admin pages answer "not found".
- **Abuse (`VIS-04`):**
  - Requests that a browser marks as coming from another site are refused.
  - Paths must be this site's, and fields are cut to size.
  - At most 30 views per IP address per minute are recorded; the count and the insert happen under a lock.
  - In the CSV, values that a spreadsheet would run as a formula are prefixed with an apostrophe.

## Consequences

- **Privacy:**
  - Before launch, the privacy policy (§13) must say what is logged, why, and for how long. The footer line is a notice, not a policy.
  - Keeping full IP addresses without a time limit goes further than data minimization (`SEC-05`). Visitors in the EU can ask for their records or for them to be deleted. Deleting needs a database query until the admin module has a button for it.
  - With the full IP of each visit stored, the hashed address on contact messages (`CON-04`) no longer hides who sent a message from someone who can read the database: the visit times can be matched to it. Access to the database and to the admin password should be treated accordingly.
- **What counts:**
  - Anyone can post fake views with a script (up to the per-minute limit), so the figures are a guide, not an audit.
  - Visitors who block scripts are not counted.
  - Locally, location shows as "Unknown", because only Vercel adds it.
- **Storage:** one small row per page view, so even thousands a day stay well within Neon's free plan for a long time. The CSV download loads all visits at once, which will need paging once there are hundreds of thousands.
- **Password:** HTTP Basic sends the password with every admin request. That is safe over HTTPS, which Vercel always uses. There is no lockout after wrong guesses, so `ADMIN_PASSWORD` should be long and random.

## Amendment (2026-11-19): no notice on the site

The owner asked for the footer to be removed, and with it the line "We log each visit to this site: the time, the page, your IP address, its approximate location and your browser."

- The visitor log itself is unchanged (`VIS-01`, `VIS-03`, `VIS-04`).
- The data credit that was also in the footer now sits under the headline figures on the home page and the Platform guide, as it already did under every chart (`TRD-04`).

Consequence: the site no longer tells visitors that their IP address is logged. In the EU and some other places, visitors must be told about personal data when it is collected, so until the privacy policy (§13) says it, the log is collected without the notice the law expects. The privacy policy is therefore more urgent, and when it exists, a link to it should go back on every page.

## Amendment (2026-11-19): selecting and deleting visits

At the owner's request, the visit list on `/admin/visits` can be cleaned up.

- **Selecting:** each visit has a checkbox, and Shift-click selects a range. The header box selects the whole page. When there are more visits than one page holds, "Select all N visits" selects every visit in the log.
- **Deleting:** "Delete N visits" asks for confirmation ("This can't be undone"), then deletes and shows the page again with the new totals.
- **Protection:**
  - The delete action is a Server Action on the same page, so `proxy.ts` asks for the admin password first. The action checks it again (`deleteVisitsAsAdmin`), because Server Actions can be called directly.
  - Next.js refuses action calls from other sites (it compares Origin with Host).
  - A request names at most 500 visits; "all visits" is sent as such.
  - Each deletion is written to the server log with the visit ids, until the admin module's audit log exists (`SEC-07`).

Consequence: the owner can now honour a deletion request from the page itself, without a database query. The list has no search yet, so finding one person's visits means paging through or downloading the CSV.

## Amendment (2026-11-20): times in Japan time

At the owner's request, `/admin/visits` shows visit times in Japan time (JST, `Asia/Tokyo`) instead of UTC. The time zone is set in `visitConfig.admin.timeZone`.

- The database still stores each visit in UTC, so nothing already recorded changes.
- The CSV download has two time columns: `visited_at_jst` ("2026-11-19 13:12:30") first, then `visited_at_utc` as before. Its file name uses today's date in Japan.
- The "last 24 hours" and "last 7 days" figures count back from the current moment, so they are the same in any time zone.
