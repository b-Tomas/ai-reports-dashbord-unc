-- Bootstrap the first admin (SPEC §3.5 / §6).
--
-- `ensure_super_admin(email)` is idempotent: it seeds ONE email/admin row only
-- if the table has no admin yet. It is the single seeding mechanism — the
-- runtime app (later block) reads SUPER_ADMIN_EMAIL from the environment and
-- calls this same function on boot.

create or replace function public.ensure_super_admin(p_email text)
returns void
language plpgsql
as $$
begin
  -- No email provided → nothing to do.
  if p_email is null or btrim(p_email) = '' then
    return;
  end if;

  -- An admin already exists → leave the allowlist alone.
  if exists (select 1 from public.dashboard_access where role = 'admin') then
    return;
  end if;

  -- Seed (or promote an existing viewer entry to) the super admin.
  insert into public.dashboard_access (type, value, role)
  values ('email', lower(btrim(p_email)), 'admin')
  on conflict (type, value) do update set role = 'admin';
end;
$$;

-- Auto-seed at apply time IF the database setting `app.super_admin_email` is
-- present. It is a no-op when unset (current_setting(..., true) returns NULL),
-- so this migration is safe to apply without it. See supabase/README.md for the
-- recommended manual seeding call.
select public.ensure_super_admin(current_setting('app.super_admin_email', true));
