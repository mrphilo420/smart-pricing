#!/usr/bin/env python3
"""CLI demo for the SmartPricing descriptive decision aid."""

from engine import PivotEngine


def show(title, **kwargs):
    engine = PivotEngine()
    result = engine.calculate(**kwargs)
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)
    print(f"Variable unit cost:   ₱{result.variable_unit_cost:,.2f}")
    print(f"Full-cost floor:      ₱{result.full_cost_floor:,.2f}")
    print(f"Target-margin price:  ₱{result.target_margin_price:,.2f}")
    print(f"Markup price:         ₱{result.markup_price:,.2f}")
    print(f"Range state:          {result.range_state}")
    if result.range_low is not None:
        print(f"Reference range:      ₱{result.range_low:,.2f} – ₱{result.range_high:,.2f}")
    if result.gap is not None:
        print(f"Gap:                  ₱{result.gap:,.2f}")
    print("\nFive scenarios:")
    for s in result.scenarios:
        print(f"  {s.name:24s} {s.value:18s} {s.status}")
    for note in result.notes:
        print("  Note:", note)


if __name__ == "__main__":
    show(
        "Scenario 1 — Food processing with competitor band and SRP reference",
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

    show(
        "Scenario 2 — Garments with no SRP match",
        materials=120,
        labor=40,
        variable_overhead=20,
        fixed_cost_month=12_000,
        expected_units=600,
        current_price=320,
        target_margin=0.30,
        markup=0.20,
        competitor_low=280,
        competitor_high=420,
        srp_reference=None,
    )

    show(
        "Scenario 3 — Cost floor above the market reference",
        materials=30,
        labor=10,
        variable_overhead=5,
        fixed_cost_month=8_000,
        expected_units=800,
        current_price=60,
        target_margin=0.25,
        markup=0.20,
        competitor_low=40,
        competitor_high=50,
        srp_reference=None,
    )

    show(
        "Scenario 4 — Cost-only state, no market reference",
        materials=20,
        labor=8,
        variable_overhead=4,
        fixed_cost_month=5_000,
        expected_units=500,
        current_price=45,
        target_margin=0.25,
        markup=0.20,
        competitor_low=None,
        competitor_high=None,
        srp_reference=None,
    )
