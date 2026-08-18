"""Optimization Engine — Premium Model Overuse Detector v1.

Deterministic, evidence-based. No LLM. Uses ONLY production pricing
(is_demo = false) to compute savings. If production pricing is unavailable
for either the expensive or the candidate cheaper model, NO finding is created.
Never invents pricing or savings; never produces negative savings.

Design:
- `detect_premium_overuse(events, production_pricing)` is a PURE function over
  in-memory data (unit-testable, no DB).
- `build_findings(events)` is a thin wrapper that loads production pricing from
  Supabase and calls the pure detector.
"""
from collections import defaultdict

from supabase_client import supabase

# ---- thresholds (deterministic, evidence gates) ----
MIN_EXPENSIVE_SAMPLE = 30      # min observed requests for the expensive model in a group
MIN_CANDIDATE_SAMPLE = 20      # min observed requests for the cheaper candidate in the group
MIN_CANDIDATE_SUCCESS = 0.95   # candidate must have strong observed success rate
MIN_SAVINGS_PERCENT = 15.0     # replacement must be materially cheaper


def _rate_cost(in_tok: int, out_tok: int, rates: dict) -> float:
    return (in_tok / 1_000_000.0) * float(rates["input_cost_per_1m_tokens"]) + (
        out_tok / 1_000_000.0
    ) * float(rates["output_cost_per_1m_tokens"])


def _is_success(e: dict) -> bool:
    return e.get("status") == "success"


def _severity(savings_percent: float, affected: int) -> str:
    if savings_percent >= 50 and affected >= MIN_EXPENSIVE_SAMPLE:
        return "high"
    if savings_percent >= 25:
        return "medium"
    return "low"


def _token_similarity(ai, ao, bi, bo) -> float:
    def d(x, y):
        m = max(x, y, 1.0)
        return abs(x - y) / m
    dist = (d(ai, bi) + d(ao, bo)) / 2.0
    return max(0.0, 1.0 - dist)


def _confidence(affected: int, cheaper_success: float, similarity: float) -> float:
    sample_score = min(1.0, affected / 200.0)
    conf = 0.40 * sample_score + 0.35 * cheaper_success + 0.25 * similarity
    return round(min(conf, 0.99), 2)


def _model_stats(events: list[dict]) -> dict:
    """Per (provider, model) stats for a set of events in one group."""
    agg = defaultdict(lambda: {"count": 0, "success": 0, "in": 0, "out": 0})
    for e in events:
        key = (e.get("provider"), e.get("model"))
        s = agg[key]
        s["count"] += 1
        if _is_success(e):
            s["success"] += 1
        s["in"] += int(e.get("input_tokens") or 0)
        s["out"] += int(e.get("output_tokens") or 0)
    out = {}
    for key, s in agg.items():
        c = s["count"]
        out[key] = {
            "provider": key[0],
            "model": key[1],
            "count": c,
            "success": s["success"],
            "success_rate": (s["success"] / c) if c else 0.0,
            "input_tokens": s["in"],
            "output_tokens": s["out"],
            "avg_input_tokens": (s["in"] / c) if c else 0.0,
            "avg_output_tokens": (s["out"] / c) if c else 0.0,
        }
    return out


def detect_premium_overuse(events: list[dict], production_pricing: dict) -> list[dict]:
    """Pure detector.

    production_pricing: dict keyed by (provider, model) ->
        {input_cost_per_1m_tokens, output_cost_per_1m_tokens, currency}
    (Callers MUST pass only is_demo=false pricing.)
    """
    if not events:
        return []

    # group by (workflow, feature)
    groups: dict[tuple, list] = defaultdict(list)
    for e in events:
        groups[(e.get("workflow"), e.get("feature"))].append(e)

    findings: list[dict] = []

    for (workflow, feature), group_events in groups.items():
        stats = _model_stats(group_events)
        # events per model for exact cost computation
        by_model_events: dict[tuple, list] = defaultdict(list)
        for e in group_events:
            by_model_events[(e.get("provider"), e.get("model"))].append(e)

        for e_key, e_stat in stats.items():
            # expensive model must have meaningful sample AND production pricing
            if e_stat["count"] < MIN_EXPENSIVE_SAMPLE:
                continue
            e_rates = production_pricing.get(e_key)
            if not e_rates:
                continue

            e_events = by_model_events[e_key]
            current_cost = sum(
                _rate_cost(int(ev.get("input_tokens") or 0), int(ev.get("output_tokens") or 0), e_rates)
                for ev in e_events
            )
            if current_cost <= 0:
                continue

            # find best qualifying cheaper candidate in the same group
            best = None
            for c_key, c_stat in stats.items():
                if c_key == e_key:
                    continue
                if c_stat["count"] < MIN_CANDIDATE_SAMPLE:
                    continue
                if c_stat["success_rate"] < MIN_CANDIDATE_SUCCESS:
                    continue
                c_rates = production_pricing.get(c_key)
                if not c_rates:
                    continue

                replacement_cost = sum(
                    _rate_cost(int(ev.get("input_tokens") or 0), int(ev.get("output_tokens") or 0), c_rates)
                    for ev in e_events
                )
                savings = current_cost - replacement_cost
                if savings <= 0:
                    continue
                savings_percent = (savings / current_cost) * 100.0
                if savings_percent < MIN_SAVINGS_PERCENT:
                    continue

                if best is None or savings > best["_savings"]:
                    best = {
                        "_savings": savings,
                        "c_key": c_key,
                        "c_stat": c_stat,
                        "c_rates": c_rates,
                        "replacement_cost": replacement_cost,
                        "savings_percent": savings_percent,
                    }

            if best is None:
                continue

            c_stat = best["c_stat"]
            affected = e_stat["count"]
            similarity = _token_similarity(
                e_stat["avg_input_tokens"], e_stat["avg_output_tokens"],
                c_stat["avg_input_tokens"], c_stat["avg_output_tokens"],
            )
            confidence = _confidence(affected, c_stat["success_rate"], similarity)
            current_cost_r = round(current_cost, 6)
            replacement_r = round(best["replacement_cost"], 6)
            savings_r = round(current_cost_r - replacement_r, 6)
            if savings_r <= 0:
                continue
            savings_percent = round((savings_r / current_cost_r) * 100.0, 2)
            currency = best["c_rates"].get("currency", "USD")

            findings.append({
                "id": f"{workflow}|{feature}|{e_key[0]}/{e_key[1]}->{best['c_key'][0]}/{best['c_key'][1]}",
                "type": "premium_model_overuse",
                "severity": _severity(savings_percent, affected),
                "workflow": workflow,
                "feature": feature,
                "expensive_model": {"provider": e_key[0], "model": e_key[1]},
                "recommended_model": {"provider": best["c_key"][0], "model": best["c_key"][1]},
                "affected_requests": affected,
                "current_cost": current_cost_r,
                "estimated_replacement_cost": replacement_r,
                "potential_savings": savings_r,
                "savings_percent": savings_percent,
                "confidence": confidence,
                "currency": currency,
                "evidence": {
                    "affected_request_count": affected,
                    "expensive_model_success_rate": round(e_stat["success_rate"] * 100, 2),
                    "cheaper_model_success_rate": round(c_stat["success_rate"] * 100, 2),
                    "avg_input_tokens": round(e_stat["avg_input_tokens"], 1),
                    "avg_output_tokens": round(e_stat["avg_output_tokens"], 1),
                    "cheaper_model_observed_requests": c_stat["count"],
                    "workflow": workflow,
                    "feature": feature,
                    "current_cost": current_cost_r,
                    "estimated_replacement_cost": replacement_r,
                    "reason": (
                        f"{e_key[1]} handled {affected} '{workflow}/{feature}' requests; "
                        f"{best['c_key'][1]} served {c_stat['count']} comparable requests at "
                        f"{round(c_stat['success_rate'] * 100, 1)}% success with a similar token profile "
                        f"and materially lower production pricing."
                    ),
                },
            })

    # sort by potential savings desc, stable
    findings.sort(key=lambda f: f["potential_savings"], reverse=True)
    return findings


def load_production_pricing() -> dict:
    """Load ONLY production (is_demo=false), active pricing from Supabase."""
    rows = (
        supabase.table("model_pricing")
        .select("provider,model,input_cost_per_1m_tokens,output_cost_per_1m_tokens,currency,is_demo,active")
        .eq("active", True)
        .eq("is_demo", False)
        .execute()
        .data
        or []
    )
    pricing = {}
    for r in rows:
        pricing[(r["provider"], r["model"])] = {
            "input_cost_per_1m_tokens": r["input_cost_per_1m_tokens"],
            "output_cost_per_1m_tokens": r["output_cost_per_1m_tokens"],
            "currency": r.get("currency", "USD"),
        }
    return pricing


def build_findings(events: list[dict]) -> dict:
    production_pricing = load_production_pricing()
    findings = detect_premium_overuse(events, production_pricing)
    total = round(sum(f["potential_savings"] for f in findings), 6)
    return {
        "findings": findings,
        "finding_count": len(findings),
        "potential_savings": total,
        "currency": "USD",
        "has_production_pricing": len(production_pricing) > 0,
    }
