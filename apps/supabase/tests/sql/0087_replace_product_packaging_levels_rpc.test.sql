-- 0087_replace_product_packaging_levels_rpc.test.sql
--
-- Verifies replace_product_packaging_levels():
--   1. valid full replace succeeds and returns new rows
--   2. zero base rows rejects; old rows remain unchanged
--   3. multiple base rows rejects; old rows remain unchanged
--   4. multiple default pick rows rejects; old rows remain unchanged
--   5. base row with base_unit_qty != 1 rejects; old rows remain unchanged
--   6. duplicate codes reject; old rows remain unchanged
--   7. inactive default pick rejects; old rows remain unchanged
--   8. non-positive pack dimension rejects; old rows remain unchanged
--   9. base_unit_qty < 1 rejects; old rows remain unchanged
--  10. unknown product rejects with PRODUCT_NOT_FOUND
--
-- Each failure test explicitly asserts that the original rows are still
-- present and unchanged (count + original ids).
--
-- All mutations are wrapped in a single transaction rolled back at the end.

begin;

do $$
declare
  product_a_uuid   uuid := gen_random_uuid();

  -- baseline level ids inserted before the first replace
  baseline_each_id uuid;
  baseline_ctn_id  uuid;

  result_rows      integer;
  valid_set        jsonb;
begin

  -- ── Seed: product + two baseline packaging levels ───────────────────────

  insert into public.products (id, source, external_product_id, name, is_active)
  values (product_a_uuid, 'test-suite', 'pr87-product-a', 'PR-87 Product A', true);

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty,
    is_base, can_pick, can_store, is_default_pick_uom,
    sort_order, is_active
  )
  values
    (gen_random_uuid(), product_a_uuid, 'EACH', 'Each',   1,  true,  true, true, true,  0, true),
    (gen_random_uuid(), product_a_uuid, 'CTN',  'Carton', 12, false, true, true, false, 1, true);

  select id into baseline_each_id
  from public.product_packaging_levels
  where product_id = product_a_uuid and code = 'EACH';

  select id into baseline_ctn_id
  from public.product_packaging_levels
  where product_id = product_a_uuid and code = 'CTN';

  -- ── 1. Valid full replace succeeds ──────────────────────────────────────

  valid_set := jsonb_build_array(
    jsonb_build_object(
      'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
      'is_base', true, 'can_pick', true, 'can_store', true,
      'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
    ),
    jsonb_build_object(
      'code', 'MAS', 'name', 'Master', 'base_unit_qty', 24,
      'is_base', false, 'can_pick', false, 'can_store', true,
      'is_default_pick_uom', false, 'sort_order', 1, 'is_active', true
    )
  );

  select count(*) into result_rows
  from public.replace_product_packaging_levels(product_a_uuid, valid_set);

  if result_rows <> 2 then
    raise exception
      'Test 1 failed: expected 2 returned rows after valid replace, got %', result_rows;
  end if;

  -- Old CTN is gone, new MAS is present
  if exists (
    select 1 from public.product_packaging_levels
    where product_id = product_a_uuid and code = 'CTN'
  ) then
    raise exception 'Test 1 failed: old CTN row should have been replaced.';
  end if;

  if not exists (
    select 1 from public.product_packaging_levels
    where product_id = product_a_uuid and code = 'MAS'
  ) then
    raise exception 'Test 1 failed: new MAS row should be present after replace.';
  end if;

  -- Reset to a clean baseline for the rejection tests
  delete from public.product_packaging_levels where product_id = product_a_uuid;

  insert into public.product_packaging_levels (
    id, product_id, code, name, base_unit_qty,
    is_base, can_pick, can_store, is_default_pick_uom,
    sort_order, is_active
  )
  values
    (baseline_each_id, product_a_uuid, 'EACH', 'Each',   1,  true,  true, true, true,  0, true),
    (baseline_ctn_id,  product_a_uuid, 'CTN',  'Carton', 12, false, true, true, false, 1, true);

  -- ── Helper pattern used below ────────────────────────────────────────────
  -- After each rejected replace:
  --   1) still exactly 2 rows for product_a_uuid
  --   2) baseline EACH and CTN rows are still present with original IDs/values

  -- ── 2. Zero base rows rejects; old rows remain ──────────────────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'CTN', 'name', 'Carton', 'base_unit_qty', 12,
          'is_base', false, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', false, 'sort_order', 0, 'is_active', true
        )
      )
    );
    raise exception 'Test 2 failed: expected ZERO_BASE_ROWS error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'ZERO_BASE_ROWS' then
        raise exception 'Test 2 failed: expected ZERO_BASE_ROWS, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 2 failed: old rows should be intact after ZERO_BASE_ROWS rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 2 failed: baseline rows must remain unchanged after ZERO_BASE_ROWS rejection.';
  end if;

  -- ── 3. Multiple base rows rejects; old rows remain ──────────────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'A', 'name', 'A', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
        ),
        jsonb_build_object(
          'code', 'B', 'name', 'B', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', false, 'sort_order', 1, 'is_active', true
        )
      )
    );
    raise exception 'Test 3 failed: expected MULTIPLE_BASE_ROWS error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'MULTIPLE_BASE_ROWS' then
        raise exception 'Test 3 failed: expected MULTIPLE_BASE_ROWS, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 3 failed: old rows should be intact after MULTIPLE_BASE_ROWS rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 3 failed: baseline rows must remain unchanged after MULTIPLE_BASE_ROWS rejection.';
  end if;

  -- ── 4. Multiple default pick rows rejects; old rows remain ──────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
        ),
        jsonb_build_object(
          'code', 'CTN', 'name', 'Carton', 'base_unit_qty', 12,
          'is_base', false, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 1, 'is_active', true
        )
      )
    );
    raise exception 'Test 4 failed: expected MULTIPLE_DEFAULT_PICK_ROWS error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'MULTIPLE_DEFAULT_PICK_ROWS' then
        raise exception 'Test 4 failed: expected MULTIPLE_DEFAULT_PICK_ROWS, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 4 failed: old rows should be intact after MULTIPLE_DEFAULT_PICK_ROWS rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 4 failed: baseline rows must remain unchanged after MULTIPLE_DEFAULT_PICK_ROWS rejection.';
  end if;

  -- ── 5. Base row with base_unit_qty != 1 rejects; old rows remain ─────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 6,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
        )
      )
    );
    raise exception 'Test 5 failed: expected BASE_UNIT_QTY_INVALID error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'BASE_UNIT_QTY_INVALID' then
        raise exception 'Test 5 failed: expected BASE_UNIT_QTY_INVALID, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 5 failed: old rows should be intact after BASE_UNIT_QTY_INVALID rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 5 failed: baseline rows must remain unchanged after BASE_UNIT_QTY_INVALID rejection.';
  end if;

  -- ── 6. Duplicate codes reject; old rows remain ───────────────────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
        ),
        jsonb_build_object(
          'code', 'EACH', 'name', 'Duplicate', 'base_unit_qty', 6,
          'is_base', false, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', false, 'sort_order', 1, 'is_active', true
        )
      )
    );
    raise exception 'Test 6 failed: expected DUPLICATE_CODE error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'DUPLICATE_CODE' then
        raise exception 'Test 6 failed: expected DUPLICATE_CODE, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 6 failed: old rows should be intact after DUPLICATE_CODE rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 6 failed: baseline rows must remain unchanged after DUPLICATE_CODE rejection.';
  end if;

  -- ── 7. Inactive default pick rejects; old rows remain ────────────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', false, 'sort_order', 0, 'is_active', true
        ),
        jsonb_build_object(
          'code', 'CTN', 'name', 'Carton', 'base_unit_qty', 12,
          'is_base', false, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 1, 'is_active', false
        )
      )
    );
    raise exception 'Test 7 failed: expected INACTIVE_DEFAULT_PICK error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'INACTIVE_DEFAULT_PICK' then
        raise exception 'Test 7 failed: expected INACTIVE_DEFAULT_PICK, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 7 failed: old rows should be intact after INACTIVE_DEFAULT_PICK rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 7 failed: baseline rows must remain unchanged after INACTIVE_DEFAULT_PICK rejection.';
  end if;

  -- ── 8. Non-positive pack dimension rejects; old rows remain ──────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'pack_weight_g', 0,
          'sort_order', 0, 'is_active', true
        )
      )
    );
    raise exception 'Test 8 failed: expected NON_POSITIVE_DIMENSION error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'NON_POSITIVE_DIMENSION' then
        raise exception 'Test 8 failed: expected NON_POSITIVE_DIMENSION, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 8 failed: old rows should be intact after NON_POSITIVE_DIMENSION rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 8 failed: baseline rows must remain unchanged after NON_POSITIVE_DIMENSION rejection.';
  end if;

  -- ── 9. base_unit_qty < 1 rejects; old rows remain ────────────────────────

  begin
    perform public.replace_product_packaging_levels(
      product_a_uuid,
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
        ),
        jsonb_build_object(
          'code', 'FRAC', 'name', 'Fraction', 'base_unit_qty', 0,
          'is_base', false, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', false, 'sort_order', 1, 'is_active', true
        )
      )
    );
    raise exception 'Test 9 failed: expected BASE_UNIT_QTY_BELOW_ONE error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'BASE_UNIT_QTY_BELOW_ONE' then
        raise exception 'Test 9 failed: expected BASE_UNIT_QTY_BELOW_ONE, got: %', sqlerrm;
      end if;
  end;

  if (select count(*) from public.product_packaging_levels where product_id = product_a_uuid) <> 2 then
    raise exception 'Test 9 failed: old rows should be intact after BASE_UNIT_QTY_BELOW_ONE rejection.';
  end if;

  if (
    select count(*)
    from public.product_packaging_levels
    where product_id = product_a_uuid
      and (
        (id = baseline_each_id and code = 'EACH' and name = 'Each' and base_unit_qty = 1 and is_base = true and is_default_pick_uom = true and is_active = true)
        or
        (id = baseline_ctn_id and code = 'CTN' and name = 'Carton' and base_unit_qty = 12 and is_base = false and is_default_pick_uom = false and is_active = true)
      )
  ) <> 2 then
    raise exception 'Test 9 failed: baseline rows must remain unchanged after BASE_UNIT_QTY_BELOW_ONE rejection.';
  end if;

  -- ── 10. Unknown product raises PRODUCT_NOT_FOUND ─────────────────────────

  begin
    perform public.replace_product_packaging_levels(
      gen_random_uuid(),
      jsonb_build_array(
        jsonb_build_object(
          'code', 'EACH', 'name', 'Each', 'base_unit_qty', 1,
          'is_base', true, 'can_pick', true, 'can_store', true,
          'is_default_pick_uom', true, 'sort_order', 0, 'is_active', true
        )
      )
    );
    raise exception 'Test 10 failed: expected PRODUCT_NOT_FOUND error but none was raised.';
  exception
    when others then
      if sqlerrm <> 'PRODUCT_NOT_FOUND' then
        raise exception 'Test 10 failed: expected PRODUCT_NOT_FOUND, got: %', sqlerrm;
      end if;
  end;

end
$$;

rollback;
