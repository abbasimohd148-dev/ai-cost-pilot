"""Deterministic cost calculation engine.

Pricing is data-driven and always read from the model_pricing table.
No LLM is used. No pricing is hardcoded in business logic.
"""
from datetime import datetime, timezone
from decimal import Decimal

from supabase_client import supabase

# small in-process cache to avoid a DB round-trip per event
_pricing_cache: dict[tuple[str, str], dict | None] = {}


def _fetch_active_pricing(provider: str, model: str) -> dict | None:
    key = (provider, model)
    if key in _pricing_cache:
        return _pricing_cache[key]
    res = (
        supabase.table("model_pricing")
        .select("*")
        .eq("provider", provider)
        .eq("model", model)
        .eq("active", True)
        .limit(1)
        .execute()
    )
    row = res.data[0] if res.data else None
    _pricing_cache[key] = row
    return row


def clear_pricing_cache() -> None:
    _pricing_cache.clear()


def calculate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> tuple[float | None, str | None]:
    """Return (estimated_cost, currency).

    Returns (None, None) when no pricing exists — cost is never invented.
    """
    pricing = _fetch_active_pricing(provider, model)
    if not pricing:
        return None, None

    input_rate = Decimal(str(pricing["input_cost_per_1m_tokens"]))
    output_rate = Decimal(str(pricing["output_cost_per_1m_tokens"]))
    million = Decimal(1_000_000)

    input_cost = (Decimal(input_tokens) / million) * input_rate
    output_cost = (Decimal(output_tokens) / million) * output_rate
    total = input_cost + output_cost
    return float(round(total, 8)), pricing.get("currency", "USD")
