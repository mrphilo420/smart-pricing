#!/usr/bin/env python3
"""Export the synthetic presentation data for the web artifact.

Writes `static/portfolio.json`, which Streamlit serves at
`/app/static/portfolio.json` when `server.enableStaticServing` is enabled.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from engine import PivotEngine
from monte_carlo_data import load_synthetic

BASE = Path(__file__).resolve().parent
OUT = BASE / "static" / "portfolio.json"


def main() -> None:
    df = load_synthetic()
    engine = PivotEngine()
    rows = []

    for _, record in df.iterrows():
        result = engine.calculate(
            materials=float(record["materials"]),
            labor=float(record["labor"]),
            variable_overhead=float(record["variable_overhead"]),
            packaging=float(record["packaging"]),
            freight_in=float(record["freight_in"]),
            fixed_cost_month=float(record["fixed_cost_month"]),
            expected_units=float(record["expected_units"]),
            current_price=float(record["current_price"]),
            target_margin=float(record["target_margin"]),
            markup=float(record["markup"]),
            competitor_low=None
            if pd.isna(record["competitor_low"])
            else float(record["competitor_low"]),
            competitor_high=None
            if pd.isna(record["competitor_high"])
            else float(record["competitor_high"]),
            srp_reference=None
            if pd.isna(record["srp_reference"])
            else float(record["srp_reference"]),
            srp_binding=bool(record["srp_binding"]),
        )
        rows.append(
            {
                "id": record["product_id"],
                "name": record["product_name"],
                "subsector": record["subsector"],
                "state": result.range_state,
                "floor": round(result.full_cost_floor, 2),
                "price": round(float(record["current_price"]), 2),
                "competitorHigh": None
                if pd.isna(record["competitor_high"])
                else round(float(record["competitor_high"]), 2),
                "targetMargin": round(float(record["target_margin"]), 4),
                "srpReference": None
                if pd.isna(record["srp_reference"])
                else round(float(record["srp_reference"]), 2),
                "srpBinding": bool(record["srp_binding"]),
            }
        )

    payload = {
        "source": "SmartPricing Streamlit synthetic presentation dataset",
        "note": (
            "Synthetic Monte Carlo data for presentation and software testing only. "
            "Not real MSE data."
        ),
        "seed": 20261105,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "records": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"Wrote {OUT} ({len(rows)} records)")


if __name__ == "__main__":
    main()
