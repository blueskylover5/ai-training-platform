# AITraining.jobs open-data fixtures

Recorded copies of AITraining.jobs open data, used only by tests. Tests never call the live endpoints.

| File | Source | Data date |
|---|---|---|
| `roles-2026-11-09.json` | https://aitraining.jobs/roles.json | 2026-11-09 |
| `pay-2026-11-09.json` | https://aitraining.jobs/pay.json | 2026-11-09 |
| `search-count-2026-11-12.json` | https://aitraining.jobs/api/v1/jobs?platform=mercor&since=2026-11-06&limit=1 | 2026-11-12 |

Data: [AITraining.jobs open data](https://aitraining.jobs/data), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), 9 and 12 November 2026. The files are unmodified. The search answer is used only for its shape and `total`; the app never stores the role in it (`TRD-05`, `TRD-11`).
