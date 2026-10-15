"""Train on OPA 2025 and export out/arrivals.csv and out/metrics.json (TRD M8)."""

import csv
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np

from forecast import model
from forecast.parse import REPO, check, load_report, psgc_codes

OUT = Path(__file__).resolve().parents[2] / "out"
SHARE_FILE = Path(__file__).resolve().parents[2] / "share.csv"
FINANCIALS = REPO / "data" / "opa" / "transform" / "financial_performance.csv"

POOLED = ("Batad", "Maasin", "San Dionisio")  # harvested ÷ planted far off; use pooled yield
PRICE_PHP_PER_KG = 21  # procurement sample, Oct 2026
DEMO_SEED = 2026


def half_month_days(year: int, t: int) -> list[date]:
    """Days in half-month t (0 = Jan 1-15) of year; t >= 24 rolls into the next year."""
    year, t = year + t // 24, t % 24
    month = t // 2 + 1
    start = date(year, month, 1 if t % 2 == 0 else 16)
    end = date(year, month, 15) if t % 2 == 0 else date(year + month // 12, month % 12 + 1, 1) - timedelta(days=1)
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def forward(planted: np.ndarray, weights: np.ndarray, yields: np.ndarray) -> np.ndarray:
    """Harvest (t) for half-months 9..28 from one year's plantings, no wrapping.

    Those are the half-months whose every lag falls inside the planting year.
    """
    first, last = max(model.LAGS), 23 + min(model.LAGS)
    pad = [0.0] * (last + 1 - planted.shape[1])
    return np.array(
        [model.harvest(list(p) + pad, weights, y)[first : last + 1] for p, y in zip(planted, yields)]
    )


def irpc_share(production_t: float, codes: list[str]) -> dict:
    """IRPC's share of harvest. TRD: 2021-2023 purchases ÷ yearly harvest.

    Until that dataset is in the repo, `share.csv` is absent and we fall back to
    2025 palay purchases (₱ ÷ buying price) ÷ 2025 provincial production, uniform
    across municipalities.
    """
    if SHARE_FILE.exists():
        with SHARE_FILE.open() as f:
            by_code = {r["psgc_code"]: float(r["share"]) for r in csv.DictReader(f)}
        missing = sorted(set(codes) - by_code.keys())
        if missing:
            raise ValueError(f"share.csv is missing municipalities: {', '.join(missing)}")
        return {"source": "share.csv (2021-2023 purchases)", "by_psgc": by_code}
    with FINANCIALS.open() as f:
        php = next(
            float(r["amount_php"])
            for r in csv.DictReader(f)
            if r["year"] == "2025" and r["period"] == "TOTAL" and r["line_item"] == "Raw Materials (Palay)"
        )
    kg = php / PRICE_PHP_PER_KG
    return {
        "source": "provisional: 2025 palay purchases ÷ 2025 provincial production, uniform",
        "purchases_php": php,
        "price_php_per_kg": PRICE_PHP_PER_KG,
        "purchases_kg": round(kg),
        "uniform": kg / (production_t * 1000),
        "assumptions": [
            "Raw Materials (Palay) is palay used, taken as palay bought",
            "₱21/kg is from one Oct 2026 procurement receipt",
            "denominator is OPA 2025 production; PSA 2025 is about 6% lower",
            "same share for every municipality",
        ],
    }


def demo_planting(planted: np.ndarray) -> np.ndarray:
    """Synthetic 2026 report: each municipality shifted up to ±1 half-month and scaled up to ±15%."""
    rng = np.random.default_rng(DEMO_SEED)
    shifts = rng.integers(-1, 2, len(planted))
    scales = rng.uniform(0.85, 1.15, len(planted))
    return np.stack([np.roll(p, s) * c for p, s, c in zip(planted, shifts, scales)])


def rows(source, year, harvest_t, municipalities, codes, shares, band):
    first = max(model.LAGS)
    for i, name in enumerate(municipalities):
        share = shares["by_psgc"][codes[name]] if "by_psgc" in shares else shares["uniform"]
        for j, tonnes in enumerate(harvest_t[i]):
            days = half_month_days(year, first + j)
            mid = tonnes * 1000 * share / len(days)
            low, high = round(max(0.0, mid * (1 + band[0]))), round(mid * (1 + band[1]))
            if high == 0:
                continue
            for d in days:
                yield [codes[name], d.isoformat(), low, round(mid), high, source]


def main() -> None:
    report = load_report()
    flagged = check(report)
    names = report.municipalities()
    codes = psgc_codes()
    planted, production, harvested = report.planted_ha[1:], report.production_t[1:], report.harvested_ha[1:]

    province_yield = report.production_t[0].sum() / report.harvested_ha[0].sum()
    yields = np.array(
        [province_yield if n in POOLED else production[i].sum() / harvested[i].sum() for i, n in enumerate(names)]
    )
    fit = np.array([n not in POOLED for n in names])

    weights = model.fit_weights(planted[fit], production[fit], yields[fit])
    held_out = model.leave_one_out(planted[fit], production[fit], harvested[fit])
    in_sample = model.predict(planted, weights, yields)
    band = model.relative_band(production[fit].sum(0), held_out.sum(0))
    shares = irpc_share(report.production_t[0].sum(), [codes[n] for n in names])

    out = [["psgc_code", "date", "kg_low", "kg_mid", "kg_high", "source"]]
    out += rows("opa-2025", 2025, forward(planted, weights, yields), names, codes, shares, band)
    demo = forward(demo_planting(planted), weights, yields)
    out += rows("demo-synthetic", 2026, demo, names, codes, shares, band)

    metrics = {
        "trained_on": date.today().isoformat(),
        "data": "OPA annual report 2025, 44 municipalities × 24 half-months",
        "lags_half_months": list(model.LAGS),
        "lag_weights": [round(float(w), 4) for w in weights],
        "mean_lag_days": round(model.mean_lag_days(weights), 1),
        "lead_days": round(model.lead_days(weights)),
        "r2": {
            "province_held_out": round(model.r2(production[fit].sum(0), held_out.sum(0)), 3),
            "municipality_half_month_held_out": round(model.r2(production[fit], held_out), 3),
            "province_in_sample": round(model.r2(production.sum(0), in_sample.sum(0)), 3),
            "municipality_half_month_in_sample": round(model.r2(production, in_sample), 3),
        },
        "evaluation": "leave-one-municipality-out; held-out municipality uses the others' pooled yield",
        "band": {
            "p10": round(band[0], 3),
            "p90": round(band[1], 3),
            "basis": "province held-out residual ÷ prediction, 24 half-months",
            "excludes": "uncertainty in IRPC's share",
        },
        "pooled": list(POOLED),
        "flagged_harvest_to_planted": flagged,
        "irpc_share": {k: v for k, v in shares.items() if k != "by_psgc"},
        "demo": {"source": "demo-synthetic", "seed": DEMO_SEED, "shift_half_months": 1, "scale": 0.15},
    }

    OUT.mkdir(exist_ok=True)
    with (OUT / "arrivals.csv").open("w", newline="") as f:
        csv.writer(f).writerows(out)
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))
    print(f"wrote {len(out) - 1} rows to {OUT / 'arrivals.csv'}")


if __name__ == "__main__":
    main()
