"""Authentication and authorization dependencies (Supabase Auth JWT)."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from supabase_client import supabase, supabase_anon

bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Invalid or missing access token"):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        _unauthorized()
    try:
        resp = supabase_anon.auth.get_user(credentials.credentials)
        user = getattr(resp, "user", None)
        if not user or not user.id:
            _unauthorized()
        return {"id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception:
        _unauthorized()


def ensure_bootstrap(user: dict) -> dict:
    """Ensure the user has a profile and at least one workspace/membership."""
    user_id = user["id"]
    # profile
    prof = supabase.table("profiles").select("*").eq("user_id", user_id).limit(1).execute()
    if not prof.data:
        supabase.table("profiles").insert(
            {"user_id": user_id, "full_name": (user.get("email") or "").split("@")[0]}
        ).execute()

    # workspace membership
    mem = (
        supabase.table("workspace_members")
        .select("workspace_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not mem.data:
        name_base = (user.get("email") or "My").split("@")[0]
        # Inserting the workspace auto-creates the owner's membership via the
        # on_workspace_created DB trigger (SECURITY DEFINER). No manual member insert.
        supabase.table("workspaces").insert(
            {"name": f"{name_base}'s Workspace", "owner_id": user_id}
        ).execute()
    return user


def get_user_workspace_ids(user_id: str) -> list[str]:
    res = (
        supabase.table("workspace_members")
        .select("workspace_id")
        .eq("user_id", user_id)
        .execute()
    )
    return [r["workspace_id"] for r in (res.data or [])]


def assert_workspace_member(user_id: str, workspace_id: str) -> None:
    res = (
        supabase.table("workspace_members")
        .select("id")
        .eq("user_id", user_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")


def assert_project_access(user_id: str, project_id: str) -> dict:
    proj = supabase.table("projects").select("*").eq("id", project_id).limit(1).execute()
    if not proj.data:
        raise HTTPException(status_code=404, detail="Project not found")
    project = proj.data[0]
    assert_workspace_member(user_id, project["workspace_id"])
    return project
