# Forecast (M8)

Offline training for the arrival forecast. The app reads only the exported files.

```sh
uv sync
uv run python -m forecast.train   # writes out/arrivals.csv and out/metrics.json
uv run pytest
```

## Pipeline (TRD M8)

1. Parse `data/opa/raw/ANNUAL REPORT PROVINCIAL DATA 2025.xlsx` and check places sum to the province (`parse.py`).
2. Fit lag weights (k = 5–9 half-months) with non-negative least squares, pooled across municipalities (`model.py`). Lags wrap around the year (Jan–Apr harvest comes from last year's late plantings, assumed like this year's).
3. Evaluate leave-one-municipality-out. The held-out municipality gets the others' pooled yield so its own harvest never leaks in.
4. Apply IRPC's share with p10–p90 ranges; spread each half-month over its days (`train.py`).
5. Export `out/arrivals.csv` and `out/metrics.json`, then load with `pnpm import:forecast`.

Exports cover only half-months whose lags all fall inside the planting year: `opa-2025` (May 16, 2025 – Mar 15, 2026) and `demo-synthetic` from a generated 2026 report (May 16, 2026 – Mar 15, 2027). Demo data is never used for training.

## Notes

- **Ranges:** the p10/p90 band is the province-level held-out residual ÷ prediction, applied to every row so summed arrivals keep a sensible width. Per municipality × half-month the error is too wide to use (p10 ≈ −100%).
- **Rounding:** rows are whole kg per municipality per day, and many are only a few kg, so trust daily totals across municipalities rather than single rows.
- **IRPC's share:** the TRD uses 2021–2023 purchases by municipality, which aren't in the repo yet. Until then the share is provisional: 2025 palay purchases (financial statements ÷ ₱21/kg) ÷ 2025 provincial production, the same for every municipality. The assumptions are listed in `metrics.json`, and the range doesn't include this uncertainty. Drop a `share.csv` (`psgc_code,share`, one row per municipality) here to override it.
