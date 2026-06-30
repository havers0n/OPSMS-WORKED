begin;

do $$
declare
  tenant_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  batch_a uuid;
  result jsonb;
  dry_result jsonb;
  row_count integer;
  before_count integer;
begin
  insert into public.tenants(id,code,name)
  values(tenant_a,'DS-REPAIR-'||left(replace(gen_random_uuid()::text,'-',''),8),'DataSheet Repair');
  insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,is_sso_user,raw_app_meta_data,raw_user_meta_data)
  values(user_a,'datasheet-repair@wos.test',now(),now(),now(),false,'{}','{}');
  insert into public.tenant_members(tenant_id,profile_id,role) values(tenant_a,user_a,'tenant_admin');
  perform set_config('request.jwt.claim.sub',user_a::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',user_a::text)::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  execute 'set local role authenticated';

  select count(*) into before_count from public.demand_import_batches where tenant_id=tenant_a;
  begin
    perform public.apply_demand_datasheet_import(
      tenant_a,'invalid.xlsx','DataSheet',user_a,'{}',
      jsonb_build_array(jsonb_build_object('source_row_number',2,'planning_status','not_valid',
        'route_flow','unassigned','product_handling_flow','regular'))
    );
    raise exception 'Expected invalid system payload to fail';
  exception when check_violation then null;
  end;
  select count(*) into row_count from public.demand_import_batches where tenant_id=tenant_a;
  if row_count <> before_count then raise exception 'Failed apply did not roll back its draft batch'; end if;

  result := public.apply_demand_datasheet_import(
    tenant_a,'new.xlsx','DataSheet',user_a,
    '{"rowsCount":4,"rawRowsCount":4,"warningRowsCount":2,"errorRowsCount":1,"specialFlowRowsCount":0,"distributionAreasCount":1,"distinctOrdersCount":4,"distinctSkuCount":4}',
    jsonb_build_array(
      jsonb_build_object('source_row_number',2,'customer_name','Customer A','order_number','SO-1','sku','SKU-1',
        'quantity',5,'distribution_area','North','planned_delivery_date_raw','25.06.26','planned_delivery_date','2026-06-25',
        'planning_status','unplanned','route_flow','unassigned','product_handling_flow','regular','issues','[]'::jsonb,'note_date_hints','[]'::jsonb),
      jsonb_build_object('source_row_number',3,'customer_name','Customer B','order_number','SO-2','sku','SKU-2',
        'quantity',4,'distribution_area','North','planned_delivery_date_raw',null,'planned_delivery_date',null,
        'planning_status','unplanned','route_flow','unassigned','product_handling_flow','regular','issues','[]'::jsonb,'note_date_hints','[]'::jsonb),
      jsonb_build_object('source_row_number',4,'customer_name','Customer C','order_number',null,'sku','SKU-3',
        'quantity',3,'distribution_area','North','planned_delivery_date_raw','2026-06-25','planned_delivery_date','2026-06-25',
        'planning_status','error','route_flow','unassigned','product_handling_flow','regular','issues','[]'::jsonb,'note_date_hints','[]'::jsonb),
      jsonb_build_object('source_row_number',5,'customer_name','Customer D','order_number','SO-4','sku','SKU-4',
        'quantity',2,'distribution_area','North','planned_delivery_date_raw','25.06.26','planned_delivery_date',null,
        'planning_status','unplanned','route_flow','unassigned','product_handling_flow','regular','issues','[]'::jsonb,'note_date_hints','[]'::jsonb)
    )
  );
  batch_a := (result->>'batchId')::uuid;
  if (select status from public.demand_import_batches where id=batch_a) <> 'ready' then
    raise exception 'Transactional apply did not finish ready';
  end if;
  select count(*) into row_count from public.raw_demand_rows where batch_id=batch_a;
  if row_count <> 4 then raise exception 'Expected 4 raw rows, got %',row_count; end if;
  select count(*) into row_count from public.demand_backlog_items where tenant_id=tenant_a;
  if row_count <> 3 then raise exception 'Expected three identity-valid backlog items, got %',row_count; end if;
  if not exists(select 1 from public.demand_backlog_items where tenant_id=tenant_a and status='requires_review') then
    raise exception 'Missing-date row was not marked requires_review';
  end if;
  select count(*) into row_count from public.demand_backlog_item_sources where tenant_id=tenant_a and quantity_at_import is not null;
  if row_count <> 3 then raise exception 'Expected three source links with quantity metadata, got %',row_count; end if;

  -- Date recovery from planned_delivery_date_raw happens during apply
  if not exists(
    select 1 from public.raw_demand_rows
    where batch_id=batch_a and source_row_number=5
      and planned_delivery_date='2026-06-25'
  ) then
    raise exception 'Row 5 planned_delivery_date was not recovered from planned_delivery_date_raw during apply';
  end if;
  if not exists(
    select 1 from public.demand_backlog_items bi
    join public.demand_backlog_item_sources bs on bs.backlog_item_id=bi.id
    where bi.tenant_id=tenant_a and bs.batch_id=batch_a
      and bi.status='open'
  ) then
    raise exception 'Recovered-date backlog item status is not open';
  end if;

  dry_result := public.repair_demand_backlog(tenant_a,batch_a,true);
  if (dry_result->>'rawRowsScanned')::int <> 4 or (dry_result->>'sourceLinksUnchanged')::int <> 3 then
    raise exception 'Unexpected dry-run counters: %',dry_result;
  end if;
  if (dry_result->>'dateRecoveryRequiresReimport')::int <> 1 then
    raise exception 'Expected one legacy date requiring re-import: %',dry_result;
  end if;
  select count(*) into row_count from public.demand_backlog_item_sources where tenant_id=tenant_a;
  if row_count <> 3 then raise exception 'Dry-run changed persistent source links'; end if;

  result := public.repair_demand_backlog(tenant_a,batch_a,false);
  if (result->>'sourceLinksCreated')::int <> 0 or (result->>'sourceLinksUnchanged')::int <> 3 then
    raise exception 'Repair was not idempotent: %',result;
  end if;
end $$;

rollback;
