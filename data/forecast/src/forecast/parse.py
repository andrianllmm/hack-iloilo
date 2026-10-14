"""Parse the OPA annual report (see TRD appendix: OPA spreadsheet notes)."""

from pathlib import Path

OPA_FILE = (
    Path(__file__).resolve().parents[3]
    / "opa"
    / "raw"
    / "ANNUAL REPORT PROVINCIAL DATA 2025.xlsx"
)


def load_planting(path: Path = OPA_FILE):
    """Planted ha per municipality and half-month. TODO(M8)."""
    raise NotImplementedError


def load_harvest(path: Path = OPA_FILE):
    """Harvested ha and production per municipality and half-month. TODO(M8)."""
    raise NotImplementedError
