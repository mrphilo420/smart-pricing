# Data notes

## Files

| File | Rows | Status | Use |
|---|---:|---|---|
| `dti_srp_reference_prices.csv` | 565 | Real Philippine DTI SRP records | SRP reference layer |
| `synthetic_presentation_monte_carlo.csv` | 200 | Synthetic Monte Carlo records | Presentation and software testing only |
| `synthetic_presentation_monte_carlo_summary.json` | — | Generation summary | Seed and distribution record |
| `benchmark_retail_price_demand.csv` | 676 | Real Olist e-commerce data, Brazil | Schema and competitor-band testing |
| `pipeline_supply_chain_product_month.csv` | 6,093 | Emulated supply-chain data | Data-handling and interface testing |
| `smartpricing_schema_template.csv` | 0 | Project template | Field collection |

## Boundaries

- The synthetic Monte Carlo dataset is not real MSE data. It is excluded from the study's final findings.
- The SRP value in presentation mode is synthetic. It is not a DTI bulletin.
- DTI SRP coverage is concentrated in food processing and household products. Garments, handicrafts, and furniture are not covered.
- The Olist and emulated supply-chain datasets are not Philippine MSE evidence. They are kept for interface and data-handling tests.
- Competitor prices in a real study require a lawful, audited collection and a competition-law review.

## Regenerate the synthetic data

```bash
python monte_carlo_data.py
python export_portfolio_json.py
```

The generator uses seed `20261105`.
