#!/usr/bin/env python3
"""Tests for the Monte Carlo synthetic presentation dataset."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from engine import PivotEngine
from monte_carlo_data import (
    CSV_PATH,
    SUMMARY_PATH,
    generate_synthetic,
    load_synthetic,
    write_synthetic,
)

BASE = Path(__file__).resolve().parent


def test_reproducible():
    a = generate_synthetic(n_records=40, seed=123)
    b = generate_synthetic(n_records=40, seed=123)
    pd.testing.assert_frame_equal(a, b)


def test_required_columns_and_rows():
    df = generate_synthetic(n_records=60, seed=20261105)
    assert len(df) == 60
    required = {
        "product_id",
        "subsector",
        "product_name",
        "materials",
        "labor",
        "variable_overhead",
        "packaging",
        "freight_in",
        "fixed_cost_month",
        "expected_units",
        "current_price",
        "target_margin",
        "markup",
        "competitor_low",
        "competitor_high",
        "srp_reference",
        "srp_binding",
        "is_synthetic",
        "data_note",
    }
    assert required.issubset(df.columns)
    assert df["product_id"].is_unique


def test_synthetic_values_are_plausible():
    df = generate_synthetic(n_records=100, seed=20261105)
    for col in [
        "materials",
        "labor",
        "variable_overhead",
        "packaging",
        "freight_in",
        "fixed_cost_month",
        "expected_units",
        "current_price",
    ]:
        assert (df[col] >= 0).all(), col
    assert (df["expected_units"] > 0).all()
    assert df["target_margin"].between(0, 0.9).all()
    assert df["markup"].between(0, 1).all()
    both = df.dropna(subset=["competitor_low", "competitor_high"])
    assert (both["competitor_low"] <= both["competitor_high"]).all()
    assert df["is_synthetic"].all()
    assert df["data_note"].str.contains("not real MSE data").all()
    assert df["product_id"].str.startswith("SYN-").all()


def test_binding_srp_only_when_present():
    df = generate_synthetic(n_records=200, seed=20261105)
    assert not (df["srp_binding"] & df["srp_reference"].isna()).any()


def test_dataset_exercises_all_range_states():
    df = generate_synthetic(n_records=200, seed=20261105)
    eng = PivotEngine()
    states = []
    for _, row in df.iterrows():
        result = eng.calculate(
            materials=float(row["materials"]),
            labor=float(row["labor"]),
            variable_overhead=float(row["variable_overhead"]),
            packaging=float(row["packaging"]),
            freight_in=float(row["freight_in"]),
            fixed_cost_month=float(row["fixed_cost_month"]),
            expected_units=float(row["expected_units"]),
            current_price=float(row["current_price"]),
            target_margin=float(row["target_margin"]),
            markup=float(row["markup"]),
            competitor_low=None if pd.isna(row["competitor_low"]) else float(row["competitor_low"]),
            competitor_high=None if pd.isna(row["competitor_high"]) else float(row["competitor_high"]),
            srp_reference=None if pd.isna(row["srp_reference"]) else float(row["srp_reference"]),
            srp_binding=bool(row["srp_binding"]),
        )
        states.append(result.range_state)
    assert set(states) == {"feasible", "empty", "srp_unmatched", "cost_only"}


def test_csv_and_summary_exist_and_are_labeled():
    if not CSV_PATH.exists():
        write_synthetic()
    df = load_synthetic()
    assert len(df) == 200
    assert df["is_synthetic"].all()
    summary = json.loads(SUMMARY_PATH.read_text())
    assert summary["records"] == 200
    assert "not real MSE data" in summary["purpose"]
    assert summary["seed"] == 20261105


def test_no_real_enterprise_identifiers():
    df = load_synthetic()
    for col in df.columns:
        lowered = col.lower()
        assert "name" not in lowered or lowered == "product_name"
        assert "address" not in lowered
        assert "owner" not in lowered
        assert "tin" not in lowered


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for test in tests:
        test()
        print("PASS", test.__name__)
    print(f"\n{len(tests)} tests passed.")
