-- 0008_cells_unique_per_face.sql

alter table public.cells
  drop constraint if exists cells_level_slot_unique;

alter table public.cells
  add constraint cells_face_level_slot_unique unique (rack_face_id, rack_level_id, slot_no);
