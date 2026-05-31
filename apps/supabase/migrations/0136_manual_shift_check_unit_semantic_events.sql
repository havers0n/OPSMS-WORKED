-- 0136_manual_shift_check_unit_semantic_events.sql
-- Extend manual_shift_order_events event_type constraint to include semantic
-- check-unit audit events. These replace the generic check_unit_status_changed
-- for issue-reporting, clean-check, and issue-resolution transitions.

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
      'check_unit_created',
      'check_unit_status_changed',
      'check_unit_note_changed',
      'check_unit_issue_reported',
      'check_unit_checked',
      'check_unit_issue_resolved',
      'ashlama_created',
      'ashlama_status_changed'
    )
  );
