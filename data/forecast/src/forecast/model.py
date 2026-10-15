"""Lag-kernel harvest model: harvest(m, t) = sum_k w_k * planted(m, t - k) * yield(m)."""

from collections.abc import Sequence

import numpy as np
from scipy.optimize import nnls

LAGS = range(5, 10)  # half-months
DAYS_PER_PERIOD = 365.25 / 24


def harvest(planted: Sequence[float], weights: Sequence[float], yield_t_per_ha: float) -> list[float]:
    """Expected harvest (t) per half-month from planted ha, lag weights for k = 5..9 and yield."""
    out = []
    for t in range(len(planted)):
        total = 0.0
        for w, k in zip(weights, LAGS):
            if t - k >= 0:
                total += w * planted[t - k]
        out.append(total * yield_t_per_ha)
    return out


def lagged(planted: np.ndarray) -> np.ndarray:
    """(periods, lags) matrix of planted ha shifted by each lag, wrapping around the year.

    One year of data, so harvest in Jan-Apr comes from the previous year's late plantings;
    wrapping assumes that year looked like this one.
    """
    return np.stack([np.roll(planted, k) for k in LAGS], axis=1)


def fit_weights(planted: np.ndarray, production: np.ndarray, yields: np.ndarray) -> np.ndarray:
    """Pooled NNLS over municipalities. planted, production: (m, 24); yields: (m,)."""
    x = np.concatenate([lagged(p) * y for p, y in zip(planted, yields)])
    return nnls(x, production.ravel())[0]


def predict(planted: np.ndarray, weights: np.ndarray, yields: np.ndarray) -> np.ndarray:
    """In-year harvest (t), wrapping lags. planted: (m, 24); yields: (m,)."""
    return np.stack([lagged(p) @ weights * y for p, y in zip(planted, yields)])


def r2(actual: np.ndarray, pred: np.ndarray) -> float:
    actual, pred = np.ravel(actual), np.ravel(pred)
    return float(1 - ((actual - pred) ** 2).sum() / ((actual - actual.mean()) ** 2).sum())


def leave_one_out(planted: np.ndarray, production: np.ndarray, harvested: np.ndarray) -> np.ndarray:
    """Predict each municipality from weights and yield fit on all the others.

    The held-out municipality gets the others' pooled yield, since its own yield
    comes from the harvest being predicted.
    """
    yields = production.sum(1) / harvested.sum(1)
    preds = np.zeros_like(production)
    for i in range(len(planted)):
        rest = np.arange(len(planted)) != i
        w = fit_weights(planted[rest], production[rest], yields[rest])
        pooled_yield = production[rest].sum() / harvested[rest].sum()
        preds[i] = predict(planted[i : i + 1], w, np.array([pooled_yield]))[0]
    return preds


def weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    order = np.argsort(values)
    cum = np.cumsum(weights[order])
    return float(np.interp(q * cum[-1], cum, values[order]))


def relative_band(actual: np.ndarray, pred: np.ndarray, lo: float = 0.1, hi: float = 0.9) -> tuple[float, float]:
    """p10/p90 of (actual - pred) / pred, weighted by pred so near-empty half-months don't dominate."""
    a, p = np.ravel(actual), np.ravel(pred)
    keep = p > 0
    rel = (a[keep] - p[keep]) / p[keep]
    return weighted_quantile(rel, p[keep], lo), weighted_quantile(rel, p[keep], hi)


def mean_lag_days(weights: np.ndarray) -> float:
    return float(np.dot(weights, list(LAGS)) / weights.sum() * DAYS_PER_PERIOD)


def lead_days(weights: np.ndarray) -> float:
    """Shortest lag with weight: how far ahead a planting report tells us about harvest."""
    return float(min(k for w, k in zip(weights, LAGS) if w > 0) * DAYS_PER_PERIOD)
