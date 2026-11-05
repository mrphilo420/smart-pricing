#!/usr/bin/env python3
"""Generate a reproducible Monte Carlo synthetic dataset for presentation.

This dataset is for demonstration and software testing only. It is not real MSE
data and must not be used for the study's final descriptive findings.

The generator uses standard-library distributions and a fixed seed so the
presentation is reproducible. Each record represents one synthetic product.
"""

from __future__ import annotations

import csv
import json
import random
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd

BASE = Path(__file__).resolve().parent
DATA_DIR = BASE / "data"
CSV_PATH = DATA_DIR / "synthetic_presentation_monte_carlo.csv"
SUMMARY_PATH = DATA_DIR / "synthetic_presentation_monte_carlo_summary.json"

SEED = 20261105
N_RECORDS = 200

SUBSECTORS = {
    "Food processing": {
        "products": [
            "Bottled calamansi juice 500 mL",
            "Banana chips 200 g",
            "Peanut butter 250 g",
            "Rice coffee 200 g",
            "Fish sauce 350 mL",
            "Coconut jam 220 g",
            "Cassava flour 1 kg",
            "Mango puree 500 g",
        ],
        "materials": (8, 35, 80),
        "labor": (3, 12, 25),
        "overhead": (2, 6, 15),
        "packaging": (1, 4, 10),
        "freight": (0.5, 2, 5),
        "fixed": (3_000, 10_000, 25_000),
        "units": (300, 1_000, 3_000),
        "margin": (0.10, 0.25, 0.40),
        "markup": (0.10, 0.20, 0.35),
        "srp_probability": 0.60,
    },
    "Garments": {
        "products": [
            "School uniform set",
            "Cotton tote bag",
            "Barong-style shirt",
            "Uniform polo",
            "Apron",
            "Face mask pack",
        ],
        "materials": (60, 180, 400),
        "labor": (30, 70, 150),
        "overhead": (10, 25, 50),
        "packaging": (2, 6, 15),
        "freight": (1, 4, 10),
        "fixed": (8_000, 18_000, 40_000),
        "units": (100, 300, 800),
        "margin": (0.15, 0.30, 0.45),
        "markup": (0.10, 0.25, 0.40),
        "srp_probability": 0.0,
    },
    "Handicrafts": {
        "products": [
            "Woven bamboo tray",
            "Capiz lantern",
            "Rattan basket",
            "Embroidered pouch",
            "Clay pot",
            "Buri hat",
        ],
        "materials": (30, 100, 250),
        "labor": (20, 55, 120),
        "overhead": (5, 15, 40),
        "packaging": (2, 5, 12),
        "freight": (1, 3, 8),
        "fixed": (5_000, 12_000, 30_000),
        "units": (100, 250, 600),
        "margin": (0.15, 0.30, 0.45),
        "markup": (0.10, 0.25, 0.40),
        "srp_probability": 0.0,
    },
    "Furniture": {
        "products": [
            "Wooden stool",
            "Bamboo shelf",
            "Study table",
            "Coat rack",
            "Folding chair",
            "Bedside table",
        ],
        "materials": (200, 600, 1_500),
        "labor": (100, 250, 600),
        "overhead": (30, 80, 200),
        "packaging": (10, 25, 50),
        "freight": (20, 60, 150),
        "fixed": (15_000, 35_000, 80_000),
        "units": (20, 70, 200),
        "margin": (0.15, 0.28, 0.40),
        "markup": (0.10, 0.20, 0.35),
        "srp_probability": 0.0,
    },
    "Other light manufacturing": {
        "products": [
            "Candle pack",
            "Laundry soap bar",
            "Detergent powder 1 kg",
            "Paper bag pack",
            "Ink refill",
            "Plastic organizer",
        ],
        "materials": (10, 45, 150),
        "labor": (5, 18, 50),
        "overhead": (3, 10, 30),
        "packaging": (2, 6, 15),
        "freight": (1, 4, 10),
        "fixed": (5_000, 12_000, 35_000),
        "units": (200, 600, 1_500),
        "margin": (0.10, 0.25, 0.40),
        "markup": (0.10, 0.20, 0.35),
        "srp_probability": 0.0,
    },
}


def _triangular(rng: random.Random, bounds: tuple[float, float, float]) -> float:
    low, mode, high = bounds
    return rng.triangular(low, high, mode)


def _optional(value: float, probability: float, rng: random.Random) -> Optional[float]:
    return round(value, 2) if rng.random() < probability else None


def generate_synthetic(n_records: int = N_RECORDS, seed: int = SEED) -> pd.DataFrame:
    """Generate a reproducible synthetic product-level dataset."""
    rng = random.Random(seed)
    rows: list[dict] = []

    for i in range(n_records):
        subsector = rng.choice(list(SUBSECTORS))
        spec = SUBSECTORS[subsector]
        product = rng.choice(spec["products"])

        materials = _triangular(rng, spec["materials"])
        labor = _triangular(rng, spec["labor"])
        variable_overhead = _triangular(rng, spec["overhead"])
        packaging = _triangular(rng, spec["packaging"])
        freight_in = _triangular(rng, spec["freight"])
        fixed_cost = _triangular(rng, spec["fixed"])
        expected_units = max(10.0, _triangular(rng, spec["units"]))
        target_margin = _triangular(rng, spec["margin"])
        markup = _triangular(rng, spec["markup"])

        variable_unit_cost = materials + labor + variable_overhead + packaging + freight_in
        fixed_cost_per_unit = fixed_cost / expected_units
        full_cost_floor = variable_unit_cost + fixed_cost_per_unit

        # Current price is deliberately noisy: some products are priced below
        # the full-cost floor, some at the floor, and some above it.
        price_factor = rng.triangular(0.80, 1.45, 1.05)
        current_price = max(1.0, full_cost_floor * price_factor)

        if rng.random() < 0.15:
            competitor_low = None
            competitor_high = None
        else:
            competitor_center = current_price * rng.lognormvariate(0.0, 0.10)
            competitor_low = max(1.0, competitor_center * rng.uniform(0.82, 0.97))
            competitor_high = max(competitor_low + 0.5, competitor_center * rng.uniform(1.03, 1.22))
            competitor_low = round(competitor_low, 2)
            competitor_high = round(competitor_high, 2)

        srp_reference = None
        if rng.random() < spec["srp_probability"]:
            srp_reference = round(current_price * rng.uniform(0.90, 1.10), 2)

        # A small share of food records use a binding ceiling to exercise the
        # empty/infeasible range state in the presentation.
        srp_binding = bool(srp_reference is not None and subsector == "Food processing" and rng.random() < 0.06)

        rows.append(
            {
                "product_id": f"SYN-{i + 1:03d}",
                "subsector": subsector,
                "product_name": product,
                "materials": round(materials, 2),
                "labor": round(labor, 2),
                "variable_overhead": round(variable_overhead, 2),
                "packaging": round(packaging, 2),
                "freight_in": round(freight_in, 2),
                "fixed_cost_month": round(fixed_cost, 2),
                "expected_units": round(expected_units, 2),
                "current_price": round(current_price, 2),
                "target_margin": round(target_margin, 4),
                "markup": round(markup, 4),
                "competitor_low": competitor_low,
                "competitor_high": competitor_high,
                "srp_reference": srp_reference,
                "srp_binding": srp_binding,
                "is_synthetic": True,
                "data_note": "Monte Carlo synthetic record for presentation and software testing only; not real MSE data.",
            }
        )

    return pd.DataFrame(rows)


def write_synthetic(
    n_records: int = N_RECORDS,
    seed: int = SEED,
    csv_path: Path = CSV_PATH,
    summary_path: Path = SUMMARY_PATH,
) -> tuple[Path, Path]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df = generate_synthetic(n_records=n_records, seed=seed)
    df.to_csv(csv_path, index=False, quoting=csv.QUOTE_MINIMAL)

    summary = {
        "dataset": "SmartPricing synthetic presentation dataset",
        "purpose": "Presentation and software testing only; not real MSE data and not for final validation.",
        "generated_on": date.today().isoformat(),
        "seed": seed,
        "records": int(len(df)),
        "subsectors": {k: int(v) for k, v in df["subsector"].value_counts().items()},
        "columns": list(df.columns),
        "monte_carlo_inputs": {
            "materials": "triangular by subsector",
            "labor": "triangular by subsector",
            "variable_overhead": "triangular by subsector",
            "packaging": "triangular by subsector",
            "freight_in": "triangular by subsector",
            "fixed_cost_month": "triangular by subsector",
            "expected_units": "triangular by subsector",
            "target_margin": "triangular by subsector",
            "markup": "triangular by subsector",
            "current_price": "full-cost floor x triangular(0.80, 1.45, 1.05)",
            "competitor_band": "lognormal center with 15% no-competitor probability",
            "srp_reference": "food processing only, 60% probability; binding ceiling rare",
        },
        "descriptive_summary": {
            "mean_full_cost_floor": round(
                float(
                    (
                        df["materials"]
                        + df["labor"]
                        + df["variable_overhead"]
                        + df["packaging"]
                        + df["freight_in"]
                        + df["fixed_cost_month"] / df["expected_units"]
                    ).mean()
                ),
                2,
            ),
            "share_current_price_below_full_cost": round(
                float(
                    (
                        df["current_price"]
                        < (
                            df["materials"]
                            + df["labor"]
                            + df["variable_overhead"]
                            + df["packaging"]
                            + df["freight_in"]
                            + df["fixed_cost_month"] / df["expected_units"]
                        )
                    ).mean()
                ),
                4,
            ),
            "share_with_competitor_band": round(float(df["competitor_low"].notna().mean()), 4),
            "share_with_srp_reference": round(float(df["srp_reference"].notna().mean()), 4),
        },
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    return csv_path, summary_path


def load_synthetic(csv_path: Path = CSV_PATH) -> pd.DataFrame:
    """Load the synthetic presentation dataset, generating it if missing."""
    if not csv_path.exists():
        write_synthetic()
    return pd.read_csv(csv_path)


if __name__ == "__main__":
    csv_path, summary_path = write_synthetic()
    df = load_synthetic(csv_path)
    print(f"Wrote {csv_path} ({len(df)} rows)")
    print(f"Wrote {summary_path}")
    print(df.head(5).to_string(index=False))
