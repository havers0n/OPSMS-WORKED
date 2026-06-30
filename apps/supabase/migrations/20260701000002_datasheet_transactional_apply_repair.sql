-- Transactional DataSheet apply and explicit backlog repair.
alter table public.raw_demand_rows add column if not exists planned_delivery_date_raw text null;
alter table public.demand_backlog_item_sources add column if not exists quantity_at_import numeric null;
update public.demand_backlog_item_sources s
set quantity_at_import = r.quantity
from public.raw_demand_rows r
where r.id = s.raw_demand_row_id and s.quantity_at_import is null;

-- Existing application code could race because these keys were indexed but not unique.
with ranked as (
  select id, first_value(id) over (partition by tenant_id, identity_key order by created_at, id) canonical_id
  from public.demand_backlog_items
)
update public.demand_backlog_item_sources s set backlog_item_id = r.canonical_id
from ranked r where s.backlog_item_id = r.id and r.id <> r.canonical_id;

delete from public.demand_backlog_item_sources a using public.demand_backlog_item_sources b
where a.tenant_id = b.tenant_id and a.raw_demand_row_id = b.raw_demand_row_id
  and (a.created_at, a.id) > (b.created_at, b.id);

with ranked as (
  select id, row_number() over (partition by tenant_id, identity_key order by created_at, id) rn
  from public.demand_backlog_items
)
delete from public.demand_backlog_items i using ranked r where i.id = r.id and r.rn > 1;

create unique index if not exists demand_backlog_items_tenant_identity_key_uidx
  on public.demand_backlog_items (tenant_id, identity_key);
create unique index if not exists demand_backlog_sources_tenant_raw_row_uidx
  on public.demand_backlog_item_sources (tenant_id, raw_demand_row_id);

create or replace function public.demand_backlog_identity_key(
  p_order_number text, p_customer_name text, p_sku text, p_distribution_area text
) returns text language sql immutable set search_path = '' as $$
  select lower(btrim(coalesce(p_order_number, ''))) || chr(31) ||
         lower(btrim(coalesce(p_customer_name, ''))) || chr(31) ||
         lower(btrim(coalesce(p_sku, ''))) || chr(31) ||
         lower(btrim(coalesce(p_distribution_area, '')))
$$;

create or replace function public.demand_parse_authoritative_date(p_raw text)
returns date language plpgsql immutable set search_path = '' as $$
declare v text := btrim(p_raw); parts text[]; y integer; m integer; d integer;
begin
  if v is null or v = '' then return null; end if;
  if v ~ '^\d{4}-\d{2}-\d{2}(T.*)?$' then return substring(v from 1 for 10)::date; end if;
  if v ~ '^\d{1,2}[./]\d{1,2}[./]\d{2,4}$' then
    parts := regexp_split_to_array(v, '[./]'); d := parts[1]::integer;
    m := parts[2]::integer; y := parts[3]::integer;
    if y < 100 then y := case when y <= 69 then 2000 + y else 1900 + y end; end if;
    return make_date(y, m, d);
  end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.repair_demand_backlog(
  p_tenant_id uuid, p_batch_id uuid default null, p_dry_run boolean default true
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.raw_demand_rows%rowtype; item record; v_item_id uuid; v_identity text;
  v_status text; v_recovered date; v_reason text; v_skips jsonb;
  v_is_new boolean; v_previous_quantity numeric;
  c_scanned int := 0; c_dates int := 0; c_reimport int := 0;
  c_created int := 0; c_updated int := 0; c_unchanged int := 0;
  c_links_created int := 0; c_links_unchanged int := 0; c_review int := 0;
begin
  if not public.can_manage_tenant(p_tenant_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_batch_id is not null and not exists (
    select 1 from public.demand_import_batches where id = p_batch_id and tenant_id = p_tenant_id
  ) then raise exception 'DEMAND_IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002'; end if;

  create temporary table if not exists pg_temp.repair_items (
    identity_key text primary key, id uuid not null, status text not null,
    total_quantity numeric not null, description text null, category text null
  ) on commit drop;
  truncate pg_temp.repair_items;
  insert into pg_temp.repair_items
  select identity_key,id,status,total_quantity,description,category
  from public.demand_backlog_items where tenant_id = p_tenant_id;
  create temporary table if not exists pg_temp.repair_links(raw_demand_row_id uuid primary key) on commit drop;
  truncate pg_temp.repair_links;
  insert into pg_temp.repair_links select raw_demand_row_id from public.demand_backlog_item_sources where tenant_id=p_tenant_id;
  create temporary table if not exists pg_temp.repair_skips(reason text primary key,count int not null) on commit drop;
  truncate pg_temp.repair_skips;

  for r in select * from public.raw_demand_rows
    where tenant_id=p_tenant_id and (p_batch_id is null or batch_id=p_batch_id) order by created_at,id
  loop
    c_scanned := c_scanned + 1;
    if r.planned_delivery_date is null then
      v_recovered := public.demand_parse_authoritative_date(r.planned_delivery_date_raw);
      if v_recovered is null then c_reimport := c_reimport + 1;
      else
        c_dates := c_dates + 1; r.planned_delivery_date := v_recovered;
        if not p_dry_run then update public.raw_demand_rows set planned_delivery_date=v_recovered where id=r.id; end if;
      end if;
    end if;

    v_reason := case
      when nullif(btrim(r.order_number),'') is null then 'missing_order_number'
      when nullif(btrim(r.customer_name),'') is null then 'missing_customer_name'
      when nullif(btrim(r.sku),'') is null then 'missing_sku'
      when nullif(btrim(r.distribution_area),'') is null then 'missing_distribution_area'
      when r.quantity is null then 'missing_quantity'
      when r.quantity < 0 then 'negative_quantity' else null end;
    if v_reason is not null then
      insert into pg_temp.repair_skips values(v_reason,1)
      on conflict(reason) do update set count=pg_temp.repair_skips.count+1;
      continue;
    end if;

    v_identity := public.demand_backlog_identity_key(r.order_number,r.customer_name,r.sku,r.distribution_area);
    v_status := case when r.planned_delivery_date is null then 'requires_review'
      when r.planning_status='special_flow' then 'special_flow' else 'open' end;
    if v_status='requires_review' then c_review:=c_review+1; end if;
    select * into item from pg_temp.repair_items where identity_key=v_identity;
    v_is_new := not found;
    v_previous_quantity := case when v_is_new then null else item.total_quantity end;
    if v_is_new then
      v_item_id:=gen_random_uuid(); c_created:=c_created+1;
      insert into pg_temp.repair_items values(v_identity,v_item_id,v_status,r.quantity,r.description,r.category);
      if not p_dry_run then
        insert into public.demand_backlog_items(id,tenant_id,identity_key,status,total_quantity,order_number,
          customer_name,sku,description,category,distribution_area,product_handling_flow,route_flow)
        values(v_item_id,p_tenant_id,v_identity,v_status,r.quantity,r.order_number,r.customer_name,r.sku,
          r.description,r.category,r.distribution_area,r.product_handling_flow,r.route_flow);
      end if;
    else
      v_item_id:=item.id;
      if v_status='requires_review' and item.status<>'requires_review' then v_status:=item.status; end if;
      if item.status is distinct from v_status or item.total_quantity is distinct from r.quantity
        or (r.description is not null and item.description is distinct from r.description)
        or (r.category is not null and item.category is distinct from r.category) then
        c_updated:=c_updated+1;
        update pg_temp.repair_items set status=v_status,total_quantity=r.quantity,
          description=coalesce(r.description,description),category=coalesce(r.category,category) where identity_key=v_identity;
        if not p_dry_run then
          update public.demand_backlog_items set status=v_status,total_quantity=r.quantity,
            description=coalesce(r.description,description),category=coalesce(r.category,category),
            last_seen_at=timezone('utc',now()),last_quantity_changed_at=case when total_quantity is distinct from r.quantity
              then timezone('utc',now()) else last_quantity_changed_at end
          where tenant_id=p_tenant_id and id=v_item_id;
        end if;
      else c_unchanged:=c_unchanged+1; end if;
    end if;

    if exists(select 1 from pg_temp.repair_links where raw_demand_row_id=r.id) then c_links_unchanged:=c_links_unchanged+1;
    else
      c_links_created:=c_links_created+1; insert into pg_temp.repair_links values(r.id);
      if not p_dry_run then
        insert into public.demand_backlog_item_sources(tenant_id,backlog_item_id,raw_demand_row_id,batch_id,
          merge_action,previous_quantity,new_quantity,quantity_delta,quantity_at_import)
        values(p_tenant_id,v_item_id,r.id,r.batch_id,
          case when v_is_new then 'new' when v_previous_quantity is distinct from r.quantity then 'quantity_changed' else 'matched' end,
          v_previous_quantity,r.quantity,
          case when v_is_new then null else r.quantity-v_previous_quantity end,r.quantity)
        on conflict(tenant_id,raw_demand_row_id) do nothing;
      end if;
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('reason',reason,'count',count) order by reason),'[]'::jsonb)
    into v_skips from pg_temp.repair_skips;
  return jsonb_build_object('dryRun',p_dry_run,'rawRowsScanned',c_scanned,'datesRecovered',c_dates,
    'dateRecoveryRequiresReimport',c_reimport,'backlogItemsCreated',c_created,'backlogItemsUpdated',c_updated,
    'backlogItemsUnchanged',c_unchanged,'sourceLinksCreated',c_links_created,
    'sourceLinksUnchanged',c_links_unchanged,'rowsMarkedRequiresReview',c_review,'skippedReasons',v_skips);
end $$;

create or replace function public.apply_demand_datasheet_import(
  p_tenant_id uuid,p_source_file text,p_source_sheet text,p_uploaded_by uuid,p_summary jsonb,p_rows jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_batch_id uuid; v_repair jsonb;
begin
  if not public.can_manage_tenant(p_tenant_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  insert into public.demand_import_batches(tenant_id,source_file,source_sheet,uploaded_by,status,rows_count,
    raw_rows_count,warning_rows_count,error_rows_count,special_flow_rows_count,distribution_areas_count,
    distinct_orders_count,distinct_sku_count)
  values(p_tenant_id,p_source_file,p_source_sheet,p_uploaded_by,'draft',coalesce((p_summary->>'rowsCount')::int,0),
    coalesce((p_summary->>'rawRowsCount')::int,0),coalesce((p_summary->>'warningRowsCount')::int,0),
    coalesce((p_summary->>'errorRowsCount')::int,0),coalesce((p_summary->>'specialFlowRowsCount')::int,0),
    coalesce((p_summary->>'distributionAreasCount')::int,0),coalesce((p_summary->>'distinctOrdersCount')::int,0),
    coalesce((p_summary->>'distinctSkuCount')::int,0)) returning id into v_batch_id;
  insert into public.raw_demand_rows(tenant_id,batch_id,source_sheet,source_row_number,agent,order_date,customer_name,
    order_number,sku,description,category,quantity,cost,notes,distribution_area,raw_route_line,
    planned_delivery_date_raw,planned_delivery_date,planned_route_line,planned_work_bucket,planning_status,
    route_flow,product_handling_flow,note_date_hints,issues)
  select p_tenant_id,v_batch_id,p_source_sheet,x.source_row_number,x.agent,x.order_date,x.customer_name,x.order_number,
    x.sku,x.description,x.category,x.quantity,x.cost,x.notes,x.distribution_area,x.raw_route_line,
    x.planned_delivery_date_raw,x.planned_delivery_date,x.planned_route_line,x.planned_work_bucket,x.planning_status,
    x.route_flow,x.product_handling_flow,coalesce(x.note_date_hints,'[]'),coalesce(x.issues,'[]')
  from jsonb_to_recordset(p_rows) x(source_row_number int,agent text,order_date date,customer_name text,order_number text,
    sku text,description text,category text,quantity numeric,cost numeric,notes text,distribution_area text,
    raw_route_line text,planned_delivery_date_raw text,planned_delivery_date date,planned_route_line text,
    planned_work_bucket text,planning_status text,route_flow text,product_handling_flow text,note_date_hints jsonb,issues jsonb);
  v_repair:=public.repair_demand_backlog(p_tenant_id,v_batch_id,false);
  update public.demand_import_batches set status='ready' where tenant_id=p_tenant_id and id=v_batch_id;
  return jsonb_build_object('batchId',v_batch_id,'repair',v_repair);
end $$;

revoke execute on function public.demand_backlog_identity_key(text,text,text,text) from public;
revoke execute on function public.demand_parse_authoritative_date(text) from public;
revoke execute on function public.repair_demand_backlog(uuid,uuid,boolean) from public;
revoke execute on function public.apply_demand_datasheet_import(uuid,text,text,uuid,jsonb,jsonb) from public;
grant execute on function public.demand_backlog_identity_key(text,text,text,text) to authenticated;
grant execute on function public.demand_parse_authoritative_date(text) to authenticated;
grant execute on function public.repair_demand_backlog(uuid,uuid,boolean) to authenticated;
grant execute on function public.apply_demand_datasheet_import(uuid,text,text,uuid,jsonb,jsonb) to authenticated;
