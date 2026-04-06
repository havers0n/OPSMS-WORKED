-- Add optional floor-plane canvas coordinates to non-rack locations.
--
-- floor_x / floor_y store the world position in metres, matching the
-- canvas coordinate system used by racks and zones (1 world unit = 1 metre).
--
-- Both columns are nullable: null means the location has not yet been
-- given an explicit canvas position.  The existing validate_location_row()
-- trigger is unchanged — these columns are unconstrained for non-rack types
-- and irrelevant for rack_slot locations (which derive position from their
-- geometry_slot / published cell).

alter table public.locations
  add column if not exists floor_x numeric(12, 3) null,
  add column if not exists floor_y numeric(12, 3) null;

comment on column public.locations.floor_x is
  'Canvas world X coordinate in metres. Non-rack types only. null = unpositioned.';
comment on column public.locations.floor_y is
  'Canvas world Y coordinate in metres. Non-rack types only. null = unpositioned.';
