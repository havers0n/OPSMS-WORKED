-- Description: PR-2 — persist excluded/skipped import rows for monthly demand import audit.
-- Tracks why rows were excluded from normal distribution import (special_flow,
-- zero_quantity, negative_quantity, missing_required_field, non_selected_date).

create table public.manual_shift_import_excluded_rows (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  shift_id uuid not null,
  source_file text not null,
  source_sheet text not null,
  source_row_number integer not null,
  exclusion_reason text not null,
  order_number text,
  customer_name text,
  sku text,
  description text,
  category text,
  quantity numeric,
  raw_route_line text,
  delivery_date text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint manual_shift_import_excluded_rows_pkey primary key (id),
  constraint manual_shift_import_excluded_rows_reason_check
    check (exclusion_reason in (
      'special_flow',
      'zero_quantity',
      'negative_quantity',
      'missing_required_field',
      'non_selected_date'
    ))
);

create index idx_manual_shift_import_excluded_rows_shift
  on public.manual_shift_import_excluded_rows (tenant_id, shift_id);

alter table public.manual_shift_import_excluded_rows enable row level security;

create policy "tenant isolation"
  on public.manual_shift_import_excluded_rows
  for all
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

grant select, insert on public.manual_shift_import_excluded_rows to authenticated;
