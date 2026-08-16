"""Deterministic cost calculation engine.

Pricing is data-driven and always read from the model_pricing table.
No LLM is used. No pricing is hardcoded in business logic.

Production cost calculation IGNORES demo pricing (is_demo = true) by default.
Demo pricing is only used when allow_demo=True (e.g. the demo seeder).
"""
from decimal import Decimal

from supabase_client import supabase

# cache keyed by (provider, model, allow_demo)
_pricing_cache: dict[tuple[str, str, bool], dict | None] = {}


def _fetch_active_pricing(provider: str, model: str, allow_demo: bool) -> dict | None:
    key = (provider, model, allow_demo)
    if key in _pricing_cache:
        return _pricing_cache[key]

    q = (
        supabase.table("model_pricing")
        .select("*")
        .eq("provider", provider)
        .eq("model", model)
        .eq("active", True)
    )
    if not allow_demo:
        q = q.eq("is_demo", False)
    rows = q.execute().data or []

    # Prefer real (non-demo) pricing when both exist.
    rows.sort(key=lambda r: bool(r.get("is_demo")))
    row = rows[0] if rows else None
    _pricing_cache[key] = row
    return row


def clear_pricing_cache() -> None:
    _pricing_cache.clear()


def calculate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    allow_demo: bool = False,
) -> tuple[float | None, str | None]:
    """Return (estimated_cost, currency).

    Returns (None, None) when no valid pricing exists — cost is never invented.
    Production ingestion uses allow_demo=False so demo pricing is ignored.
    """
    pricing = _fetch_active_pricing(provider, model, allow_demo)
    if not pricing:
        return None, None

    input_rate = Decimal(str(pricing["input_cost_per_1m_tokens"]))
    output_rate = Decimal(str(pricing["output_cost_per_1m_tokens"]))
    million = Decimal(1_000_000)

    input_cost = (Decimal(input_tokens) / million) * input_rate
    output_cost = (Decimal(output_tokens) / million) * output_rate
    total = input_cost + output_cost
    return float(round(total, 8)), pricing.get("currency", "USD")
