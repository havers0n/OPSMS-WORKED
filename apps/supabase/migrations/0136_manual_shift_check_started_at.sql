-- 0136_manual_shift_check_started_at.sql
-- Add distinct timestamp for factual check start and extend events enum.

alter table public.manual_shift_orders
  add column if not exists check_started_at timestamptz null;

alter table public.manual_shift_order_events
  drop constraint if exists manual_shift_order_events_event_type_check;

alter table public.manual_shift_order_events
  add constraint manual_shift_order_events_event_type_check
  check (
    event_type in (
      'created',
      'updated',
      'status_changed',
      'error_reported',
      'error_fixed',
      'comment_updated',
      'picker_changed',
      'checker_changed',
      'bulk_imported',
      'point_deleted',
      'point_restored',
      'check_started',
      'check_unit_created',
      'check_unit_status_changed',
      'check_unit_note_changed',
      'ashlama_created',
      'ashlama_status_changed'
    )
  );
