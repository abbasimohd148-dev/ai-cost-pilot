-- AI Cost & Reliability Autopilot — Phase 1 schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible.

create extension if not exists "pgcrypto";

-- =========================================================
-- profiles
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- workspaces
-- =========================================================
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_workspaces_owner on public.workspaces(owner_id);

-- =========================================================
-- workspace_members
-- =========================================================
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

-- =========================================================
-- projects
-- =========================================================
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

-- =========================================================
-- api_keys  (never store raw keys; only prefix + hash)
-- =========================================================
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

-- =========================================================
-- usage_events  (most important table)
-- =========================================================
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

-- =========================================================
-- model_pricing  (data-driven pricing, never hardcoded in logic)
-- =========================================================
create table if not exists public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  input_cost_per_1m_tokens numeric(18,6) not null,
  output_cost_per_1m_tokens numeric(18,6) not null,
  currency text not null default 'USD',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_pricing_provider_model on public.model_pricing(provider, model);
create unique index if not exists uq_pricing_active on public.model_pricing(provider, model) where active;

-- Seed realistic placeholder pricing (per 1M tokens, USD). Idempotent.
insert into public.model_pricing (provider, model, input_cost_per_1m_tokens, output_cost_per_1m_tokens, currency)
values
  ('openai',    'gpt-omni-premium',   5.00,  15.00, 'USD'),
  ('openai',    'gpt-omni-mini',      0.15,   0.60, 'USD'),
  ('anthropic', 'claude-opus-premium',15.00, 75.00, 'USD'),
  ('anthropic', 'claude-sonnet',       3.00, 15.00, 'USD'),
  ('anthropic', 'claude-haiku',        0.80,  4.00, 'USD'),
  ('google',    'gemini-pro',          1.25,  5.00, 'USD'),
  ('google',    'gemini-flash',        0.075, 0.30, 'USD'),
  ('openrouter','mixtral-8x7b',        0.50,  0.50, 'USD')
on conflict do nothing;

-- =========================================================
-- Row Level Security
-- Frontend never touches these tables directly (all access is via the
-- FastAPI backend using the service_role key, which bypasses RLS).
-- We enable RLS with NO policies for anon/authenticated so that the
-- publishable anon key cannot read/write application data directly.
-- =========================================================
alter table public.profiles          enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.projects           enable row level security;
alter table public.api_keys           enable row level security;
alter table public.usage_events        enable row level security;
alter table public.model_pricing      enable row level security;
