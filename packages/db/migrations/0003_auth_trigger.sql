-- Keeps `public.users` in sync with Supabase Auth's `auth.users` without
-- racy app-code inserts. Standard Supabase `handle_new_user()` pattern:
-- https://supabase.com/docs/guides/auth/managing-user-data#using-triggers
--
-- `security definer` lets this function (owned by a privileged role) write
-- to `public.users` even though the trigger fires as part of an insert into
-- `auth.users`, a schema the authenticating client has no direct write
-- access to. `set search_path = ''` plus fully-qualified `public.users`
-- below is the documented hardening against search_path-based hijacking of
-- a `security definer` function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, auth_provider)
  values (
    new.id,
    new.email,
    case coalesce(new.raw_app_meta_data ->> 'provider', 'email')
      when 'google' then 'google'
      when 'azure' then 'microsoft' -- Supabase's Microsoft/Azure AD provider id is "azure"
      else 'email'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
