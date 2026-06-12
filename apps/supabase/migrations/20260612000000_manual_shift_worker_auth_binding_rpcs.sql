-- Security-definer RPCs for manual_shift_worker account binding.
-- These bypass profiles / tenant_members RLS so that tenant_admin
-- operators can list tenant users and manage worker auth bindings
-- without relaxing the existing least-privilege row-level policies.

-- ============================================================
-- 1. list_manual_shift_bindable_users
--    Returns tenant users with optional bound worker id.
--    Caller must be platform_admin or tenant_admin of the tenant.
-- ============================================================

create or replace function public.list_manual_shift_bindable_users(p_tenant_id uuid)
returns table(
  user_id         uuid,
  display_name    text,
  email           text,
  bound_worker_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.can_manage_tenant(p_tenant_id) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    p.id                                                as user_id,
    p.display_name,
    p.email,
    msw.id                                              as bound_worker_id
  from public.profiles p
  inner join public.tenant_members tm
    on tm.profile_id = p.id
   and tm.tenant_id  = p_tenant_id
  left join public.manual_shift_workers msw
    on msw.auth_user_id = p.id
   and msw.tenant_id    = p_tenant_id
  order by p.display_name asc nulls last, p.email asc nulls last;
end;
$$;

-- ============================================================
-- 2. set_manual_shift_worker_auth_user
--    Binds or clears the auth user account linked to a worker.
--    Caller must be platform_admin or tenant_admin of the worker tenant.
-- ============================================================

create or replace function public.set_manual_shift_worker_auth_user(
  p_worker_id     uuid,
  p_auth_user_id  uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_worker_tenant_id  uuid;
begin
  -- lock worker and verify ownership
  select msw.tenant_id
  into   v_worker_tenant_id
  from   public.manual_shift_workers msw
  where  msw.id = p_worker_id
  for update;

  if v_worker_tenant_id is null then
    raise exception 'WORKER_NOT_FOUND';
  end if;

  if not public.can_manage_tenant(v_worker_tenant_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_auth_user_id is not null then
    -- profile must belong to the same tenant
    if not exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id  = v_worker_tenant_id
        and tm.profile_id = p_auth_user_id
    ) then
      raise exception 'WORKER_AUTH_USER_FORBIDDEN';
    end if;

    -- account must not already be bound to another worker in this tenant
    if exists (
      select 1
      from public.manual_shift_workers msw
      where msw.tenant_id    = v_worker_tenant_id
        and msw.auth_user_id = p_auth_user_id
        and msw.id          != p_worker_id
    ) then
      raise exception 'WORKER_AUTH_USER_ALREADY_BOUND';
    end if;
  end if;

  update public.manual_shift_workers
  set    auth_user_id = p_auth_user_id
  where  id = p_worker_id;
end;
$$;

-- ============================================================
-- Grants
-- ============================================================

revoke execute on function public.list_manual_shift_bindable_users(uuid) from public, anon;
grant  execute on function public.list_manual_shift_bindable_users(uuid) to authenticated;

revoke execute on function public.set_manual_shift_worker_auth_user(uuid, uuid) from public, anon;
grant  execute on function public.set_manual_shift_worker_auth_user(uuid, uuid) to authenticated;
