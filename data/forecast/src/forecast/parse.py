"""Parse the OPA annual report (see TRD appendix: OPA spreadsheet notes)."""

import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import openpyxl

REPO = Path(__file__).resolve().parents[4]
OPA_FILE = REPO / "data" / "opa" / "raw" / "ANNUAL REPORT PROVINCIAL DATA 2025.xlsx"
SEED_FILE = REPO / "supabase" / "seeds" / "01_setup.sql"

PERIODS = 24  # half-months per year
PROVINCE = "ILOILO"
FIRST_ROW = 10

PLANTED_HA_COL = 74
HARVESTED_HA_COL = 72
PRODUCTION_COLS = (62, 65, 68, 71)  # col 74 has a bad Zarraga value for Jan 16-31


@dataclass
class Report:
    """Per-place series for one year, 24 half-months each. Index 0 is the province."""

    places: list[str]
    planted_ha: np.ndarray  # (places, 24)
    harvested_ha: np.ndarray  # (places, 24)
    production_t: np.ndarray  # (places, 24)

    def municipalities(self) -> list[str]:
        return self.places[1:]


def _num(v) -> float:
    return float(v) if isinstance(v, (int, float)) else 0.0


def _rows(path: Path, sheet: str) -> list[tuple]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    return list(wb[sheet].iter_rows(values_only=True))


def load_planting(path: Path = OPA_FILE) -> tuple[list[str], np.ndarray]:
    """Planted ha per place and half-month. 24-row blocks, one row per half-month."""
    rows = [r for r in _rows(path, "BY MUNICIPALITY (Planting)")[FIRST_ROW:] if r[1]]
    places = list(dict.fromkeys(r[1] for r in rows))
    planted = np.zeros((len(places), PERIODS))
    periods = [r[2] for r in rows if r[1] == places[0]]
    for i, place in enumerate(places):
        block = [r for r in rows if r[1] == place]
        assert [r[2] for r in block] == periods, f"{place}: planting periods out of order"
        planted[i] = [_num(r[PLANTED_HA_COL]) for r in block]
    return places, planted


def load_harvest(path: Path = OPA_FILE) -> tuple[list[str], np.ndarray, np.ndarray]:
    """Harvested ha and production (t) per place and half-month.

    Data-row names are shifted for 18 places, so each block is the correctly named
    total row (no period) and the 24 data rows above it. Each block must run Jan 1-15 to
    Dec 16-31 and sum to its own total row.
    """
    rows = _rows(path, "BY MUNICIPALITY (harvesting)")
    periods = [x[2] for x in rows[FIRST_ROW : FIRST_ROW + PERIODS]]
    places, ha, prod = [], [], []
    for i in range(FIRST_ROW, len(rows)):
        r = rows[i]
        if not r[1] or r[2] is not None:
            continue
        block = [x for x in rows[FIRST_ROW:i] if x[2] is not None][-PERIODS:]
        assert [x[2] for x in block] == periods, f"{r[1]}: harvest periods out of order"
        block_ha = [_num(x[HARVESTED_HA_COL]) for x in block]
        block_prod = [sum(_num(x[c]) for c in PRODUCTION_COLS) for x in block]
        assert abs(sum(block_ha) - _num(r[HARVESTED_HA_COL])) < 0.5, f"{r[1]}: harvested ha != total row"
        assert abs(sum(block_prod) - sum(_num(r[c]) for c in PRODUCTION_COLS)) < 0.5, f"{r[1]}: production != total row"
        places.append(r[1])
        ha.append(block_ha)
        prod.append(block_prod)
    return places, np.array(ha), np.array(prod)


def load_report(path: Path = OPA_FILE) -> Report:
    places, planted = load_planting(path)
    h_places, ha, prod = load_harvest(path)
    assert places == h_places, "planting and harvest places differ"
    assert places[0] == PROVINCE
    return Report(places, planted, ha, prod)


def check(report: Report, tol: float = 0.01) -> dict[str, float]:
    """Places must sum to the provincial total. Returns harvested ÷ planted ratios outside 0.7-1.3."""
    for name in ("planted_ha", "harvested_ha", "production_t"):
        series = getattr(report, name)
        total, places = series[0].sum(), series[1:].sum()
        assert abs(places - total) <= tol * total, f"{name}: places {places:.0f} != province {total:.0f}"
    flagged = {}
    for i, place in enumerate(report.places[1:], 1):
        ratio = report.harvested_ha[i].sum() / report.planted_ha[i].sum()
        if not 0.7 <= ratio <= 1.3:
            flagged[place] = round(float(ratio), 2)
    return flagged


def psgc_codes(path: Path = SEED_FILE) -> dict[str, str]:
    """Municipality name -> PSGC code, from the setup seed."""
    return {name: code for code, name in re.findall(r"\('(\d{10})', '([^']+)'", path.read_text())}
