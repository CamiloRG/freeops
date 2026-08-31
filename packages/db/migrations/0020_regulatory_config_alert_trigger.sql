-- Hand-authored, not drizzle-kit-generated (same category as
-- 0003_auth_trigger.sql / 0014_platform_admins_rls.sql — DB-level
-- trigger/function work with no corresponding Drizzle schema object, so
-- no meta/*_snapshot.json).
--
-- This is what "forces" the Admin dashboard's regulatory-normativa alert
-- (packages/db/src/schema/compliance.ts's `regulatoryConfigAlerts` doc
-- comment) rather than leaving it to application-code discipline: an
-- `AFTER INSERT` trigger on `regulatory_config_versions` guarantees that
-- ANY insertion path — today's `packages/rules-engine/scripts/seed-config.ts`,
-- a future admin-authored insert, a one-off manual SQL insert — always
-- raises an `open` alert row, with no way to bypass it short of disabling
-- the trigger itself.
create or replace function public.fn_regulatory_config_version_alert()
returns trigger as $$
begin
  insert into public.regulatory_config_alerts
    (id, regulatory_config_version_id, country, effective_from, source_reference, status, created_at)
  values
    (gen_random_uuid(), new.id, new.country, new.effective_from, new.source_reference, 'open', now());
  return new;
end;
$$ language plpgsql;

create trigger trg_regulatory_config_version_alert
after insert on public.regulatory_config_versions
for each row execute function public.fn_regulatory_config_version_alert();
