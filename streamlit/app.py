#!/usr/bin/env python3
"""SmartPricing descriptive decision aid — Streamlit interface (pivot build)."""

from __future__ import annotations

import json

import pandas as pd
import streamlit as st

from ai_assistant import build_context, explain
from engine import PivotEngine, SUBSECTORS
from monte_carlo_data import SUMMARY_PATH as SYNTHETIC_SUMMARY_PATH
from monte_carlo_data import load_synthetic

st.set_page_config(
    page_title="SmartPricing Decision Aid",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
:root {
  --sp-paper: #f4efe4;
  --sp-card: #fdfbf7;
  --sp-ink: #1f2a24;
  --sp-secondary: #5b615a;
  --sp-muted: #7b7266;
  --sp-moss: #2f5d50;
  --sp-amber: #a16207;
  --sp-rust: #9a3412;
  --sp-hairline: rgba(31, 42, 36, 0.12);
}
html, body, [class*="css"] {
  font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif;
}
h1, h2, h3 {
  font-family: Georgia, "Times New Roman", serif !important;
  font-weight: 500 !important;
  letter-spacing: -0.01em;
  color: var(--sp-ink);
}
h1 {
  font-size: 2.45rem !important;
  line-height: 1.05 !important;
}
div[data-testid="stToolbar"] {
  display: none;
}
.sp-brand-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.sp-brand {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 22px;
  line-height: 1;
  color: var(--sp-ink);
}
.sp-sub {
  font-size: 12px;
  color: var(--sp-muted);
  margin-top: 6px;
}
.sp-stamp {
  transform: rotate(-2deg);
  border: 1px solid #b45309;
  color: #b45309;
  padding: 4px 6px;
  font-family: Menlo, monospace;
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
}
.sp-kicker {
  font-size: 12px;
  color: var(--sp-muted);
  margin-bottom: 4px;
}
.sp-banner {
  background: var(--sp-card);
  border: 1px solid var(--sp-hairline);
  border-left: 3px solid var(--sp-moss);
  padding: 16px 18px;
  border-radius: 12px;
  color: #3f4a43;
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0 18px;
}
.sp-banner-warning {
  border-left-color: var(--sp-amber);
  background: #f7efd8;
}
.sp-banner strong {
  color: var(--sp-ink);
}
div[data-testid="stMetric"] {
  background: var(--sp-card);
  border: 1px solid var(--sp-hairline);
  border-radius: 12px;
  padding: 16px 18px;
}
div[data-testid="stMetricLabel"] {
  color: var(--sp-muted);
}
div[data-testid="stMetricValue"] {
  font-family: Menlo, "SFMono-Regular", monospace;
  font-size: 26px;
}
div[data-testid="stDataFrame"] {
  border: 1px solid var(--sp-hairline);
  border-radius: 12px;
  overflow: hidden;
}
.stButton > button, .stDownloadButton > button {
  border-radius: 8px;
  font-weight: 500;
}
div[data-testid="stAlert"] {
  border-radius: 12px;
}
a {
  color: var(--sp-moss);
}
hr {
  border-color: var(--sp-hairline);
}
header[data-testid="stHeader"] {
  background: rgba(244, 239, 228, 0.92);
}
section[data-testid="stSidebar"] {
  background: #efe9df;
}
</style>
""",
    unsafe_allow_html=True,
)


@st.cache_resource
def get_engine() -> PivotEngine:
    return PivotEngine()


@st.cache_data(show_spinner=False)
def get_synthetic() -> pd.DataFrame:
    return load_synthetic()


@st.cache_data(show_spinner=False)
def get_synthetic_with_states() -> pd.DataFrame:
    """Annotate the synthetic presentation data with the engine's range state."""
    df = get_synthetic().copy()
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
    df["range_state"] = states
    df["has_srp"] = df["srp_reference"].notna()
    priority = {"feasible": 0, "srp_unmatched": 1, "empty": 2, "cost_only": 3}
    df["presentation_priority"] = df["range_state"].map(priority)
    df["label"] = df.apply(
        lambda r: f"{r['product_id']} · {r['product_name']} · {r['subsector']} · {r['range_state']}",
        axis=1,
    )
    return df.sort_values(
        ["presentation_priority", "has_srp", "product_id"],
        ascending=[True, False, True],
    )


engine = get_engine()

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

st.sidebar.markdown(
    """
<div class="sp-brand-row">
  <div>
    <div class="sp-brand">SmartPricing</div>
    <div class="sp-sub">Pricing decision aid</div>
  </div>
  <div class="sp-stamp">SYNTHETIC</div>
</div>
""",
    unsafe_allow_html=True,
)
st.sidebar.caption("Descriptive five-scenario calculator")

presentation_mode = st.sidebar.checkbox(
    "Presentation mode (synthetic Monte Carlo sample)",
    value=True,
    help=(
        "Uses a reproducible synthetic dataset generated by monte_carlo_data.py. "
        "The records are not real MSE data and are for presentation and software testing only."
    ),
)

synth = None
dti_summary = None
dti_category = "None"

if presentation_mode:
    synth = get_synthetic_with_states()
    selected_label = st.sidebar.selectbox(
        "Synthetic product",
        synth["label"].tolist(),
        help="The list is sorted to show feasible examples first.",
    )
    row = synth.loc[synth["label"] == selected_label].iloc[0]

    subsector = str(row["subsector"])
    product_label = str(row["product_name"])
    materials = float(row["materials"])
    labor = float(row["labor"])
    variable_overhead = float(row["variable_overhead"])
    packaging = float(row["packaging"])
    freight_in = float(row["freight_in"])
    fixed_cost = float(row["fixed_cost_month"])
    expected_units = float(row["expected_units"])
    current_price = float(row["current_price"])
    target_margin_pct = int(round(float(row["target_margin"]) * 100))
    markup_pct = int(round(float(row["markup"]) * 100))
    target_margin_value = float(row["target_margin"])
    markup_value = float(row["markup"])
    comp_low = None if pd.isna(row["competitor_low"]) else float(row["competitor_low"])
    comp_high = None if pd.isna(row["competitor_high"]) else float(row["competitor_high"])
    srp_reference = None if pd.isna(row["srp_reference"]) else float(row["srp_reference"])
    srp_binding = bool(row["srp_binding"])

    st.sidebar.caption(
        "Synthetic Monte Carlo record. Costs, prices, competitor bands, and any SRP value "
        "on this page are simulated, not real enterprise or DTI data."
    )
    st.sidebar.caption(f"Dataset range state: {row['range_state']}")
else:
    subsector = st.sidebar.selectbox("Manufacturing subsector", SUBSECTORS)
    product_label = st.sidebar.text_input("Product / SKU", "Sample product")

    st.sidebar.markdown("**Cost per unit**")
    materials = st.sidebar.number_input("Direct materials (₱/unit)", min_value=0.0, value=8.0, step=1.0)
    labor = st.sidebar.number_input("Direct labor (₱/unit)", min_value=0.0, value=4.0, step=1.0)
    variable_overhead = st.sidebar.number_input(
        "Variable manufacturing overhead (₱/unit)", min_value=0.0, value=2.0, step=1.0
    )
    packaging = st.sidebar.number_input(
        "Packaging (₱/unit, optional)", min_value=0.0, value=0.0, step=0.5
    )
    freight_in = st.sidebar.number_input(
        "Freight-in (₱/unit, optional)", min_value=0.0, value=0.0, step=0.5
    )
    fixed_cost = st.sidebar.number_input(
        "Fixed cost per month (₱)", min_value=0.0, value=3_000.0, step=500.0
    )
    st.sidebar.caption(
        "Enter the fixed cost allocated to this product. If you sell several products, allocate the "
        "monthly pool across them so the total does not exceed the pool."
    )
    expected_units = st.sidebar.number_input(
        "Expected units per month", min_value=1.0, value=1_000.0, step=50.0
    )
    current_price = st.sidebar.number_input(
        "Current selling price (₱)", min_value=0.0, value=20.0, step=1.0
    )

    st.sidebar.markdown("**Pricing targets**")
    target_margin_pct = st.sidebar.slider(
        "Target profit margin on price (%)", min_value=0, max_value=80, value=25, step=1
    )
    markup_pct = st.sidebar.slider(
        "Markup on cost (%)", min_value=0, max_value=100, value=20, step=5
    )
    target_margin_value = target_margin_pct / 100
    markup_value = markup_pct / 100

    st.sidebar.markdown("**Market references**")
    use_competitor = st.sidebar.checkbox("I have a competitor price band", value=True)
    comp_low = comp_high = None
    if use_competitor:
        comp_low = st.sidebar.number_input(
            "Competitor low (₱)", min_value=0.0, value=20.0, step=1.0
        )
        comp_high = st.sidebar.number_input(
            "Competitor high (₱)", min_value=0.0, value=25.0, step=1.0
        )

    dti_options = ["None"] + engine.srp_categories
    dti_category = st.sidebar.selectbox(
        "DTI SRP category (optional)",
        dti_options,
        index=dti_options.index("CANNED SARDINES IN TOMATO SAUCE")
        if "CANNED SARDINES IN TOMATO SAUCE" in dti_options
        else 0,
    )
    dti_summary = engine.dti_summary(dti_category) if dti_category != "None" else None
    srp_reference = None
    if dti_summary:
        st.sidebar.caption(
            f"Latest SRP: ₱{dti_summary['median']:.2f} median "
            f"({dti_summary['count']} products, {dti_summary['date']})"
        )
        srp_reference = st.sidebar.number_input(
            "DTI SRP reference (₱)", min_value=0.0, value=float(dti_summary["median"]), step=0.5
        )

    srp_binding = st.sidebar.checkbox(
        "Treat the DTI SRP as a binding legal ceiling",
        value=False,
        help=(
            "Check only if a specific legal instrument (for example a price freeze or a mandated "
            "ceiling) applies to this product and date. The SRP is otherwise a suggested reference."
        ),
    )
    if srp_binding:
        st.sidebar.warning(
            "Record the legal instrument and date in the decision notes. Do not treat a suggested "
            "retail price as a legal ceiling without that basis."
        )

# ---------------------------------------------------------------------------
# Compute
# ---------------------------------------------------------------------------

srp_scenario_name = "SRP reference (synthetic)" if presentation_mode else "DTI SRP reference"
srp_label = (
    "Synthetic SRP reference generated by Monte Carlo; not a DTI bulletin"
    if presentation_mode
    else "DTI Suggested Retail Price, latest matched bulletin"
)

result = engine.calculate(
    materials=materials,
    labor=labor,
    variable_overhead=variable_overhead,
    packaging=packaging,
    freight_in=freight_in,
    fixed_cost_month=fixed_cost,
    expected_units=expected_units,
    current_price=current_price,
    target_margin=target_margin_value,
    markup=markup_value,
    competitor_low=comp_low,
    competitor_high=comp_high,
    srp_reference=srp_reference,
    srp_binding=srp_binding,
    srp_scenario_name=srp_scenario_name,
    srp_label=srp_label,
)

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------

st.markdown(
    '<div class="sp-kicker">Synthetic presentation · Bulacan manufacturing MSEs</div>',
    unsafe_allow_html=True,
)
st.title("SmartPricing Decision Aid")
st.caption(
    "A descriptive five-scenario calculator for manufacturing and production MSEs"
)

if presentation_mode:
    st.markdown(
        """
<div class="sp-banner sp-banner-warning">
  <strong>Presentation mode: synthetic Monte Carlo data.</strong> All costs, prices,
  competitor bands, and any SRP value on this page are simulated for demonstration and
  software testing. They are not real MSE data and are not the study's final evidence.
</div>
""",
        unsafe_allow_html=True,
    )

st.markdown(
    """
<div class="sp-banner">
  <strong>Decision aid, not an optimizer.</strong> This build uses cost-plus, a full-cost floor,
  a firm-specific competitor band, and an SRP reference. It does not use machine learning to
  set or predict prices, demand elasticity, or a profit-maximizing recommendation. The owner
  makes the final pricing decision.
</div>
""",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Cost metrics
# ---------------------------------------------------------------------------

st.subheader("Cost position")
c1, c2, c3, c4 = st.columns(4)
c1.metric("Variable unit cost", f"₱{result.variable_unit_cost:,.2f}")
c2.metric("Fixed cost per unit", f"₱{result.full_cost_unit - result.variable_unit_cost:,.2f}")
c3.metric("Full-cost floor", f"₱{result.full_cost_floor:,.2f}")
c4.metric("Target-margin price", f"₱{result.target_margin_price:,.2f}")

# ---------------------------------------------------------------------------
# Five scenarios
# ---------------------------------------------------------------------------

st.subheader("Five reference scenarios")
scenario_df = pd.DataFrame(
    [
        {"Scenario": s.name, "Value": s.value, "Basis": s.basis, "Status": s.status}
        for s in result.scenarios
    ]
)
st.dataframe(
    scenario_df,
    width="stretch",
    hide_index=True,
    column_config={
        "Scenario": st.column_config.TextColumn("Scenario", width="medium"),
        "Value": st.column_config.TextColumn("Value", width="medium"),
        "Basis": st.column_config.TextColumn("Basis", width="large"),
        "Status": st.column_config.TextColumn("Status", width="medium"),
    },
)

st.caption(
    "The table is a reference comparison, not a ranking. No row is highlighted, sorted by "
    "attractiveness, or presented as a recommended price."
)

# ---------------------------------------------------------------------------
# Range state
# ---------------------------------------------------------------------------

st.subheader("Reference range")

if result.range_state == "feasible":
    st.success(
        f"Reference range: ₱{result.range_low:,.2f} – ₱{result.range_high:,.2f}. "
        "This is the intersection of the full-cost floor and the market reference. "
        "It is not a recommended price."
    )
elif result.range_state == "empty":
    st.warning(
        f"No price satisfies both the full-cost floor and the market reference. "
        f"The gap is ₱{result.gap:,.2f} per unit. Consider cost reduction, a volume increase, "
        "or a different market reference before setting a price."
    )
elif result.range_state == "srp_unmatched":
    st.info(
        f"Reference range: ₱{result.range_low:,.2f} – ₱{result.range_high:,.2f}. "
        "No DTI SRP match was found, so the range uses the competitor band only."
    )
else:  # cost_only
    st.info(
        "No competitor band or binding SRP reference was provided. The aid shows the cost "
        "floor and target-margin price only; no market range is inferred."
    )

for note in result.notes:
    st.caption(f"• {note}")

# ---------------------------------------------------------------------------
# Explanation assistant (Groq, explanation-only)
# ---------------------------------------------------------------------------

st.subheader("Ask the explanation assistant")
st.caption(
    "The assistant explains the five-scenario table and the range state in plain language. "
    "It does not calculate, rank, or recommend a price. The owner makes the final decision."
)

current_ai_context = build_context(result)

with st.form("explanation_form"):
    e1, e2 = st.columns([3, 1])
    with e1:
        ai_question = st.text_input(
            "Optional question",
            placeholder="For example: Why is the reference range empty? What is the difference between the floor and the target-margin price?",
            max_chars=800,
            key="ai_question",
        )
    with e2:
        ai_language = st.selectbox(
            "Language",
            ["English", "Filipino/Tagalog"],
            key="ai_language",
        )
    ask_ai = st.form_submit_button("Explain the table")

if ask_ai:
    with st.spinner("Preparing an explanation from the table only..."):
        reply = explain(
            result,
            question=ai_question,
            language=ai_language,
        )
    st.session_state.ai_reply = reply
    st.session_state.ai_context = current_ai_context

if "ai_reply" in st.session_state:
    reply = st.session_state.ai_reply
    if st.session_state.get("ai_context") != current_ai_context:
        st.warning(
            "The inputs changed after this explanation was generated. Ask again to explain the "
            "current table."
        )
    st.markdown(reply.text)
    if reply.used_ai:
        st.caption(
            "Explanation generated from the scenario table above. It is not a price recommendation."
        )
    else:
        reason = reply.error or "unavailable"
        st.caption(
            f"Deterministic fallback shown ({reason}). The table above remains the source of truth."
        )

with st.expander("What the explanation assistant receives", expanded=False):
    st.markdown(
        """
The assistant receives only:

- the five-scenario table (scenario name, value, basis, and status);
- the range state, reference range, and cost-market gap;
- the notes shown on this page;
- your optional question and the selected language.

It does **not** receive your raw cost inputs, your identity, competitor source names, or any
external market data. It is instructed not to calculate, not to recommend a price, not to claim
causation, and not to introduce outside facts. A guardrail replaces any output that appears to
set or recommend a price.
"""
    )

# ---------------------------------------------------------------------------
# Owner decision
# ---------------------------------------------------------------------------

st.subheader("Your decision")
st.caption(
    "Record your intended price before or after reviewing the scenarios. The aid does not "
    "choose a price for you."
)

if "decision_log" not in st.session_state:
    st.session_state.decision_log = []

d1, d2 = st.columns([1, 2])
with d1:
    intended_price = st.number_input(
        "Your intended selling price (₱)",
        min_value=0.0,
        value=float(current_price) if current_price > 0 else 0.0,
        step=1.0,
        key="intended_price",
    )
with d2:
    decision_reason = st.text_input(
        "Reason for your decision (optional)",
        key="decision_reason",
        placeholder="For example: matching the competitor band, covering a new packaging cost, testing a lower price",
    )

if st.button("Record decision"):
    st.session_state.decision_log.append(
        {
            "Product": product_label,
            "Subsector": subsector,
            "Intended price": intended_price,
            "Range state": result.range_state,
            "Reference range": (
                f"₱{result.range_low:,.2f} – ₱{result.range_high:,.2f}"
                if result.range_state in ("feasible", "srp_unmatched")
                else "No range"
            ),
            "Reason": decision_reason,
        }
    )

if st.session_state.decision_log:
    st.dataframe(
        pd.DataFrame(st.session_state.decision_log),
        width="stretch",
        hide_index=True,
    )
else:
    st.caption("No decision recorded in this session yet.")

# ---------------------------------------------------------------------------
# Details
# ---------------------------------------------------------------------------

with st.expander("How the calculations work", expanded=False):
    st.latex(
        r"\text{Variable unit cost} = \text{materials} + \text{labor} + "
        r"\text{variable overhead} + \text{packaging} + \text{freight-in}"
    )
    st.latex(
        r"\text{Fixed cost per unit} = \frac{\text{fixed cost per month}}"
        r"{\text{expected units per month}}"
    )
    st.latex(
        r"\text{Full-cost floor} = \text{variable unit cost} + \text{fixed cost per unit}"
    )
    st.latex(
        r"\text{Target-margin price} = \frac{\text{full-cost floor}}"
        r"{1 - \text{target margin}}"
    )
    st.latex(
        r"\text{Markup price} = \text{full-cost floor} \times (1 + \text{markup})"
    )
    st.markdown(
        """
The full-cost floor uses the owner's expected units per month. It is a **price at current
volume**, not a demand-adjusted breakeven. If expected volume is uncertain, change the volume
input and compare the resulting floor.

The reference range is the intersection of the full-cost floor and the market reference
(competitor band high, or a legally binding SRP). If the floor is above the market reference,
the aid reports an empty range and the gap; it does not relax the ceiling.
"""
    )

with st.expander("SRP reference", expanded=False):
    if presentation_mode:
        st.write(
            "Presentation mode uses a synthetic SRP reference generated by Monte Carlo. "
            "It is not a DTI bulletin and must not be presented as a real government price."
        )
        st.metric(
            "Synthetic SRP reference",
            f"₱{srp_reference:,.2f}" if srp_reference is not None else "Not provided",
        )
        st.caption(
            "Turn off presentation mode to use the real DTI SRP records included with the prototype."
        )
    elif dti_summary:
        s1, s2, s3, s4 = st.columns(4)
        s1.metric("DTI category", dti_summary["category"])
        s2.metric("Median SRP", f"₱{dti_summary['median']:,.2f}")
        s3.metric("Range", f"₱{dti_summary['min']:,.2f} – ₱{dti_summary['max']:,.2f}")
        s4.metric("Records", dti_summary["count"])
        st.dataframe(
            dti_summary["products"].rename(
                columns={
                    "product": "Product",
                    "unit": "Unit",
                    "srp_php": "SRP (₱)",
                    "price_date": "Bulletin date",
                }
            ),
            width="stretch",
            hide_index=True,
        )
        st.caption(
            "The SRP is a suggested retail price. It is shown as a reference unless the owner "
            "records a specific legal instrument that makes it binding."
        )
    else:
        st.write(
            "No DTI SRP category selected. DTI coverage is concentrated in food processing and "
            "household products; garments, handicrafts, and furniture are not covered."
        )

with st.expander("Data and limitations", expanded=False):
    if presentation_mode:
        st.markdown(
            """
**What this presentation uses**
- A reproducible Monte Carlo synthetic dataset (200 product records).
- Synthetic cost, price, competitor, and SRP values.
- The deterministic five-scenario calculator and the explanation assistant.

**What this build does not do**
- It does not use machine learning to set prices.
- It does not estimate demand elasticity.
- It does not search for a profit-maximizing price.
- It does not rank or highlight a scenario.
- It does not claim a causal effect on margin.

**Known limits**
- The synthetic records are for presentation and software testing only; they are not real MSE data.
- The full-cost floor depends on the simulated expected volume.
- The synthetic SRP value is not a DTI bulletin.
- Competitor bands in the real study require a lawful, audited collection and a competition-law review.
- The decision log in this demo is session-only; the study build needs the privacy-preserving log in PIV-008.
"""
        )
        st.warning(
            "This page is using synthetic Monte Carlo records. The records are not real MSE data, "
            "and any SRP value shown in presentation mode is synthetic."
        )
    else:
        st.markdown(
            """
**What this build uses**
- Owner-reported cost inputs and expected volume.
- A firm-specific competitor band, if provided.
- The latest DTI SRP reference for the selected category, if matched.
- 565 real DTI SRP records across 2023, 2025, and 2026.

**What this build does not do**
- It does not use machine learning to set prices.
- It does not estimate demand elasticity.
- It does not search for a profit-maximizing price.
- It does not rank or highlight a scenario.
- It does not claim a causal effect on margin.

**Known limits**
- The full-cost floor depends on the owner's expected volume.
- DTI SRP coverage is partial and product-specific.
- Competitor bands require a lawful, audited collection and a competition-law review.
- The decision log in this demo is session-only; the study build needs the privacy-preserving log in PIV-008.
"""
        )

if presentation_mode and synth is not None:
    with st.expander("Synthetic presentation dataset (Monte Carlo)", expanded=False):
        summary = {}
        try:
            summary = json.loads(SYNTHETIC_SUMMARY_PATH.read_text())
        except (OSError, ValueError):
            summary = {}
        st.write(
            f"**{len(synth)} synthetic product records** · seed "
            f"`{summary.get('seed', '20261105')}` · generated by `monte_carlo_data.py`."
        )
        st.caption(
            "The dataset is reproducible and is used only for presentation and software testing. "
            "It is excluded from the study's final descriptive findings."
        )
        preview = synth.drop(
            columns=["label", "presentation_priority", "has_srp"], errors="ignore"
        ).head(10)
        st.dataframe(preview, width="stretch", hide_index=True)
        st.download_button(
            "Download the synthetic CSV",
            data=synth.drop(columns=["label", "presentation_priority", "has_srp"], errors="ignore").to_csv(
                index=False
            ),
            file_name="smartpricing_synthetic_presentation_monte_carlo.csv",
            mime="text/csv",
        )
        if summary:
            st.json(summary.get("descriptive_summary", {}), expanded=False)

st.divider()
st.caption("SmartPricing pivot build · Build 2026-11-05 · Bulacan State University")
