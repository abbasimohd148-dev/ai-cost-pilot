"""Unit tests for the deterministic Premium Model Overuse Detector v1.

These test the PURE detector (no DB). Run: pytest -q backend/tests/test_optimization.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimization import detect_premium_overuse  # noqa: E402

# production pricing (is_demo=false semantics — caller passes only prod pricing)
EXPENSIVE = ("openai", "prod-premium")
CHEAP = ("openai", "prod-mini")

PROD_PRICING = {
    EXPENSIVE: {"input_cost_per_1m_tokens": 5.0, "output_cost_per_1m_tokens": 15.0, "currency": "USD"},
    CHEAP: {"input_cost_per_1m_tokens": 0.15, "output_cost_per_1m_tokens": 0.6, "currency": "USD"},
}


def _ev(provider, model, wf="customer_support", ft="chat", inp=500, out=200, status="success"):
    return {
        "provider": provider, "model": model, "workflow": wf, "feature": ft,
        "input_tokens": inp, "output_tokens": out, "status": status,
    }


def _events(key, n, **kw):
    return [_ev(key[0], key[1], **kw) for _ in range(n)]


def test_no_events_no_findings():
    assert detect_premium_overuse([], PROD_PRICING) == []


def test_single_model_no_finding():
    events = _events(EXPENSIVE, 50)
    assert detect_premium_overuse(events, PROD_PRICING) == []


def test_insufficient_expensive_sample_no_finding():
    # expensive below MIN_EXPENSIVE_SAMPLE (30)
    events = _events(EXPENSIVE, 10) + _events(CHEAP, 40)
    assert detect_premium_overuse(events, PROD_PRICING) == []


def test_insufficient_candidate_sample_no_finding():
    # cheaper below MIN_CANDIDATE_SAMPLE (20)
    events = _events(EXPENSIVE, 40) + _events(CHEAP, 5)
    assert detect_premium_overuse(events, PROD_PRICING) == []


def test_cheaper_without_production_pricing_no_finding():
    # cheaper model has no production pricing entry
    pricing = {EXPENSIVE: PROD_PRICING[EXPENSIVE]}
    events = _events(EXPENSIVE, 40) + _events(CHEAP, 40)
    assert detect_premium_overuse(events, pricing) == []


def test_expensive_without_production_pricing_no_finding():
    # expensive model has no production pricing -> cannot compute real current cost
    pricing = {CHEAP: PROD_PRICING[CHEAP]}
    events = _events(EXPENSIVE, 40) + _events(CHEAP, 40)
    assert detect_premium_overuse(events, pricing) == []


def test_cheaper_poor_success_no_finding():
    events = _events(EXPENSIVE, 40)
    # cheaper: 40 requests but 50% success -> below MIN_CANDIDATE_SUCCESS
    events += _events(CHEAP, 20, status="success") + _events(CHEAP, 20, status="error")
    assert detect_premium_overuse(events, PROD_PRICING) == []


def test_demo_pricing_never_used():
    # No production pricing provided at all -> no findings, ever
    events = _events(EXPENSIVE, 40) + _events(CHEAP, 40)
    assert detect_premium_overuse(events, {}) == []


def test_valid_premium_overuse_finding_and_savings():
    events = _events(EXPENSIVE, 40) + _events(CHEAP, 25)
    findings = detect_premium_overuse(events, PROD_PRICING)
    assert len(findings) == 1
    f = findings[0]
    assert f["type"] == "premium_model_overuse"
    assert f["expensive_model"] == {"provider": "openai", "model": "prod-premium"}
    assert f["recommended_model"] == {"provider": "openai", "model": "prod-mini"}
    assert f["affected_requests"] == 40

    # deterministic cost math:
    # expensive per req = 500/1e6*5 + 200/1e6*15 = 0.0025 + 0.003 = 0.0055 ; *40 = 0.22
    # cheap per req     = 500/1e6*0.15 + 200/1e6*0.6 = 0.000075 + 0.00012 = 0.000195 ; *40 = 0.0078
    assert abs(f["current_cost"] - 0.22) < 1e-6
    assert abs(f["estimated_replacement_cost"] - 0.0078) < 1e-6
    assert abs(f["potential_savings"] - (0.22 - 0.0078)) < 1e-6
    assert f["potential_savings"] > 0
    assert 90 < f["savings_percent"] <= 100
    assert 0.0 <= f["confidence"] <= 0.99
    # evidence completeness
    ev = f["evidence"]
    for k in [
        "affected_request_count", "expensive_model_success_rate", "cheaper_model_success_rate",
        "avg_input_tokens", "avg_output_tokens", "cheaper_model_observed_requests",
        "workflow", "feature", "current_cost", "estimated_replacement_cost", "reason",
    ]:
        assert k in ev
    assert ev["cheaper_model_observed_requests"] == 25


def test_never_negative_savings_when_candidate_more_expensive():
    # "cheap" key is actually pricier -> savings would be negative -> no finding
    reversed_pricing = {
        EXPENSIVE: {"input_cost_per_1m_tokens": 0.15, "output_cost_per_1m_tokens": 0.6, "currency": "USD"},
        CHEAP: {"input_cost_per_1m_tokens": 5.0, "output_cost_per_1m_tokens": 15.0, "currency": "USD"},
    }
    events = _events(EXPENSIVE, 40) + _events(CHEAP, 40)
    findings = detect_premium_overuse(events, reversed_pricing)
    for f in findings:
        assert f["potential_savings"] > 0  # never negative


def test_grouping_isolates_by_workflow_feature():
    # expensive in (cs, chat); cheap only in a DIFFERENT feature -> not comparable
    events = _events(EXPENSIVE, 40, wf="customer_support", ft="chat")
    events += _events(CHEAP, 40, wf="customer_support", ft="ticket")
    assert detect_premium_overuse(events, PROD_PRICING) == []
