-- Description: PR D — add canonical route/work-bucket columns to manual_shift_orders.
-- Columns: raw_route_line, route_base, work_bucket_name, work_bucket_type.
-- Conservative backfill: only rows backed by order items (monthly import rows).

ALTER TABLE public.manual_shift_orders
  ADD COLUMN IF NOT EXISTS raw_route_line text null,
  ADD COLUMN IF NOT EXISTS route_base text null,
  ADD COLUMN IF NOT EXISTS work_bucket_name text null,
  ADD COLUMN IF NOT EXISTS work_bucket_type text null;

ALTER TABLE public.manual_shift_orders
  ADD CONSTRAINT manual_shift_orders_work_bucket_type_check
  CHECK (work_bucket_type IS NULL OR work_bucket_type = 'unknown');

-- Conservative backfill: only rows with order items (monthly imported rows).
-- Non-monthly rows (manual daily workflow) are left with null canonical fields.
UPDATE public.manual_shift_orders o
SET
  route_base = l.name,
  work_bucket_name = CASE
    WHEN o.point_name IS NOT NULL AND o.point_name <> l.name
    THEN o.point_name
    ELSE NULL
  END,
  raw_route_line = CASE
    WHEN o.point_name IS NOT NULL AND o.point_name <> l.name
    THEN l.name || '/' || o.point_name
    ELSE l.name
  END,
  work_bucket_type = CASE
    WHEN o.point_name IS NOT NULL AND o.point_name <> l.name
    THEN 'unknown'
    ELSE NULL
  END
FROM public.manual_shift_lines l
WHERE o.line_id = l.id
  AND o.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.manual_shift_order_items i
    WHERE i.order_id = o.id
  );
