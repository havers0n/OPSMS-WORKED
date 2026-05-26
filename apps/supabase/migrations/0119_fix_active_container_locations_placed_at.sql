-- 0118_fix_active_container_locations_placed_at.sql
--
-- Migration 0079 added system_code to active_container_locations_v by copying
-- the view definition from 0040, but accidentally dropped the COALESCE that
-- guarded placed_at against NULL. Containers placed before
-- current_location_entered_at existed have that column NULL, so the view now
-- returns NULL for placed_at, which fails the z.string() validation in the BFF.
--
-- Fix: restore COALESCE(c.current_location_entered_at, c.created_at).
-- created_at has a NOT NULL default so the fallback is always safe.

create or replace view public.active_container_locations_v as
select
  c.tenant_id,
  l.floor_id,
  l.id                                                   as location_id,
  l.code                                                 as location_code,
  l.location_type,
  l.capacity_mode,
  l.status                                               as location_status,
  l.geometry_slot_id                                     as cell_id,
  c.id                                                   as container_id,
  c.external_code,
  ct.code                                                as container_type,
  c.status                                               as container_status,
  coalesce(c.current_location_entered_at, c.created_at) as placed_at,
  c.system_code
from public.containers c
join public.locations l
  on l.id = c.current_location_id
join public.container_types ct
  on ct.id = c.container_type_id
where c.current_location_id is not null;
