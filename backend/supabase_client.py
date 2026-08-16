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
