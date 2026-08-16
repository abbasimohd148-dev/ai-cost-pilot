# AI Cost & Reliability Autopilot — PRD

## Original Problem Statement
Phase 1 of a serious B2B developer SaaS: "AI Cost & Reliability Autopilot". Build the data
foundation for actionable AI cost intelligence — event ingestion, deterministic cost
calculation from a data-driven pricing table, cost + reliability analytics, projects, and
secure API-key management. NOT a router/gateway/wrapper/observability clone/chatbot.
Optimization engine is architecture-only in Phase 1 (no fake findings).

## Architecture
- **Frontend**: React (CRA) + Tailwind + shadcn/ui + Recharts. Supabase JS (anon key) for auth only.
- **Backend**: FastAPI (all routes under `/api`). Uses Supabase service-role key; enforces
  workspace/project membership in code. Ingestion authenticated by hashed project API keys.
- **DB**: Supabase PostgreSQL (single source of truth). 7 tables with full RLS + recursion-safe
  SECURITY DEFINER helpers + owner-membership trigger. Migration: `/app/backend/migrations/0001_init.sql`.
- **Auth**: Supabase Auth (email + password). Frontend never holds the service-role key.
- Key modules: `pricing.py` (deterministic cost engine, ignores demo pricing in production),
  `analytics.py` (overview/breakdown/timeseries/reliability), `seed.py` (demo data generator),
  `deps.py` (JWT verify + authz), `security.py` (API key gen/hash), `supabase_client.py`
  (service/anon clients + transient-disconnect retry wrapper).

## User Personas
- **Engineering/Platform lead**: wants to see where AI spend goes and catch reliability issues.
- **Workspace owner/admin**: manages projects, API keys, and (future) team membership.

## Core Requirements (static)
1. Supabase Auth signup/login/logout, protected dashboard, profile.
2. Multi-tenant workspaces with strict isolation (RLS + backend authz).
3. Projects with environments; secure API keys (reveal-once, hashed storage, revoke).
4. Event ingestion API (`POST /api/v1/events`) authenticated by project API key.
5. Deterministic cost engine from `model_pricing` (never invents cost; NULL if no pricing).
6. Analytics: spend/requests/tokens/latency/success/error + breakdown by provider/model/
   workflow/feature + time series; date filters (24h/7d/30d/custom).
7. Reliability: success/error rate, timeouts, rate-limit/server errors, p50/p95/p99 latency,
   failures by dimension, error trends.
8. Manual demo-data seeding (button); no auto-seed for real users.
9. Optimization page = placeholder only (no fake findings).
10. No hardcoded secrets; GitHub-ready structure.

## Implemented (2026-06)
- [x] Full Supabase schema + hardened RLS migration (idempotent, production-safe).
- [x] Supabase Auth (email+password) with signup/login/logout, protected routes, profile.
- [x] Workspace auto-created with owner membership via DB trigger; strict cross-workspace isolation (403s verified).
- [x] Projects CRUD (list/create/detail with event count & latest activity).
- [x] API keys: create (reveal-once + copy + warning), list (prefix only, never key_hash), revoke, last-used.
- [x] Event ingestion with API-key auth, payload validation, rate limiting, deterministic cost calc.
- [x] Cost engine reads `model_pricing`; production ignores `is_demo=true`; seeder uses demo pricing.
- [x] Analytics + reliability endpoints computing real data with date filtering.
- [x] Dashboard, Costs, Reliability, Usage (paginated), Projects, Project Detail, Optimization (placeholder), Settings (profile + workspace + pricing table).
- [x] Manual "Seed Demo Data" (idempotent) generating ~2000 events with intentional patterns.
- [x] Backend retry wrapper for transient Supabase disconnects; frontend error toasts.
- [x] End-to-end verified (backend curls + testing agent iteration_2: 100% of scenarios pass).

## Backlog / Future (not in Phase 1)
- P1: Optimization engine (premium-model overuse, retries, token growth, anomalies, savings + confidence/evidence).
- P1: Team invitations & role management UI (schema already supports members/roles).
- P2: Real (is_demo=false) provider pricing ingestion & effective-dating UI.
- P2: Alerts, integrations, experiments, subscriptions/billing (Stripe) — deferred per spec.
- P2: Per-project Costs/Reliability tabs, CSV export, saved views.

## Test Accounts
See `/app/memory/test_credentials.md` (founder@autopilot.test / Test1234!).

## Notes
- User must keep Supabase "Email provider" ENABLED (email confirmation OFF for dev).
- Migration must be run manually in Supabase SQL Editor (user does not share DB password).
