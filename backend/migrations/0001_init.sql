-- ============================================================================
-- AI Cost & Reliability Autopilot — Phase 1 schema  (0001_init.sql)
-- Production-safe. Idempotent. Run in Supabase SQL Editor.
--
-- Security model:
--   * The FastAPI backend uses the SERVICE ROLE key, which BYPASSES RLS, and
--     performs all privileged operations (event ingestion, workspace/project
--     creation) AFTER verifying the caller's Supabase JWT + membership in code.
--   * The browser only ever holds the ANON key and never queries these tables
--     directly in this app. The RLS policies below are strict defense-in-depth:
--     even with the anon key, an authenticated user can ONLY read/write data in
--     workspaces they belong to, and can NEVER insert usage_events directly
--     (ingestion is service-role only, so customer apps cannot write to the DB).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
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
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_workspaces_owner on public.workspaces(owner_id);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_members_user on public.workspace_members(user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  environment text not null default 'development',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_projects_workspace on public.projects(workspace_id);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
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
  provider text not null,
  model text not null,
  workflow text,
  feature text,
  environment text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer,
  status text not null default 'success',
  error_type text,
  estimated_cost numeric(18,8),
  cost_currency text default 'USD',
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

-- Pricing is data-driven. is_demo distinguishes illustrative placeholder
-- pricing from real, verified provider pricing entered later (is_demo=false).
create table if not exists public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  input_cost_per_1m_tokens numeric(18,6) not null,
  output_cost_per_1m_tokens numeric(18,6) not null,
  currency text not null default 'USD',
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
-- DEMO pricing ONLY (illustrative placeholders — NOT official provider pricing)
-- Model identifiers are intentionally prefixed "demo-" so they can never be
-- confused with real provider model names. Add real pricing later as separate
-- rows with is_demo=false and verified official prices.
-- ---------------------------------------------------------------------------
insert into public.model_pricing
  (provider, model, input_cost_per_1m_tokens, output_cost_per_1m_tokens, currency, is_demo, notes)
values
  ('openai',     'demo-openai-premium',      5.000, 15.000, 'USD', true, 'Illustrative demo pricing. Not official OpenAI pricing.'),
  ('openai',     'demo-openai-mini',         0.150,  0.600, 'USD', true, 'Illustrative demo pricing. Not official OpenAI pricing.'),
  ('anthropic',  'demo-anthropic-premium',  15.000, 75.000, 'USD', true, 'Illustrative demo pricing. Not official Anthropic pricing.'),
  ('anthropic',  'demo-anthropic-lite',      0.800,  4.000, 'USD', true, 'Illustrative demo pricing. Not official Anthropic pricing.'),
  ('google',     'demo-google-pro',          1.250,  5.000, 'USD', true, 'Illustrative demo pricing. Not official Google pricing.'),
  ('google',     'demo-google-flash',        0.075,  0.300, 'USD', true, 'Illustrative demo pricing. Not official Google pricing.'),
  ('openrouter', 'demo-openrouter-mixtral',  0.500,  0.500, 'USD', true, 'Illustrative demo pricing. Not official OpenRouter pricing.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Enable Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.projects           enable row level security;
alter table public.api_keys           enable row level security;
alter table public.usage_events        enable row level security;
alter table public.model_pricing      enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER) — evaluated as owner so they bypass RLS
-- internally. This prevents infinite recursion in workspace_members policies
-- and centralizes membership checks.
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
-- Grants (RLS still gates every row; grants only allow the operation to reach RLS)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated;
grant execute on function public.is_workspace_owner(uuid)  to anon, authenticated;
grant execute on function public.is_project_member(uuid)   to anon, authenticated;

grant select, insert, update, delete on public.profiles, public.workspaces,
  public.workspace_members, public.projects, public.api_keys to authenticated;
grant select on public.usage_events to authenticated;
grant select on public.model_pricing to anon, authenticated;

-- ---------------------------------------------------------------------------
-- POLICIES
-- (Re-runnable: drop-if-exists then create.)
-- ---------------------------------------------------------------------------

-- profiles: a user may only see/modify their own profile row
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workspaces: members can read; only the owner can create/update/delete
drop policy if exists workspaces_select on public.workspaces;
drop policy if exists workspaces_insert on public.workspaces;
drop policy if exists workspaces_update on public.workspaces;
drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update to authenticated using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));
create policy workspaces_delete on public.workspaces for delete to authenticated using (public.is_workspace_owner(id));

-- workspace_members: members can see their workspace's roster; owner manages it;
-- a user may always insert their own membership row (e.g. creating a workspace)
drop policy if exists members_select on public.workspace_members;
drop policy if exists members_insert on public.workspace_members;
drop policy if exists members_delete on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.is_workspace_owner(workspace_id) or user_id = auth.uid());
create policy members_delete on public.workspace_members for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- projects: any workspace member can read/create/update; only owner can delete
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_select on public.projects for select to authenticated using (public.is_workspace_member(workspace_id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy projects_update on public.projects for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy projects_delete on public.projects for delete to authenticated using (public.is_workspace_owner(workspace_id));

-- api_keys: only members of the owning project's workspace
drop policy if exists apikeys_select on public.api_keys;
drop policy if exists apikeys_insert on public.api_keys;
drop policy if exists apikeys_update on public.api_keys;
drop policy if exists apikeys_delete on public.api_keys;
create policy apikeys_select on public.api_keys for select to authenticated using (public.is_project_member(project_id));
create policy apikeys_insert on public.api_keys for insert to authenticated with check (public.is_project_member(project_id));
create policy apikeys_update on public.api_keys for update to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy apikeys_delete on public.api_keys for delete to authenticated using (public.is_project_member(project_id));

-- usage_events: members can READ their workspace's events. There is intentionally
-- NO insert/update/delete policy for anon/authenticated — ingestion happens ONLY
-- through the backend service role, so customer apps cannot write to the DB directly.
drop policy if exists events_select on public.usage_events;
create policy events_select on public.usage_events for select to authenticated using (public.is_project_member(project_id));

-- model_pricing: non-sensitive reference data, readable by any signed-in user.
-- No write policy for users — pricing is managed by the backend service role only.
drop policy if exists pricing_select on public.model_pricing;
create policy pricing_select on public.model_pricing for select to anon, authenticated using (true);

-- Done. The service_role key used by FastAPI bypasses all of the above.
