"""Lag-kernel harvest model: harvest(m, t) = sum_k w_k * planted(m, t - k) * yield(m)."""

from collections.abc import Sequence

LAGS = range(5, 10)  # half-months


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
