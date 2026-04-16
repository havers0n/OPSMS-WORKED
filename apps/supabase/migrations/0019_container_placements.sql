-- 0019_container_placements.sql

create table if not exists public.container_placements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  container_id uuid not null references public.containers(id) on delete cascade,
  cell_id uuid not null references public.cells(id) on delete restrict,
  placed_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz null,
  placed_by uuid null references public.profiles(id),
  removed_by uuid null references public.profiles(id)
);

create unique index if not exists container_placements_one_active_per_container
  on public.container_placements(container_id)
  where removed_at is null;

create index if not exists container_placements_cell_active_idx
  on public.container_placements(cell_id, placed_at desc)
  where removed_at is null;

create index if not exists container_placements_container_history_idx
  on public.container_placements(container_id, placed_at desc);

grant select, insert, update on public.container_placements to authenticated;

alter table public.container_placements enable row level security;

create or replace function public.can_access_container_placement(container_placement_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.container_placements cp
    where cp.id = container_placement_uuid
      and public.can_access_tenant(cp.tenant_id)
  )
$$;

create or replace function public.can_manage_container_placement(container_placement_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.container_placements cp
    where cp.id = container_placement_uuid
      and public.can_manage_tenant(cp.tenant_id)
  )
$$;

create or replace function public.validate_container_placement_row()
returns trigger
language plpgsql
as $$
declare
  container_tenant_uuid uuid;
  cell_tenant_uuid uuid;
  cell_layout_state text;
begin
  select c.tenant_id
  into container_tenant_uuid
  from public.containers c
  where c.id = new.container_id;

  if container_tenant_uuid is null then
    raise exception 'Container % was not found for placement.', new.container_id;
  end if;

  if container_tenant_uuid <> new.tenant_id then
    raise exception 'Placement tenant % does not match container tenant %.', new.tenant_id, container_tenant_uuid;
  end if;

  select s.tenant_id, lv.state
  into cell_tenant_uuid, cell_layout_state
  from public.cells c
  join public.layout_versions lv on lv.id = c.layout_version_id
  join public.floors f on f.id = lv.floor_id
  join public.sites s on s.id = f.site_id
  where c.id = new.cell_id;

  if cell_tenant_uuid is null then
    raise exception 'Cell % was not found for placement.', new.cell_id;
  end if;

  if cell_tenant_uuid <> new.tenant_id then
    raise exception 'Placement tenant % does not match cell tenant %.', new.tenant_id, cell_tenant_uuid;
  end if;

  if (tg_op = 'INSERT' or new.cell_id is distinct from old.cell_id) and cell_layout_state <> 'published' then
    raise exception 'Container placements are allowed only in published cells. Cell % belongs to layout state %.', new.cell_id, cell_layout_state;
  end if;

  if new.removed_at is not null and new.removed_at < new.placed_at then
    raise exception 'removed_at % cannot be earlier than placed_at %.', new.removed_at, new.placed_at;
  end if;

  return new;
end
$$;

drop trigger if exists validate_container_placement_row on public.container_placements;
create trigger validate_container_placement_row
before insert or update on public.container_placements
for each row execute function public.validate_container_placement_row();

drop policy if exists container_placements_select_scoped on public.container_placements;
create policy container_placements_select_scoped
on public.container_placements
for select
to authenticated
using (public.can_access_tenant(tenant_id));

drop policy if exists container_placements_insert_scoped on public.container_placements;
create policy container_placements_insert_scoped
on public.container_placements
for insert
to authenticated
with check (public.can_manage_tenant(tenant_id));

drop policy if exists container_placements_update_scoped on public.container_placements;
create policy container_placements_update_scoped
on public.container_placements
for update
to authenticated
using (public.can_manage_tenant(tenant_id))
with check (public.can_manage_tenant(tenant_id));
