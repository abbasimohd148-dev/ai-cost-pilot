"""API tests for /api/optimization/findings + workspace isolation."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ai-cost-pilot.preview.emergentagent.com").rstrip("/")
SUPABASE_URL = "https://wskobzcngdykubrbcgww.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indza29iemNuZ2R5a3VicmJjZ3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4ODgzNjksImV4cCI6MjEwMjQ2NDM2OX0.YuhS0zLY9lPf47XafqEGFM62zYtZ2_Ev6YaFo8bOJgU"

FOUNDER = ("founder@autopilot.test", "Test1234!")
INTRUDER = ("intruder@autopilot.test", "Test1234!")


def _login(email, password):
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def founder_token():
    return _login(*FOUNDER)


@pytest.fixture(scope="module")
def intruder_token():
    return _login(*INTRUDER)


@pytest.fixture(scope="module")
def founder_workspace(founder_token):
    r = requests.get(
        f"{BASE_URL}/api/workspaces",
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    workspaces = r.json()
    assert len(workspaces) > 0
    return workspaces[0]["id"]


def test_optimization_findings_shape_and_empty(founder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/optimization/findings",
        params={"workspace_id": founder_workspace, "range": "30d"},
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    # stable shape
    for k in ["findings", "finding_count", "potential_savings", "currency", "has_production_pricing"]:
        assert k in d, f"missing key {k} in {d}"
    assert isinstance(d["findings"], list)
    # seeded workspace: only demo pricing
    assert d["finding_count"] == 0
    assert d["potential_savings"] == 0
    assert d["has_production_pricing"] is False
    assert d["findings"] == []


def test_optimization_findings_requires_auth():
    r = requests.get(
        f"{BASE_URL}/api/optimization/findings",
        params={"workspace_id": "00000000-0000-0000-0000-000000000000"},
        timeout=15,
    )
    assert r.status_code in (401, 403), r.text


def test_optimization_workspace_isolation_403(intruder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/optimization/findings",
        params={"workspace_id": founder_workspace, "range": "30d"},
        headers={"Authorization": f"Bearer {intruder_token}"},
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403 cross-workspace but got {r.status_code}: {r.text}"


def test_analytics_regression_overview(founder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/analytics/overview",
        params={"workspace_id": founder_workspace, "range": "30d"},
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text


def test_analytics_regression_breakdown(founder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/analytics/breakdown",
        params={"workspace_id": founder_workspace, "range": "30d"},
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text


def test_analytics_regression_timeseries(founder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/analytics/timeseries",
        params={"workspace_id": founder_workspace, "range": "30d"},
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text


def test_reliability_regression(founder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/reliability/overview",
        params={"workspace_id": founder_workspace, "range": "30d"},
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text


def test_projects_regression(founder_token, founder_workspace):
    r = requests.get(
        f"{BASE_URL}/api/projects",
        params={"workspace_id": founder_workspace},
        headers={"Authorization": f"Bearer {founder_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
