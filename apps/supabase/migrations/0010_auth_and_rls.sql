-- 0010_auth_and_rls.sql

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), 'operator')
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_auth_user_profile();

insert into public.profiles (id, email, display_name)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'display_name', split_part(coalesce(au.email, ''), '@', 1), 'operator')
from auth.users au
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    updated_at = timezone('utc', now());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.sites to authenticated;
grant select, insert, update, delete on public.floors to authenticated;
grant select, insert, update, delete on public.layout_versions to authenticated;
grant select, insert, update, delete on public.racks to authenticated;
grant select, insert, update, delete on public.rack_faces to authenticated;
grant select, insert, update, delete on public.rack_sections to authenticated;
grant select, insert, update, delete on public.rack_levels to authenticated;
grant select, insert, update, delete on public.cells to authenticated;
grant select, insert on public.operation_events to authenticated;
grant select, update on public.profiles to authenticated;

grant execute on function public.create_layout_draft(uuid, uuid) to authenticated;
grant execute on function public.save_layout_draft(jsonb, uuid) to authenticated;
grant execute on function public.publish_layout_version(uuid, uuid) to authenticated;
grant execute on function public.validate_layout_version(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.floors enable row level security;
alter table public.layout_versions enable row level security;
alter table public.racks enable row level security;
alter table public.rack_faces enable row level security;
alter table public.rack_sections enable row level security;
alter table public.rack_levels enable row level security;
alter table public.cells enable row level security;
alter table public.operation_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists sites_authenticated_all on public.sites;
create policy sites_authenticated_all
on public.sites
for all
to authenticated
using (true)
with check (true);

drop policy if exists floors_authenticated_all on public.floors;
create policy floors_authenticated_all
on public.floors
for all
to authenticated
using (true)
with check (true);

drop policy if exists layout_versions_authenticated_all on public.layout_versions;
create policy layout_versions_authenticated_all
on public.layout_versions
for all
to authenticated
using (true)
with check (true);

drop policy if exists racks_authenticated_all on public.racks;
create policy racks_authenticated_all
on public.racks
for all
to authenticated
using (true)
with check (true);

drop policy if exists rack_faces_authenticated_all on public.rack_faces;
create policy rack_faces_authenticated_all
on public.rack_faces
for all
to authenticated
using (true)
with check (true);

drop policy if exists rack_sections_authenticated_all on public.rack_sections;
create policy rack_sections_authenticated_all
on public.rack_sections
for all
to authenticated
using (true)
with check (true);

drop policy if exists rack_levels_authenticated_all on public.rack_levels;
create policy rack_levels_authenticated_all
on public.rack_levels
for all
to authenticated
using (true)
with check (true);

drop policy if exists cells_authenticated_all on public.cells;
create policy cells_authenticated_all
on public.cells
for all
to authenticated
using (true)
with check (true);

drop policy if exists operation_events_authenticated_read on public.operation_events;
create policy operation_events_authenticated_read
on public.operation_events
for select
to authenticated
using (true);

drop policy if exists operation_events_authenticated_insert on public.operation_events;
create policy operation_events_authenticated_insert
on public.operation_events
for insert
to authenticated
with check (true);
