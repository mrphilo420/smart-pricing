# SmartPricing Streamlit App

This branch contains the live Streamlit prototype for SmartPricing.

The `main` branch contains the static web artifact. This branch adds the Python app under `streamlit/`.

## What it does

- Opens in Presentation mode with 200 synthetic Monte Carlo product records.
- Computes variable unit cost, fixed cost per unit, full-cost floor, target-margin price, and markup price.
- Shows five reference scenarios: current price, full-cost floor, target-margin price, competitor band, and SRP reference.
- Reports one of four range states: feasible, empty, SRP unmatched, or cost only.
- Captures the owner's intended price and reason in a session decision log.
- Includes a Groq explanation assistant that explains the deterministic table and is prohibited from calculating or recommending a price.

The tool does not use machine learning to set or predict prices, demand elasticity, a profit-maximizing search, a price-profit curve, or a single recommended price. The owner makes the final pricing decision.

## Run

```bash
cd streamlit
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add your Groq key to `.env`, then:

```bash
streamlit run app.py
```

Open `http://localhost:8501`.

The explanation assistant is optional. If `GROQ_API_KEY` is missing or the API is unavailable, the app shows a deterministic fallback summary.

Never commit `.env`. It is ignored by Git.

## Data

- `data/synthetic_presentation_monte_carlo.csv` — 200 synthetic product records for presentation and software testing.
- `data/dti_srp_reference_prices.csv` — 565 real DTI SRP records across 2023, 2025, and 2026.
- `data/benchmark_retail_price_demand.csv` — 676 Olist e-commerce rows kept for reference.
- `data/pipeline_supply_chain_product_month.csv` — 6,093 emulated rows kept for reference.
- `data/smartpricing_schema_template.csv` — field collection template.

The synthetic records are not real MSE data and are not the study's final evidence. The synthetic SRP value is not a DTI bulletin.

## Data endpoint for the web artifact

Streamlit serves the 200-record presentation dataset at:

`http://localhost:8501/app/static/portfolio.json`

Regenerate it with:

```bash
python export_portfolio_json.py
```

Static serving is enabled in `.streamlit/config.toml`.

## Tests

```bash
python test_pivot.py
python test_monte_carlo.py
python test_ai_assistant.py
```

Live Groq smoke test:

```bash
RUN_LIVE_GROQ_TEST=1 python test_ai_assistant.py
```

## Files

| File | Purpose |
|---|---|
| `app.py` | Streamlit interface and shared design layer |
| `engine.py` | Cost calculator, SRP lookup, five scenarios, four range states |
| `ai_assistant.py` | Groq explanation-only client, guardrails, and no-key fallback |
| `monte_carlo_data.py` | Reproducible synthetic presentation-data generator |
| `export_portfolio_json.py` | Exports the data snapshot for the web artifact |
| `presentation_demo.py` | Presentation-only CLI |
| `demo.py` | Four CLI scenarios |
| `test_pivot.py` | Calculator acceptance tests |
| `test_monte_carlo.py` | Synthetic-data tests |
| `test_ai_assistant.py` | Guardrail, fallback, and optional live Groq tests |

## Design

The app shares the SmartPricing palette with the web artifact:

- Paper `#f4efe4`
- Card `#fdfbf7`
- Ink `#1f2a24`
- Moss `#2f5d50`
- Amber `#a16207`
- Rust `#9a3412`

The theme is in `.streamlit/config.toml`; the CSS layer is in `app.py`.

## Credits

- Design direction informed by [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky, CC BY 4.0
- Copy review informed by no-ai-slop by Peter Yang, MIT
