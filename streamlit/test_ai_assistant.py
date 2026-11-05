#!/usr/bin/env python3
"""Tests for the Groq explanation assistant.

Default run is offline. Set RUN_LIVE_GROQ_TEST=1 to run the live smoke test.
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

from ai_assistant import (
    SAFE_REFUSAL,
    SYSTEM_PROMPT,
    _violates_guardrail,
    build_context,
    explain,
)
from engine import PivotEngine

BASE = Path(__file__).resolve().parent
APP_SRC = (BASE / "app.py").read_text()
ASSISTANT_SRC = (BASE / "ai_assistant.py").read_text()


def test_app_has_assistant_section():
    assert "Ask the explanation assistant" in APP_SRC
    assert "explain(" in APP_SRC
    assert "build_context" in APP_SRC


def test_no_hardcoded_api_key():
    assert "gsk_" not in APP_SRC
    assert "gsk_" not in ASSISTANT_SRC
    assert "GROQ_API_KEY" in ASSISTANT_SRC
    assert "GROQ_API_KEY" not in APP_SRC


def sample_result():
    engine = PivotEngine()
    return engine.calculate(
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


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def test_prompt_has_guardrails():
    text = SYSTEM_PROMPT.lower()
    for phrase in [
        "do not calculate",
        "do not recommend",
        "do not introduce external facts",
        "do not claim or predict causation",
        "owner makes the final decision",
    ]:
        assert phrase in text, f"missing guardrail phrase: {phrase}"


def test_context_is_table_only():
    context = build_context(sample_result())
    for name in [
        "Current price",
        "Full-cost floor",
        "Target-margin price",
        "Competitor band",
        "DTI SRP reference",
    ]:
        assert name in context
    assert "RANGE STATE: feasible" in context
    assert "NOTES:" in context
    assert "materials=" not in context
    assert "labor=" not in context
    assert "enterprise_id" not in context


def test_missing_key_falls_back_without_network():
    with patch("ai_assistant.requests.post") as post:
        reply = explain(sample_result(), api_key="")
    assert post.called is False
    assert reply.used_ai is False
    assert reply.error == "missing_key"
    assert "not available" in reply.text.lower()


def test_missing_key_filipino_fallback():
    with patch("ai_assistant.requests.post") as post:
        reply = explain(sample_result(), api_key="", language="Filipino/Tagalog")
    assert post.called is False
    assert reply.used_ai is False
    assert "hindi magagamit" in reply.text.lower()


def test_guardrail_detects_explicit_price_setting():
    assert _violates_guardrail("You should charge PHP 25.00.") is True
    assert _violates_guardrail("I recommend a price of PHP 25.") is True
    assert _violates_guardrail("The best price is PHP 25.") is True
    assert _violates_guardrail("This is a profit-maximizing recommendation.") is True


def test_guardrail_allows_safe_refusal():
    assert _violates_guardrail("The table does not recommend a price.") is False
    assert _violates_guardrail("No single price is recommended; the owner decides.") is False


def test_model_output_with_price_recommendation_is_blocked():
    payload = {
        "choices": [
            {"message": {"content": "You should charge PHP 99.00 for this product."}}
        ]
    }
    with patch("ai_assistant.requests.post", return_value=FakeResponse(payload=payload)):
        reply = explain(sample_result(), api_key="test-key")
    assert reply.used_ai is False
    assert reply.error == "guardrail_triggered"
    assert reply.text == SAFE_REFUSAL


def test_safe_model_output_is_returned():
    payload = {
        "choices": [
            {
                "message": {
                    "content": (
                        "The full-cost floor is PHP 17.00 and the target-margin price is "
                        "PHP 22.67. The competitor band is PHP 20.00 to PHP 25.00, so the "
                        "reference range is PHP 17.00 to PHP 25.00. The table does not "
                        "recommend a price; the owner decides."
                    )
                }
            }
        ]
    }
    with patch("ai_assistant.requests.post", return_value=FakeResponse(payload=payload)) as post:
        reply = explain(sample_result(), api_key="test-key")
    assert post.called is True
    assert reply.used_ai is True
    assert reply.error is None
    assert "PHP 17.00" in reply.text


def test_http_error_falls_back():
    with patch("ai_assistant.requests.post", return_value=FakeResponse(status_code=429)):
        reply = explain(sample_result(), api_key="test-key")
    assert reply.used_ai is False
    assert reply.error == "http_429"
    assert "not available" in reply.text.lower()


def test_live_groq_smoke():
    if os.getenv("RUN_LIVE_GROQ_TEST") != "1":
        print("SKIP test_live_groq_smoke (set RUN_LIVE_GROQ_TEST=1 to run)")
        return
    reply = explain(
        sample_result(),
        question="In two sentences, explain the difference between the full-cost floor and the target-margin price.",
        language="English",
    )
    assert reply.used_ai is True, f"live call failed: {reply.error}"
    assert len(reply.text.strip()) > 20


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for test in tests:
        test()
        print("PASS", test.__name__)
    print(f"\n{len(tests)} tests passed.")
