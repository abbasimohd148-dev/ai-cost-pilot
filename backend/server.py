import logging
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import analytics as an
import optimization as opt
from deps import (
    assert_project_access,
    assert_workspace_member,
    ensure_bootstrap,
    get_current_user,
    get_user_workspace_ids,
)
from pricing import calculate_cost
from security import generate_api_key, hash_key
from seed import seed_demo
from supabase_client import supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("autopilot")

app = FastAPI(title="AI Cost & Reliability Autopilot")
api = APIRouter(prefix="/api")


# ----------------------------- models -----------------------------
class ProfileUpdate(BaseModel):
    full_name: str


class WorkspaceCreate(BaseModel):
    name: str


class ProjectCreate(BaseModel):
    workspace_id: str
    name: str
    description: Optional[str] = None
    environment: str = "development"


class ApiKeyCreate(BaseModel):
    name: str


class EventIn(BaseModel):
    request_id: Optional[str] = None
    timestamp: Optional[str] = None
    provider: str
    model: str
    workflow: Optional[str] = None
    feature: Optional[str] = None
    environment: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: Optional[int] = None
    status: str = "success"
    error_type: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


# ----------------------------- health -----------------------------
@api.get("/")
async def root():
    return {"service": "ai-cost-autopilot", "status": "ok"}


# ----------------------------- auth / profile -----------------------------
@api.get("/me")
def me(user: dict = Depends(get_current_user)):
    ensure_bootstrap(user)
    profile = supabase.table("profiles").select("*").eq("user_id", user["id"]).limit(1).execute().data
    ws_ids = get_user_workspace_ids(user["id"])
    workspaces = []
    if ws_ids:
        workspaces = (
            supabase.table("workspaces").select("*").in_("id", ws_ids).order("created_at").execute().data
        )
    members = (
        supabase.table("workspace_members").select("*").eq("user_id", user["id"]).execute().data
    )
    role_map = {m["workspace_id"]: m["role"] for m in members}
    for w in workspaces:
        w["role"] = role_map.get(w["id"], "member")
    return {
        "user": user,
        "profile": profile[0] if profile else None,
        "workspaces": workspaces,
    }


@api.patch("/profile")
def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    supabase.table("profiles").update(
        {"full_name": body.full_name, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("user_id", user["id"]).execute()
    return supabase.table("profiles").select("*").eq("user_id", user["id"]).limit(1).execute().data[0]


# ----------------------------- workspaces -----------------------------
@api.get("/workspaces")
def list_workspaces(user: dict = Depends(get_current_user)):
    ensure_bootstrap(user)
    ws_ids = get_user_workspace_ids(user["id"])
    if not ws_ids:
        return []
    return supabase.table("workspaces").select("*").in_("id", ws_ids).order("created_at").execute().data


@api.post("/workspaces")
def create_workspace(body: WorkspaceCreate, user: dict = Depends(get_current_user)):
    # Owner membership is created automatically by the on_workspace_created trigger.
    ws = supabase.table("workspaces").insert({"name": body.name, "owner_id": user["id"]}).execute().data[0]
    return ws


# ----------------------------- projects -----------------------------
def _project_stats(project_id: str) -> dict:
    cnt = supabase.table("usage_events").select("id", count="exact").eq("project_id", project_id).limit(1).execute()
    latest = (
        supabase.table("usage_events")
        .select("timestamp")
        .eq("project_id", project_id)
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )
    return {
        "event_count": cnt.count or 0,
        "latest_activity": latest.data[0]["timestamp"] if latest.data else None,
    }


@api.get("/projects")
def list_projects(workspace_id: str = Query(...), user: dict = Depends(get_current_user)):
    assert_workspace_member(user["id"], workspace_id)
    projects = (
        supabase.table("projects").select("*").eq("workspace_id", workspace_id).order("created_at").execute().data
    )
    for p in projects:
        p.update(_project_stats(p["id"]))
    return projects


@api.post("/projects")
def create_project(body: ProjectCreate, user: dict = Depends(get_current_user)):
    assert_workspace_member(user["id"], body.workspace_id)
    proj = (
        supabase.table("projects")
        .insert(
            {
                "workspace_id": body.workspace_id,
                "name": body.name,
                "description": body.description,
                "environment": body.environment,
            }
        )
        .execute()
        .data[0]
    )
    proj.update({"event_count": 0, "latest_activity": None})
    return proj


@api.get("/projects/{project_id}")
def get_project(project_id: str, user: dict = Depends(get_current_user)):
    project = assert_project_access(user["id"], project_id)
    project.update(_project_stats(project_id))
    return project


# ----------------------------- api keys -----------------------------
@api.get("/projects/{project_id}/api-keys")
def list_api_keys(project_id: str, user: dict = Depends(get_current_user)):
    assert_project_access(user["id"], project_id)
    keys = (
        supabase.table("api_keys")
        .select("id,name,key_prefix,last_used_at,created_at,revoked_at")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return keys


@api.post("/projects/{project_id}/api-keys")
def create_api_key(project_id: str, body: ApiKeyCreate, user: dict = Depends(get_current_user)):
    assert_project_access(user["id"], project_id)
    full_key, prefix, key_hash = generate_api_key()
    row = (
        supabase.table("api_keys")
        .insert(
            {"project_id": project_id, "name": body.name, "key_prefix": prefix, "key_hash": key_hash}
        )
        .execute()
        .data[0]
    )
    # full key returned exactly once
    return {
        "id": row["id"],
        "name": row["name"],
        "key_prefix": row["key_prefix"],
        "created_at": row["created_at"],
        "api_key": full_key,
    }


@api.post("/api-keys/{key_id}/revoke")
def revoke_api_key(key_id: str, user: dict = Depends(get_current_user)):
    key = supabase.table("api_keys").select("*").eq("id", key_id).limit(1).execute().data
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    assert_project_access(user["id"], key[0]["project_id"])
    supabase.table("api_keys").update({"revoked_at": datetime.now(timezone.utc).isoformat()}).eq(
        "id", key_id
    ).execute()
    return {"status": "revoked", "id": key_id}


# ----------------------------- event ingestion -----------------------------
_rate_buckets: dict[str, deque] = defaultdict(deque)
RATE_LIMIT = 120  # requests
RATE_WINDOW = 60  # seconds


def _rate_limit(key_id: str):
    now = time.time()
    q = _rate_buckets[key_id]
    while q and q[0] < now - RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    q.append(now)


def _authenticate_api_key(authorization: Optional[str], x_api_key: Optional[str]) -> dict:
    token = None
    if x_api_key:
        token = x_api_key.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing API key")
    row = supabase.table("api_keys").select("*").eq("key_hash", hash_key(token)).limit(1).execute().data
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")
    key = row[0]
    if key.get("revoked_at"):
        raise HTTPException(status_code=401, detail="API key revoked")
    return key


@api.post("/v1/events")
def ingest_event(
    body: EventIn,
    authorization: Optional[str] = Header(default=None),
    x_api_key: Optional[str] = Header(default=None),
):
    key = _authenticate_api_key(authorization, x_api_key)
    _rate_limit(key["id"])
    project_id = key["project_id"]

    total_tokens = (body.input_tokens or 0) + (body.output_tokens or 0)
    estimated_cost, currency = calculate_cost(
        body.provider, body.model, body.input_tokens or 0, body.output_tokens or 0
    )

    event = {
        "project_id": project_id,
        "request_id": body.request_id,
        "timestamp": body.timestamp or datetime.now(timezone.utc).isoformat(),
        "provider": body.provider,
        "model": body.model,
        "workflow": body.workflow,
        "feature": body.feature,
        "environment": body.environment,
        "input_tokens": body.input_tokens or 0,
        "output_tokens": body.output_tokens or 0,
        "total_tokens": total_tokens,
        "latency_ms": body.latency_ms,
        "status": body.status,
        "error_type": body.error_type,
        "estimated_cost": estimated_cost,
        "cost_currency": currency,
        "metadata": body.metadata or {},
    }
    inserted = supabase.table("usage_events").insert(event).execute().data[0]

    # update last_used_at (best-effort)
    supabase.table("api_keys").update({"last_used_at": datetime.now(timezone.utc).isoformat()}).eq(
        "id", key["id"]
    ).execute()

    return {
        "status": "accepted",
        "event_id": inserted["id"],
        "estimated_cost": estimated_cost,
        "cost_currency": currency,
        "cost_status": "calculated" if estimated_cost is not None else "unknown",
    }


# ----------------------------- analytics scope -----------------------------
def _resolve_project_ids(user_id: str, workspace_id: str, project_id: Optional[str]) -> list[str]:
    assert_workspace_member(user_id, workspace_id)
    if project_id:
        assert_project_access(user_id, project_id)
        return [project_id]
    projs = supabase.table("projects").select("id").eq("workspace_id", workspace_id).execute().data
    return [p["id"] for p in projs]


def _load(user, workspace_id, project_id, range_key, start, end):
    pids = _resolve_project_ids(user["id"], workspace_id, project_id)
    s, e = an.resolve_range(range_key, start, end)
    return an.fetch_events(pids, s, e), (s, e)


@api.get("/analytics/overview")
def analytics_overview(
    workspace_id: str = Query(...),
    project_id: Optional[str] = None,
    range: Optional[str] = "7d",
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    events, _ = _load(user, workspace_id, project_id, range, start, end)
    return an.overview(events)


@api.get("/analytics/breakdown")
def analytics_breakdown(
    workspace_id: str = Query(...),
    dimension: str = Query("provider"),
    project_id: Optional[str] = None,
    range: Optional[str] = "7d",
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    if dimension not in {"provider", "model", "workflow", "feature"}:
        raise HTTPException(status_code=400, detail="Invalid dimension")
    events, _ = _load(user, workspace_id, project_id, range, start, end)
    return an.breakdown(events, dimension)


@api.get("/analytics/timeseries")
def analytics_timeseries(
    workspace_id: str = Query(...),
    project_id: Optional[str] = None,
    range: Optional[str] = "7d",
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    events, _ = _load(user, workspace_id, project_id, range, start, end)
    granularity = "hour" if range == "24h" else "day"
    return an.timeseries(events, granularity)


@api.get("/analytics/events")
def analytics_events(
    workspace_id: str = Query(...),
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    pids = _resolve_project_ids(user["id"], workspace_id, project_id)
    if not pids:
        return {"events": [], "total": 0}
    q = (
        supabase.table("usage_events")
        .select("*", count="exact")
        .in_("project_id", pids)
        .order("timestamp", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"events": q.data, "total": q.count or 0}


@api.get("/reliability/overview")
def reliability_overview(
    workspace_id: str = Query(...),
    project_id: Optional[str] = None,
    range: Optional[str] = "7d",
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    events, _ = _load(user, workspace_id, project_id, range, start, end)
    result = an.reliability(events)
    result["error_trend"] = an.timeseries(events, "hour" if range == "24h" else "day")
    return result


# ----------------------------- optimization -----------------------------
@api.get("/optimization/findings")
def optimization_findings(
    workspace_id: str = Query(...),
    project_id: Optional[str] = None,
    range: Optional[str] = "30d",
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    events, _ = _load(user, workspace_id, project_id, range, start, end)
    return opt.build_findings(events)


# ----------------------------- pricing -----------------------------
@api.get("/pricing")
def list_pricing(user: dict = Depends(get_current_user)):
    return supabase.table("model_pricing").select("*").eq("active", True).order("provider").execute().data


# ----------------------------- seed -----------------------------
@api.post("/seed/demo")
def seed_demo_data(workspace_id: str = Query(...), user: dict = Depends(get_current_user)):
    assert_workspace_member(user["id"], workspace_id)
    result = seed_demo(workspace_id)
    return {"status": "seeded", **result}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
