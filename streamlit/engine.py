#!/usr/bin/env python3
"""SmartPricing descriptive decision-aid engine (pivot build).

No ML, no demand elasticity, no profit-maximizing recommendation.
The engine computes cost benchmarks, five reference scenarios, and one of four
range states. The owner makes the final pricing decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

LOCAL_DATA = Path(__file__).resolve().parent / "data"
PARENT_DATA = Path(__file__).resolve().parent.parent / "data" / "processed"
DATA_DIR = LOCAL_DATA if LOCAL_DATA.exists() else PARENT_DATA

SUBSECTORS = [
    "Food processing",
    "Garments",
    "Handicrafts",
    "Furniture",
    "Other light manufacturing",
]


@dataclass
class Scenario:
    name: str
    value: str
    basis: str
    status: str


@dataclass
class PivotResult:
    variable_unit_cost: float
    fixed_cost_month: float
    expected_units: float
    full_cost_unit: float
    full_cost_floor: float
    target_margin_price: float
    markup_price: float
    current_price: Optional[float]
    competitor_low: Optional[float]
    competitor_high: Optional[float]
    srp_reference: Optional[float]
    srp_binding: bool
    scenarios: list[Scenario]
    range_state: str
    range_low: Optional[float]
    range_high: Optional[float]
    gap: Optional[float]
    notes: list[str] = field(default_factory=list)


class PivotEngine:
    def __init__(self, data_dir: Path | str = DATA_DIR):
        self.data_dir = Path(data_dir)
        self.srp = pd.read_csv(self.data_dir / "dti_srp_reference_prices.csv")
        self.srp["price_date"] = pd.to_datetime(self.srp["price_date"])
        latest = self.srp.groupby("category")["price_date"].transform("max")
        self.srp_latest = self.srp[self.srp["price_date"].eq(latest)].copy()
        self.srp_categories = sorted(self.srp_latest["category"].dropna().unique().tolist())

    # ------------------------------------------------------------------
    # DTI SRP reference lookup
    # ------------------------------------------------------------------
    def dti_summary(self, category: Optional[str]) -> Optional[dict]:
        if not category or category not in self.srp_categories:
            return None
        rows = self.srp_latest[self.srp_latest["category"].eq(category)].copy()
        rows["srp_php"] = pd.to_numeric(rows["srp_php"], errors="coerce")
        rows = rows.dropna(subset=["srp_php"])
        if rows.empty:
            return None
        return {
            "category": category,
            "date": rows["price_date"].max().date().isoformat(),
            "count": int(len(rows)),
            "min": float(rows["srp_php"].min()),
            "median": float(rows["srp_php"].median()),
            "max": float(rows["srp_php"].max()),
            "products": rows[["product", "unit", "srp_php", "price_date"]].sort_values(
                "srp_php"
            ),
        }

    # ------------------------------------------------------------------
    # Scenario calculation
    # ------------------------------------------------------------------
    def calculate(
        self,
        *,
        materials: float,
        labor: float,
        variable_overhead: float,
        packaging: float = 0.0,
        freight_in: float = 0.0,
        fixed_cost_month: float,
        expected_units: float,
        current_price: Optional[float],
        target_margin: float,
        markup: float,
        competitor_low: Optional[float] = None,
        competitor_high: Optional[float] = None,
        srp_reference: Optional[float] = None,
        srp_binding: bool = False,
        srp_scenario_name: str = "DTI SRP reference",
        srp_label: str = "DTI Suggested Retail Price, latest matched bulletin",
    ) -> PivotResult:
        materials = max(float(materials), 0.0)
        labor = max(float(labor), 0.0)
        variable_overhead = max(float(variable_overhead), 0.0)
        packaging = max(float(packaging), 0.0)
        freight_in = max(float(freight_in), 0.0)
        fixed_cost_month = max(float(fixed_cost_month), 0.0)
        expected_units = max(float(expected_units), 1.0)
        target_margin = float(min(max(target_margin, 0.0), 0.90))
        markup = max(float(markup), 0.0)

        variable_unit_cost = materials + labor + variable_overhead + packaging + freight_in
        fixed_cost_per_unit = fixed_cost_month / expected_units
        full_cost_unit = variable_unit_cost + fixed_cost_per_unit
        full_cost_floor = full_cost_unit
        target_margin_price = (
            full_cost_unit / (1.0 - target_margin) if target_margin < 0.999 else float("inf")
        )
        markup_price = full_cost_unit * (1.0 + markup)

        comp_low = float(competitor_low) if competitor_low and competitor_low > 0 else None
        comp_high = float(competitor_high) if competitor_high and competitor_high > 0 else None
        if comp_low is not None and comp_high is not None and comp_low > comp_high:
            comp_low, comp_high = comp_high, comp_low
        srp = float(srp_reference) if srp_reference and srp_reference > 0 else None
        srp_binding = bool(srp_binding and srp is not None)

        # Upper reference: competitor band high; SRP only if legally binding.
        upper_candidates = []
        if comp_high is not None:
            upper_candidates.append(comp_high)
        if srp is not None and srp_binding:
            upper_candidates.append(srp)
        upper = min(upper_candidates) if upper_candidates else None

        lower = full_cost_floor
        notes: list[str] = [
            "The full-cost floor is a price at the expected volume; it is not a "
            "demand-adjusted breakeven."
        ]
        gap = None

        if upper is None:
            range_state = "cost_only"
            range_low = range_high = None
            gap = None
            notes.append(
                "No competitor band or binding SRP reference was provided. The aid shows the "
                "cost floor and target-margin price only."
            )
        elif lower > upper + 1e-9:
            range_state = "empty"
            range_low = range_high = None
            gap = lower - upper
            notes.append(
                "The full-cost floor is above the market reference. No price satisfies both; "
                "consider cost reduction, volume increase, or a different reference."
            )
        else:
            range_low = lower
            range_high = upper
            if srp is None and comp_high is not None:
                range_state = "srp_unmatched"
                notes.append(
                    "No DTI SRP match was found. The range uses the competitor band only."
                )
            else:
                range_state = "feasible"
                if srp is not None and not srp_binding:
                    notes.append(
                        "The DTI SRP is shown as a suggested reference, not a legal ceiling."
                    )
                if srp is not None and srp_binding:
                    notes.append(
                        "The DTI SRP is treated as a binding ceiling because a legal instrument "
                        "was explicitly recorded."
                    )

        def money(value: Optional[float]) -> str:
            return f"₱{value:,.2f}" if value is not None else "Not provided"

        scenarios = [
            Scenario(
                "Current price",
                money(current_price),
                "Owner-reported current selling price",
                "Observed" if current_price and current_price > 0 else "Not provided",
            ),
            Scenario(
                "Full-cost floor",
                money(full_cost_floor),
                "Variable cost + fixed cost / expected units",
                "Floor",
            ),
            Scenario(
                "Target-margin price",
                money(target_margin_price),
                f"Full cost / (1 - {target_margin:.0%})",
                "Target",
            ),
            Scenario(
                "Competitor band",
                f"{money(comp_low)} – {money(comp_high)}"
                if comp_low is not None and comp_high is not None
                else "Not provided",
                "Firm-specific observed competitor prices",
                "Reference" if comp_low is not None and comp_high is not None else "Not provided",
            ),
            Scenario(
                srp_scenario_name,
                money(srp),
                srp_label,
                "Binding ceiling"
                if srp_binding
                else ("Suggested reference" if srp is not None else "Not matched"),
            ),
        ]

        return PivotResult(
            variable_unit_cost=variable_unit_cost,
            fixed_cost_month=fixed_cost_month,
            expected_units=expected_units,
            full_cost_unit=full_cost_unit,
            full_cost_floor=full_cost_floor,
            target_margin_price=target_margin_price,
            markup_price=markup_price,
            current_price=current_price,
            competitor_low=comp_low,
            competitor_high=comp_high,
            srp_reference=srp,
            srp_binding=srp_binding,
            scenarios=scenarios,
            range_state=range_state,
            range_low=range_low,
            range_high=range_high,
            gap=gap,
            notes=notes,
        )


if __name__ == "__main__":
    engine = PivotEngine()
    result = engine.calculate(
        materials=8,
        labor=4,
        variable_overhead=2,
        fixed_cost_month=3_000,
        expected_units=1_000,
        current_price=20,
        target_margin=0.25,
        markup=0.20,
        competitor_low=20,
        competitor_high=25,
        srp_reference=22.50,
        srp_binding=False,
    )
    print("Variable unit cost:", result.variable_unit_cost)
    print("Full cost unit:", result.full_cost_unit)
    print("Target margin price:", result.target_margin_price)
    print("Range state:", result.range_state)
    print("Range:", result.range_low, result.range_high)
    for s in result.scenarios:
        print(s)
