from datetime import date

import numpy as np

from forecast.model import fit_weights, harvest, predict
from forecast.parse import check, load_report
from forecast.train import forward, half_month_days


def test_kernel_with_fixed_parameters():
    planted = [100.0] + [0.0] * 11
    weights = [0.1, 0.4, 0.3, 0.15, 0.05]
    result = harvest(planted, weights, yield_t_per_ha=4.0)
    assert result[:5] == [0.0] * 5
    assert result[5:10] == [40.0, 160.0, 120.0, 60.0, 20.0]
    assert result[10:] == [0.0, 0.0]


def test_fit_recovers_known_weights():
    rng = np.random.default_rng(0)
    planted = rng.uniform(0, 100, (10, 24))
    yields = rng.uniform(3, 5, 10)
    weights = np.array([0.15, 0.4, 0.3, 0.1, 0.05])
    production = predict(planted, weights, yields)
    np.testing.assert_allclose(fit_weights(planted, production, yields), weights, atol=1e-9)


def test_forward_uses_only_in_year_plantings():
    planted = np.zeros((1, 24))
    planted[0, 0] = 100.0
    out = forward(planted, np.array([0.1, 0.4, 0.3, 0.15, 0.05]), np.array([4.0]))
    # half-months 9..28; planting at t=0 lands at t=5..9, so only t=9 is in range
    assert out.shape == (1, 20)
    assert out[0, 0] == 20.0 and out[0, 1:].sum() == 0.0


def test_half_month_days():
    assert half_month_days(2025, 0) == [date(2025, 1, d) for d in range(1, 16)]
    assert half_month_days(2025, 3)[-1] == date(2025, 2, 28)
    assert half_month_days(2025, 23)[-1] == date(2025, 12, 31)
    assert half_month_days(2025, 24)[0] == date(2026, 1, 1)


def test_opa_report_parses_and_sums_to_province():
    report = load_report()
    assert len(report.municipalities()) == 44
    flagged = check(report)  # asserts places sum to the provincial total
    assert {"Batad", "Maasin", "San Dionisio"} <= flagged.keys()
    # Pototan's harvest data rows are labelled "Pavia"; it must still get its own block
    pototan, pavia = report.places.index("Pototan"), report.places.index("Pavia")
    assert report.production_t[pototan].sum() > report.production_t[pavia].sum()
