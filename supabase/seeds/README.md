# Seeds

`pnpm db:reset` loads every `*.sql` here in name order. Local dev only; the hosted project is not seeded.

| File              | Seeds                                                       |
| ----------------- | ----------------------------------------------------------- |
| `01_setup.sql`    | IRPC facility, machines, varieties, municipalities          |
| `02_accounts.sql` | Staff logins, co-ops, farmers, traders, buyers              |
| `NN_<module>.sql` | Each later ticket adds its own file; don't edit shared ones |
| `90_peak.sql`     | Peak demo scenario (#44)                                    |

Rules for every seed file:

- **Dates are relative to `current_date`** (`current_date + 14`), never literal, so the demo works on any day.
- **Reference rows by fixed id or natural key.** The facility and base clients have fixed ids (listed at the top of their files). Look up machines by `code`, varieties by `code` and municipalities by `psgc_code`.
- Number the file after its module (`04_booking.sql`, `05_buying.sql`, `07_pricing.sql`, ...) so it loads after what it references.
