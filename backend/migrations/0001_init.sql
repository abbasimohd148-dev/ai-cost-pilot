-- ============================================================================
-- AI Cost & Reliability Autopilot — FINAL Phase 1 database foundation
-- File: 0001_init.sql   |  Target: Supabase PostgreSQL  |  Auth: Supabase Auth
--
-- Run once in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotent & repeatable. No data is destroyed.
--
-- SECURITY MODEL
--   * Backend (FastAPI) uses the SERVICE ROLE key -> bypasses RLS. It performs
--     ingestion & privileged writes only AFTER verifying the caller's Supabase
--     JWT + workspace/project membership in application code.
--   * Browser holds only the ANON key. Even so, the RLS policies below enforce
--     strict multi-tenant isolation:
--       - a user only sees/mutates data in workspaces they are a MEMBER of;
--       - a user can NEVER add themselves to a workspace (owner-managed only);
--       - authenticated users can NEVER insert/update/delete usage_events
--         (ingestion is service-role only -> customer apps cannot write directly);
--       - key_hash is never selectable by anon/authenticated (column-level grant).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. TABLES (with validation constraints)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_workspaces_owner on public.workspaces(owner_id);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_members_user on public.workspace_members(user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  environment text not null default 'development'
    check (environment in ('development', 'staging', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_workspace on public.projects(workspace_id);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  key_prefix text not null,
  key_hash text not null unique,           -- SHA-256 of the raw key; raw key never stored
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_apikeys_project on public.api_keys(project_id);
create index if not exists idx_apikeys_hash on public.api_keys(key_hash);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  request_id text,
  timestamp timestamptz not null default now(),
  provider text not null check (char_length(trim(provider)) > 0),
  model text not null check (char_length(trim(model)) > 0),
  workflow text,
  feature text,
  environment text check (environment is null or environment in ('development', 'staging', 'production')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  status text not null default 'success'
    check (status in ('success', 'error', 'timeout', 'rate_limited')),
  error_type text,
  estimated_cost numeric(18,8) check (estimated_cost is null or estimated_cost >= 0),
  cost_currency text check (cost_currency is null or cost_currency ~ '^[A-Z]{3}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_project on public.usage_events(project_id);
create index if not exists idx_events_timestamp on public.usage_events("timestamp");
create index if not exists idx_events_provider on public.usage_events(provider);
create index if not exists idx_events_model on public.usage_events(model);
create index if not exists idx_events_workflow on public.usage_events(workflow);
create index if not exists idx_events_feature on public.usage_events(feature);
create index if not exists idx_events_status on public.usage_events(status);
create index if not exists idx_events_project_ts on public.usage_events(project_id, "timestamp");

-- Data-driven pricing. is_demo separates illustrative placeholders from real,
-- verified provider pricing (added later as is_demo=false). The production cost
-- engine ignores is_demo=true unless explicitly running in demo mode.
create table if not exists public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(trim(provider)) > 0),
  model text not null check (char_length(trim(model)) > 0),
  input_cost_per_1m_tokens numeric(18,6) not null check (input_cost_per_1m_tokens >= 0),
  output_cost_per_1m_tokens numeric(18,6) not null check (output_cost_per_1m_tokens >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  is_demo boolean not null default false,
  notes text,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_pricing_provider_model on public.model_pricing(provider, model);
create unique index if not exists uq_pricing_active on public.model_pricing(provider, model) where active;

-- ---------------------------------------------------------------------------
-- 2. DEMO pricing ONLY (illustrative — NOT official provider pricing)
-- Real pricing is added later as separate rows with is_demo = false.
-- ---------------------------------------------------------------------------
insert into public.model_pricing
  (provider, model, input_cost_per_1m_tokens, output_cost_per_1m_tokens, currency, is_demo, notes)
values
  ('openai',     'demo-openai-premium',      5.000, 15.000, 'USD', true, 'Illustrative demo pricing. NOT official OpenAI pricing.'),
  ('openai',     'demo-openai-mini',         0.150,  0.600, 'USD', true, 'Illustrative demo pricing. NOT official OpenAI pricing.'),
  ('anthropic',  'demo-anthropic-premium',  15.000, 75.000, 'USD', true, 'Illustrative demo pricing. NOT official Anthropic pricing.'),
  ('anthropic',  'demo-anthropic-lite',      0.800,  4.000, 'USD', true, 'Illustrative demo pricing. NOT official Anthropic pricing.'),
  ('google',     'demo-google-pro',          1.250,  5.000, 'USD', true, 'Illustrative demo pricing. NOT official Google pricing.'),
  ('google',     'demo-google-flash',        0.075,  0.300, 'USD', true, 'Illustrative demo pricing. NOT official Google pricing.'),
  ('openrouter', 'demo-openrouter-mixtral',  0.500,  0.500, 'USD', true, 'Illustrative demo pricing. NOT official OpenRouter pricing.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY (all application tables)
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.projects           enable row level security;
alter table public.api_keys           enable row level security;
alter table public.usage_events        enable row level security;
alter table public.model_pricing      enable row level security;

-- ---------------------------------------------------------------------------
-- 4. RECURSION-SAFE MEMBERSHIP HELPERS (SECURITY DEFINER)
-- These run as the function owner and therefore bypass RLS internally,
-- so policies that call them never recurse into the same table's policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.projects p
    join public.workspace_members m on m.workspace_id = p.workspace_id
    where p.id = pid and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. AUTO-CREATE OWNER MEMBERSHIP ON WORKSPACE INSERT
-- Uses NEW.owner_id (works for both service-role and direct inserts; does not
-- rely on auth.uid()). SECURITY DEFINER so it bypasses RLS -> no recursion,
-- and the owner never needs to insert their own membership manually.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (NEW.id, NEW.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- ---------------------------------------------------------------------------
-- 6. GRANTS  (RLS still gates every row; grants only let an op reach RLS)
-- We REVOKE the defaults first, then grant the minimum needed. Note the
-- COLUMN-LEVEL grant on api_keys which deliberately EXCLUDES key_hash.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid)  to authenticated;
grant execute on function public.is_project_member(uuid)   to authenticated;

revoke all on public.profiles         from anon, authenticated;
revoke all on public.workspaces        from anon, authenticated;
revoke all on public.workspace_members from anon, authenticated;
revoke all on public.projects          from anon, authenticated;
revoke all on public.api_keys          from anon, authenticated;
revoke all on public.usage_events       from anon, authenticated;
revoke all on public.model_pricing     from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
-- api_keys: SELECT only, and only SAFE columns (key_hash is NOT granted)
grant select (id, project_id, name, key_prefix, last_used_at, created_at, revoked_at)
  on public.api_keys to authenticated;
-- usage_events: read-only for users (no insert/update/delete grant at all)
grant select on public.usage_events to authenticated;
-- model_pricing: read-only reference data
grant select on public.model_pricing to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. POLICIES  (re-runnable: drop-if-exists then create)
-- ---------------------------------------------------------------------------

-- profiles: a user may only see/create/update THEIR OWN row
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workspaces: members read; only the owner creates/updates/deletes
drop policy if exists workspaces_select on public.workspaces;
drop policy if exists workspaces_insert on public.workspaces;
drop policy if exists workspaces_update on public.workspaces;
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.is_workspace_owner(id));

-- workspace_members:
--   SELECT: your own membership rows, or the roster of workspaces you belong to
--   INSERT: ONLY the workspace owner may add members (NO self-join by UUID)
--   DELETE: ONLY the owner, and the owner's own membership can never be removed
--   UPDATE: not permitted in Phase 1 (no grant, no policy) — protects the owner
--           membership row's user_id/role from modification.
drop policy if exists members_select on public.workspace_members;
drop policy if exists members_insert on public.workspace_members;
drop policy if exists members_update on public.workspace_members;
drop policy if exists members_delete on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));
create policy members_delete on public.workspace_members for delete to authenticated
  using (
    public.is_workspace_owner(workspace_id)
    and user_id <> (select w.owner_id from public.workspaces w where w.id = workspace_id)
  );

-- projects: any workspace member reads/creates/updates; only owner deletes
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy projects_update on public.projects for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- api_keys: only members of the owning project's workspace may READ (safe cols
-- only, enforced by the column grant). Creation/rotation/revocation is performed
-- by the backend service role; no authenticated INSERT/UPDATE/DELETE policy.
drop policy if exists apikeys_select on public.api_keys;
create policy apikeys_select on public.api_keys for select to authenticated
  using (public.is_project_member(project_id));

-- usage_events: members may READ their workspace's events only. There is
-- intentionally NO insert/update/delete policy for authenticated users —
-- ingestion happens ONLY via the backend service role.
drop policy if exists events_select on public.usage_events;
create policy events_select on public.usage_events for select to authenticated
  using (public.is_project_member(project_id));

-- model_pricing: non-sensitive reference data, readable by any signed-in user
-- (and anon). No write policy for users — pricing is managed by the service role.
drop policy if exists pricing_select on public.model_pricing;
create policy pricing_select on public.model_pricing for select to anon, authenticated
  using (true);

-- ============================================================================
-- END. The service_role key used by FastAPI bypasses every policy above and is
-- the ONLY path that can insert usage_events or read key_hash.
-- ============================================================================
