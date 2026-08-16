"""Development-only demo data seeder.

Generates realistic usage_events with intentional patterns that a future
optimization engine can discover (premium-model overuse, excessive retries,
token growth, cost spikes, reliability degradation). No optimization results
are faked — only real underlying events are produced.
"""
import random
import uuid
from datetime import datetime, timedelta, timezone

from pricing import calculate_cost
from supabase_client import supabase

# provider -> (premium_model, cheap_model)
# Demo model identifiers (prefixed "demo-") that match the is_demo pricing rows.
MODELS = {
    "openai": ("demo-openai-premium", "demo-openai-mini"),
    "anthropic": ("demo-anthropic-premium", "demo-anthropic-lite"),
    "google": ("demo-google-pro", "demo-google-flash"),
    "openrouter": ("demo-openrouter-mixtral", "demo-openrouter-mixtral"),
}

WORKFLOWS = {
    "customer_support": ["chat", "ticket_triage", "faq"],
    "lead_analysis": ["scoring", "enrichment"],
    "document_processing": ["extraction", "summarization"],
    "content_generation": ["blog", "email_copy"],
}

# request_type tags used to expose "similar low-complexity" patterns
SIMPLE_TYPES = ["order_status", "faq", "greeting", "yes_no", "classification"]
COMPLEX_TYPES = ["deep_analysis", "long_form", "multi_step_reasoning"]


def _pick_provider() -> str:
    return random.choices(
        ["openai", "anthropic", "google", "openrouter"], weights=[0.45, 0.28, 0.2, 0.07]
    )[0]


def _make_event(project_id: str, ts: datetime) -> dict:
    workflow = random.choice(list(WORKFLOWS.keys()))
    feature = random.choice(WORKFLOWS[workflow])
    provider = _pick_provider()
    premium, cheap = MODELS[provider]

    # PATTERN 1: customer_support overuses the premium model for simple requests
    if workflow == "customer_support":
        use_premium = random.random() < 0.72
        request_type = random.choice(SIMPLE_TYPES) if random.random() < 0.8 else random.choice(COMPLEX_TYPES)
    elif workflow == "content_generation":
        use_premium = random.random() < 0.6
        request_type = random.choice(COMPLEX_TYPES)
    else:
        use_premium = random.random() < 0.35
        request_type = random.choice(SIMPLE_TYPES + COMPLEX_TYPES)

    model = premium if use_premium else cheap
    is_simple = request_type in SIMPLE_TYPES

    # token counts (simple requests are small even when sent to premium models)
    if is_simple:
        input_tokens = random.randint(150, 700)
        output_tokens = random.randint(40, 300)
    else:
        input_tokens = random.randint(1200, 6000)
        output_tokens = random.randint(400, 2500)

    # PATTERN 4: token growth over time (older events smaller, recent larger)
    age_days = (datetime.now(timezone.utc) - ts).days
    growth = max(0.6, 1.4 - age_days / 60.0)
    input_tokens = int(input_tokens * growth)
    output_tokens = int(output_tokens * growth)
    total_tokens = input_tokens + output_tokens

    # latency: premium slower, degradation for one provider
    base_latency = random.randint(300, 1200) if not use_premium else random.randint(700, 2600)
    if provider == "google" and age_days < 3:
        base_latency = int(base_latency * random.uniform(1.5, 2.6))  # PATTERN 6: reliability degradation
    latency_ms = base_latency

    # status / errors  (PATTERN 6: degradation raises error rate recently for google)
    err_chance = 0.04
    if provider == "google" and age_days < 3:
        err_chance = 0.22
    if provider == "openrouter":
        err_chance = 0.12

    status = "success"
    error_type = None
    roll = random.random()
    if roll < err_chance:
        error_type = random.choices(
            ["rate_limit", "server_error", "timeout"], weights=[0.4, 0.35, 0.25]
        )[0]
        status = "timeout" if error_type == "timeout" else "error"
        if error_type == "timeout":
            latency_ms = random.randint(9000, 15000)
        output_tokens = 0
        total_tokens = input_tokens

    estimated_cost, currency = calculate_cost(provider, model, input_tokens, output_tokens)

    metadata = {"request_type": request_type, "complexity": "simple" if is_simple else "complex"}
    # PATTERN 3: excessive retries flagged in metadata
    if error_type == "rate_limit" and random.random() < 0.6:
        metadata["retry_count"] = random.randint(2, 5)
        metadata["retried"] = True

    return {
        "project_id": project_id,
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "timestamp": ts.isoformat(),
        "provider": provider,
        "model": model,
        "workflow": workflow,
        "feature": feature,
        "environment": "production",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "latency_ms": latency_ms,
        "status": status,
        "error_type": error_type,
        "estimated_cost": estimated_cost,
        "cost_currency": currency or "USD",
        "metadata": metadata,
    }


def seed_demo(workspace_id: str, days: int = 30, per_day: int = 60) -> dict:
    """Create (or reuse) a demo project and generate usage events for it."""
    existing = (
        supabase.table("projects")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("name", "Demo Production App")
        .limit(1)
        .execute()
    )
    if existing.data:
        project = existing.data[0]
    else:
        project = (
            supabase.table("projects")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "name": "Demo Production App",
                    "description": "Auto-generated demo project with realistic AI usage events.",
                    "environment": "production",
                }
            )
            .execute()
        ).data[0]

    project_id = project["id"]
    now = datetime.now(timezone.utc)
    events: list[dict] = []
    for d in range(days):
        day_start = now - timedelta(days=d)
        # PATTERN 5: cost spike ~day 5-7 ago (volume surge)
        count = per_day
        if 5 <= d <= 7:
            count = int(per_day * 2.2)
        for _ in range(count):
            ts = day_start - timedelta(
                hours=random.randint(0, 23), minutes=random.randint(0, 59)
            )
            events.append(_make_event(project_id, ts))

    # batch insert
    inserted = 0
    for i in range(0, len(events), 500):
        chunk = events[i : i + 500]
        supabase.table("usage_events").insert(chunk).execute()
        inserted += len(chunk)

    return {"project_id": project_id, "events_created": inserted}
