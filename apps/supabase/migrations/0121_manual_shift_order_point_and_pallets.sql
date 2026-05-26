-- Migration: 0121_manual_shift_order_point_and_pallets.sql
-- Description: Add point_name and pallet_count columns to manual_shift_orders and update validate trigger.

ALTER TABLE public.manual_shift_orders
  ADD COLUMN point_name text null,
  ADD COLUMN pallet_count numeric(6,2) null CHECK (pallet_count is null or pallet_count >= 0);

-- Update the row validation trigger function to trim and nullify point_name
CREATE OR REPLACE FUNCTION public.validate_manual_shift_order_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  session_row public.manual_shift_sessions%ROWTYPE;
  line_row public.manual_shift_lines%ROWTYPE;
BEGIN
  SELECT *
  INTO session_row
  from public.manual_shift_sessions
  where id = new.shift_id;

  IF session_row.id is null THEN
    RAISE EXCEPTION 'MANUAL_SHIFT_SESSION_NOT_FOUND';
  END IF;

  SELECT *
  INTO line_row
  from public.manual_shift_lines
  where id = new.line_id;

  IF line_row.id is null THEN
    RAISE EXCEPTION 'MANUAL_SHIFT_LINE_NOT_FOUND';
  END IF;

  IF session_row.tenant_id <> new.tenant_id or line_row.tenant_id <> new.tenant_id THEN
    RAISE EXCEPTION 'MANUAL_SHIFT_ORDER_TENANT_MISMATCH';
  END IF;

  IF line_row.shift_id <> new.shift_id THEN
    RAISE EXCEPTION 'MANUAL_SHIFT_ORDER_LINE_SHIFT_MISMATCH';
  END IF;

  new.order_number := nullif(trim(coalesce(new.order_number, '')), '');
  new.customer_name := nullif(trim(coalesce(new.customer_name, '')), '');
  new.point_name := nullif(trim(coalesce(new.point_name, '')), '');
  new.picker_name := nullif(trim(coalesce(new.picker_name, '')), '');
  new.checker_name := nullif(trim(coalesce(new.checker_name, '')), '');
  new.comment := nullif(trim(coalesce(new.comment, '')), '');

  return new;
END;
$$;
