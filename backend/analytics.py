"""Analytics engine — computes real metrics from usage_events in Supabase."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np

from supabase_client import supabase

PAGE = 1000
MAX_EVENTS = 100_000


def resolve_range(range_key: str | None, start: str | None, end: str | None):
    """Return (start_iso, end_iso) for filtering."""
    now = datetime.now(timezone.utc)
    if range_key == "custom" and start and end:
        return start, end
    mapping = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}
    delta = mapping.get(range_key or "7d", timedelta(days=7))
    return (now - delta).isoformat(), now.isoformat()


def fetch_events(project_ids: list[str], start_iso: str, end_iso: str) -> list[dict]:
    if not project_ids:
        return []
    events: list[dict] = []
    offset = 0
    while offset < MAX_EVENTS:
        res = (
            supabase.table("usage_events")
            .select("*")
            .in_("project_id", project_ids)
            .gte("timestamp", start_iso)
            .lte("timestamp", end_iso)
            .order("timestamp", desc=False)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows = res.data or []
        events.extend(rows)
        if len(rows) < PAGE:
            break
        offset += PAGE
    return events


def _cost(e: dict) -> float:
    return float(e["estimated_cost"]) if e.get("estimated_cost") is not None else 0.0


def overview(events: list[dict]) -> dict:
    total = len(events)
    spend = sum(_cost(e) for e in events)
    in_tok = sum(int(e.get("input_tokens") or 0) for e in events)
    out_tok = sum(int(e.get("output_tokens") or 0) for e in events)
    tot_tok = sum(int(e.get("total_tokens") or 0) for e in events)
    latencies = [int(e["latency_ms"]) for e in events if e.get("latency_ms") is not None]
    success = sum(1 for e in events if e.get("status") == "success")
    return {
        "total_spend": round(spend, 4),
        "total_requests": total,
        "total_input_tokens": in_tok,
        "total_output_tokens": out_tok,
        "total_tokens": tot_tok,
        "avg_cost_per_request": round(spend / total, 6) if total else 0.0,
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
        "success_rate": round(100 * success / total, 2) if total else 0.0,
        "error_rate": round(100 * (total - success) / total, 2) if total else 0.0,
        "currency": "USD",
    }


def breakdown(events: list[dict], dimension: str) -> list[dict]:
    agg = defaultdict(lambda: {"spend": 0.0, "requests": 0, "tokens": 0})
    for e in events:
        key = e.get(dimension) or "unknown"
        agg[key]["spend"] += _cost(e)
        agg[key]["requests"] += 1
        agg[key]["tokens"] += int(e.get("total_tokens") or 0)
    out = [
        {
            "key": k,
            "spend": round(v["spend"], 4),
            "requests": v["requests"],
            "tokens": v["tokens"],
        }
        for k, v in agg.items()
    ]
    out.sort(key=lambda x: x["spend"], reverse=True)
    return out


def _bucket_key(ts: str, granularity: str) -> str:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if granularity == "hour":
        return dt.strftime("%Y-%m-%dT%H:00")
    return dt.strftime("%Y-%m-%d")


def timeseries(events: list[dict], granularity: str) -> list[dict]:
    agg = defaultdict(lambda: {"spend": 0.0, "requests": 0, "errors": 0})
    for e in events:
        b = _bucket_key(e["timestamp"], granularity)
        agg[b]["spend"] += _cost(e)
        agg[b]["requests"] += 1
        if e.get("status") != "success":
            agg[b]["errors"] += 1
    out = [
        {
            "bucket": b,
            "spend": round(v["spend"], 4),
            "requests": v["requests"],
            "errors": v["errors"],
        }
        for b, v in agg.items()
    ]
    out.sort(key=lambda x: x["bucket"])
    return out


def reliability(events: list[dict]) -> dict:
    total = len(events)
    success = sum(1 for e in events if e.get("status") == "success")
    errors = total - success

    def count_status(s):
        return sum(1 for e in events if e.get("status") == s)

    def count_error_type(t):
        return sum(1 for e in events if (e.get("error_type") or "") == t)

    latencies = [int(e["latency_ms"]) for e in events if e.get("latency_ms") is not None]
    arr = np.array(latencies) if latencies else np.array([0])

    # failures by dimension
    def fail_by(dim):
        agg = defaultdict(int)
        for e in events:
            if e.get("status") != "success":
                agg[e.get(dim) or "unknown"] += 1
        out = [{"key": k, "failures": v} for k, v in agg.items()]
        out.sort(key=lambda x: x["failures"], reverse=True)
        return out

    return {
        "total_requests": total,
        "success_rate": round(100 * success / total, 2) if total else 0.0,
        "error_rate": round(100 * errors / total, 2) if total else 0.0,
        "error_count": errors,
        "timeout_count": count_status("timeout"),
        "rate_limit_count": count_error_type("rate_limit"),
        "server_error_count": count_error_type("server_error"),
        "avg_latency_ms": round(float(arr.mean()), 1) if latencies else 0.0,
        "p50_latency_ms": round(float(np.percentile(arr, 50)), 1) if latencies else 0.0,
        "p95_latency_ms": round(float(np.percentile(arr, 95)), 1) if latencies else 0.0,
        "p99_latency_ms": round(float(np.percentile(arr, 99)), 1) if len(latencies) >= 100 else None,
        "failures_by_provider": fail_by("provider"),
        "failures_by_model": fail_by("model"),
        "failures_by_workflow": fail_by("workflow"),
    }
