-- PR2: additive denominator support for pick-face fill read models.
-- No policy authoring, enforcement, or execution behavior is introduced here.

alter table public.sku_location_policies
  add column if not exists target_pick_qty_each integer null
    check (target_pick_qty_each is null or target_pick_qty_each > 0);
