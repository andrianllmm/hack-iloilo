# Forecast (M8)

Offline training for the arrival forecast. The app reads only the exported files.

```sh
uv sync
uv run pytest
```

## Pipeline (TRD M8)

1. Parse `data/opa/raw/ANNUAL REPORT PROVINCIAL DATA 2025.xlsx` (`parse.py`).
2. Fit lag weights (k = 5–9 half-months) with non-negative least squares, pooled across municipalities (`model.py`).
3. Evaluate leave-one-municipality-out.
4. Apply IRPC's share with p10–p90 residual ranges; spread each half-month over its days.
5. Export `out/arrivals.csv` and `out/metrics.json`, then load with `pnpm import:forecast`.
