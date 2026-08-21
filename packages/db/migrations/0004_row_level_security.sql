-- Row-Level Security — app_spec.md § "Security & Compliance" →
-- "Authentication & Authorization": a second, database-enforced tenant-
-- isolation layer on every table holding freelancer-owned data, alongside
-- (never instead of) app-layer scoping by the verified session's
-- `auth.uid()`. FreeOps is single-user-per-account (no cross-user RBAC) —
-- the only question RLS has to answer per table is "does this row belong
-- to the requesting user", so every policy below reduces to that.
--
-- Pattern:
--   * Tables with a direct `user_id` column get one `for all` policy:
--     `auth.uid() = user_id` for both `using` (select/update/delete) and
--     `with check` (insert/update).
--   * Tables owned transitively (reachable only via a FK chain back to a
--     `user_id`-bearing parent, e.g. kanban tasks -> board -> project)
--     get an `exists` subquery walking that chain instead.
--   * `regulatory_config_versions` is the one genuine exception: it's
--     shared reference config (PILA/DIAN parameters), not freelancer-owned
--     data. RLS is still enabled on it (per spec: "every table"), but with
--     a read-only policy — every authenticated user may `select`, no one
--     but a service-role/administrative connection (which bypasses RLS
--     entirely, per Supabase's `BYPASSRLS` on `service_role`) may write.
--
-- `to authenticated` scopes every policy to Supabase's `authenticated`
-- Postgres role (i.e. a request carrying a valid user JWT) — the `anon`
-- role gets no policies here and therefore no access, by default-deny.
--
-- NOTE for later phases: `auth.uid()` only resolves inside a Postgres
-- session that Supabase's JWT-aware connection path (PostgREST / the
-- Supabase client libraries) has set up. The app's own Drizzle runtime
-- client (`packages/db/src/client.ts`, `DATABASE_URL`) connects as a
-- single fixed Postgres role and does not currently forward per-request
-- user JWTs into the session, so these policies are not yet "live" against
-- Drizzle-issued queries — they're proven here directly against Postgres
-- and via the Supabase client (see Phase 3 verification). Wiring
-- request-scoped RLS into the Drizzle runtime path (or moving user-scoped
-- reads/writes through supabase-js) is a follow-up once product modules
-- actually issue queries.

-- ---------------------------------------------------------------------
-- identity
-- ---------------------------------------------------------------------
alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select
  to authenticated
  using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policy: rows are created only by the
-- `handle_new_user()` trigger (security definer, runs as the function
-- owner and so bypasses RLS) and are never deleted directly by app code —
-- account deletion is a privileged, out-of-band flow.

-- ---------------------------------------------------------------------
-- profile
-- ---------------------------------------------------------------------
alter table public.freelancer_profiles enable row level security;
create policy "freelancer_profiles_owner_access" on public.freelancer_profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.banking_details enable row level security;
create policy "banking_details_owner_access" on public.banking_details
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.tax_info enable row level security;
create policy "tax_info_owner_access" on public.tax_info
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.tax_info_documents enable row level security;
create policy "tax_info_documents_owner_access" on public.tax_info_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.tax_info ti
      where ti.id = tax_info_documents.tax_info_id
        and ti.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tax_info ti
      where ti.id = tax_info_documents.tax_info_id
        and ti.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- branding (branding + resume/CV)
-- ---------------------------------------------------------------------
alter table public.branding_assets enable row level security;
create policy "branding_assets_owner_access" on public.branding_assets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.resumes enable row level security;
create policy "resumes_owner_access" on public.resumes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.resume_entries enable row level security;
create policy "resume_entries_owner_access" on public.resume_entries
  for all to authenticated
  using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_entries.resume_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_entries.resume_id
        and r.user_id = auth.uid()
    )
  );

alter table public.resume_skills enable row level security;
create policy "resume_skills_owner_access" on public.resume_skills
  for all to authenticated
  using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_skills.resume_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_skills.resume_id
        and r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- scheduling
-- ---------------------------------------------------------------------
alter table public.calendar_connections enable row level security;
create policy "calendar_connections_owner_access" on public.calendar_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.booking_links enable row level security;
create policy "booking_links_owner_access" on public.booking_links
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- `bookings` carries a denormalized `user_id` directly (see scheduling.ts)
-- so the owner-freelancer's authenticated access uses it directly. The
-- *public* booking page (unauthenticated prospects submitting a booking)
-- is intentionally NOT served by this policy — per spec it must stay a
-- server-side-only surface (proxied through FreeOps's own privileged API,
-- never a direct anon-role client query), so `anon` deliberately has no
-- policy/access here at all.
alter table public.bookings enable row level security;
create policy "bookings_owner_access" on public.bookings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- business (projects, contracts, kanban)
-- ---------------------------------------------------------------------
alter table public.projects enable row level security;
create policy "projects_owner_access" on public.projects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.contract_documents enable row level security;
create policy "contract_documents_owner_access" on public.contract_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = contract_documents.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = contract_documents.project_id
        and p.user_id = auth.uid()
    )
  );

alter table public.kanban_boards enable row level security;
create policy "kanban_boards_owner_access" on public.kanban_boards
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = kanban_boards.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = kanban_boards.project_id
        and p.user_id = auth.uid()
    )
  );

alter table public.kanban_columns enable row level security;
create policy "kanban_columns_owner_access" on public.kanban_columns
  for all to authenticated
  using (
    exists (
      select 1 from public.kanban_boards b
      join public.projects p on p.id = b.project_id
      where b.id = kanban_columns.board_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.kanban_boards b
      join public.projects p on p.id = b.project_id
      where b.id = kanban_columns.board_id
        and p.user_id = auth.uid()
    )
  );

-- `kanban_tasks` also carries a denormalized `board_id` (see business.ts),
-- so ownership is checked through that directly rather than via
-- `column_id` -> `kanban_columns.board_id` -> ... (same result, one join
-- shorter).
alter table public.kanban_tasks enable row level security;
create policy "kanban_tasks_owner_access" on public.kanban_tasks
  for all to authenticated
  using (
    exists (
      select 1 from public.kanban_boards b
      join public.projects p on p.id = b.project_id
      where b.id = kanban_tasks.board_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.kanban_boards b
      join public.projects p on p.id = b.project_id
      where b.id = kanban_tasks.board_id
        and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- crm
-- ---------------------------------------------------------------------
alter table public.crm_pipeline_stages enable row level security;
create policy "crm_pipeline_stages_owner_access" on public.crm_pipeline_stages
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.crm_opportunities enable row level security;
create policy "crm_opportunities_owner_access" on public.crm_opportunities
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- finance
-- ---------------------------------------------------------------------
alter table public.cuentas_de_cobro enable row level security;
create policy "cuentas_de_cobro_owner_access" on public.cuentas_de_cobro
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.invoices enable row level security;
create policy "invoices_owner_access" on public.invoices
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.payments enable row level security;
create policy "payments_owner_access" on public.payments
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.payment_reminders enable row level security;
create policy "payment_reminders_owner_access" on public.payment_reminders
  for all to authenticated
  using (
    exists (
      select 1 from public.payments pay
      where pay.id = payment_reminders.payment_id
        and pay.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.payments pay
      where pay.id = payment_reminders.payment_id
        and pay.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- compliance
-- ---------------------------------------------------------------------
alter table public.withholding_certificates enable row level security;
create policy "withholding_certificates_owner_access" on public.withholding_certificates
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared reference config (PILA/DIAN parameters), not freelancer-owned —
-- read-only for any authenticated user, no client-facing write path.
alter table public.regulatory_config_versions enable row level security;
create policy "regulatory_config_versions_read" on public.regulatory_config_versions
  for select
  to authenticated
  using (true);

alter table public.pila_records enable row level security;
create policy "pila_records_owner_access" on public.pila_records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.tax_vault_packages enable row level security;
create policy "tax_vault_packages_owner_access" on public.tax_vault_packages
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.tax_vault_documents enable row level security;
create policy "tax_vault_documents_owner_access" on public.tax_vault_documents
  for all to authenticated
  using (
    exists (
      select 1 from public.tax_vault_packages tvp
      where tvp.id = tax_vault_documents.package_id
        and tvp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tax_vault_packages tvp
      where tvp.id = tax_vault_documents.package_id
        and tvp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- billing
-- ---------------------------------------------------------------------
alter table public.app_subscriptions enable row level security;
create policy "app_subscriptions_owner_access" on public.app_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.app_subscription_invoices enable row level security;
create policy "app_subscription_invoices_owner_access" on public.app_subscription_invoices
  for all to authenticated
  using (
    exists (
      select 1 from public.app_subscriptions s
      where s.id = app_subscription_invoices.subscription_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.app_subscriptions s
      where s.id = app_subscription_invoices.subscription_id
        and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- audit
-- ---------------------------------------------------------------------
alter table public.deletion_warnings enable row level security;
create policy "deletion_warnings_owner_access" on public.deletion_warnings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
