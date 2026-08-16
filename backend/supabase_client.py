import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

# Service-role client for trusted backend operations (bypasses RLS).
# Authorization MUST be enforced in application code before every query.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Anon client used only to verify user access tokens against Supabase Auth.
supabase_anon: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ---------------------------------------------------------------------------
# Resiliency: Supabase/PostgREST occasionally closes a pooled keep-alive
# connection, which httpx raises as RemoteProtocolError ("Server disconnected").
# We transparently retry the sync PostgREST .execute() a few times so a single
# transient disconnect never surfaces to the API as a 500.
# ---------------------------------------------------------------------------
import time as _time
import httpx as _httpx
from postgrest._sync.request_builder import (
    SyncQueryRequestBuilder as _QRB,
    SyncSelectRequestBuilder as _SRB,
)

_RETRYABLE = (
    _httpx.RemoteProtocolError,
    _httpx.ConnectError,
    _httpx.ReadError,
    _httpx.ReadTimeout,
    _httpx.PoolTimeout,
)


def _wrap_execute(orig):
    def execute(self, *args, **kwargs):
        last = None
        for attempt in range(4):
            try:
                return orig(self, *args, **kwargs)
            except _RETRYABLE as e:
                last = e
                _time.sleep(0.25 * (attempt + 1))
        raise last

    return execute


for _cls in (_QRB, _SRB):
    _own = _cls.__dict__.get("execute")
    if _own is not None:
        _cls.execute = _wrap_execute(_own)
