begin;

create extension if not exists dblink;

do $$
declare
  default_tenant_uuid uuid;
  other_tenant_uuid uuid := gen_random_uuid();
  other_tenant_code text := 'pr05-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);

  attach_wave_uuid uuid := gen_random_uuid();
  detach_wave_uuid uuid := gen_random_uuid();
  locked_wave_uuid uuid := gen_random_uuid();
  race_wave_a_uuid uuid := gen_random_uuid();
  race_wave_b_uuid uuid := gen_random_uuid();
  race_source_wave_uuid uuid := gen_random_uuid();
  race_target_wave_uuid uuid := gen_random_uuid();
  mismatch_wave_uuid uuid := gen_random_uuid();
  unauthorized_wave_uuid uuid := gen_random_uuid();

  attach_order_uuid uuid := gen_random_uuid();
  detach_order_uuid uuid := gen_random_uuid();
  locked_wave_seed_order_uuid uuid := gen_random_uuid();
  locked_attach_probe_order_uuid uuid := gen_random_uuid();
  non_attachable_order_uuid uuid := gen_random_uuid();
  non_detachable_order_uuid uuid := gen_random_uuid();
  already_attached_order_uuid uuid := gen_random_uuid();
  not_in_wave_order_uuid uuid := gen_random_uuid();
  tenant_mismatch_order_uuid uuid := gen_random_uuid();
  race_attach_order_uuid uuid := gen_random_uuid();
  race_attach_detach_order_uuid uuid := gen_random_uuid();
  unauthorized_order_uuid uuid := gen_random_uuid();
begin
  select id
  into default_tenant_uuid
  from public.tenants
  where code = 'default';

  if default_tenant_uuid is null then
    raise exception 'Test precondition failed: default tenant is missing.';
  end if;

  insert into public.tenants (id, code, name)
  values (other_tenant_uuid, other_tenant_code, 'PR-05 Secondary Tenant');

  insert into public.waves (id, tenant_id, name, status)
  values
    (attach_wave_uuid, default_tenant_uuid, 'PR-05 Attach Wave', 'draft'),
    (detach_wave_uuid, default_tenant_uuid, 'PR-05 Detach Wave', 'draft'),
    (locked_wave_uuid, default_tenant_uuid, 'PR-05 Locked Wave', 'draft'),
    (race_wave_a_uuid, default_tenant_uuid, 'PR-05 Race Wave A', 'draft'),
    (race_wave_b_uuid, default_tenant_uuid, 'PR-05 Race Wave B', 'draft'),
    (race_source_wave_uuid, default_tenant_uuid, 'PR-05 Race Source Wave', 'draft'),
    (race_target_wave_uuid, default_tenant_uuid, 'PR-05 Race Target Wave', 'draft'),
    (mismatch_wave_uuid, other_tenant_uuid, 'PR-05 Mismatch Wave', 'draft'),
    (unauthorized_wave_uuid, default_tenant_uuid, 'PR-05 Unauthorized Wave', 'draft');

  insert into public.orders (id, tenant_id, external_number, status, wave_id)
  values
    (attach_order_uuid, default_tenant_uuid, 'PR05-ATTACH-SUCCESS', 'draft', null),
    (detach_order_uuid, default_tenant_uuid, 'PR05-DETACH-SUCCESS', 'draft', detach_wave_uuid),
    (locked_wave_seed_order_uuid, default_tenant_uuid, 'PR05-LOCKED-SEED', 'draft', locked_wave_uuid),
    (locked_attach_probe_order_uuid, default_tenant_uuid, 'PR05-LOCKED-ATTACH', 'draft', null),
    (non_attachable_order_uuid, default_tenant_uuid, 'PR05-NON-ATTACHABLE', 'picking', null),
    (non_detachable_order_uuid, default_tenant_uuid, 'PR05-NON-DETACHABLE', 'picked', detach_wave_uuid),
    (already_attached_order_uuid, default_tenant_uuid, 'PR05-ALREADY-IN-WAVE', 'draft', attach_wave_uuid),
    (not_in_wave_order_uuid, default_tenant_uuid, 'PR05-NOT-IN-WAVE', 'draft', null),
    (tenant_mismatch_order_uuid, default_tenant_uuid, 'PR05-TENANT-MISMATCH', 'draft', null),
    (race_attach_order_uuid, default_tenant_uuid, 'PR05-RACE-ATTACH', 'draft', null),
    (race_attach_detach_order_uuid, default_tenant_uuid, 'PR05-RACE-DETACH-ATTACH', 'draft', race_source_wave_uuid),
    (unauthorized_order_uuid, default_tenant_uuid, 'PR05-UNAUTHORIZED', 'draft', null);

  update public.waves
  set status = 'released'
  where id = locked_wave_uuid;

  -- attach success
  if public.attach_order_to_wave(attach_wave_uuid, attach_order_uuid) <> attach_order_uuid then
    raise exception 'Expected attach_order_to_wave to return attached order id.';
  end if;

  if (
    select o.wave_id
    from public.orders o
    where o.id = attach_order_uuid
  ) is distinct from attach_wave_uuid then
    raise exception 'Expected attach_order_to_wave to set orders.wave_id.';
  end if;

  -- detach success
  if public.detach_order_from_wave(detach_wave_uuid, detach_order_uuid) <> detach_order_uuid then
    raise exception 'Expected detach_order_from_wave to return detached order id.';
  end if;

  if (
    select o.wave_id
    from public.orders o
    where o.id = detach_order_uuid
  ) is not null then
    raise exception 'Expected detach_order_from_wave to clear orders.wave_id.';
  end if;

  -- attach to membership-locked wave + rollback correctness check
  begin
    perform public.attach_order_to_wave(locked_wave_uuid, locked_attach_probe_order_uuid);
    raise exception 'Expected attach to released wave to fail.';
  exception
    when others then
      if sqlerrm <> 'WAVE_MEMBERSHIP_LOCKED' then
        raise;
      end if;
  end;

  if (
    select o.wave_id
    from public.orders o
    where o.id = locked_attach_probe_order_uuid
  ) is not null then
    raise exception 'Expected failed attach to keep wave_id unchanged (rollback correctness).';
  end if;

  -- detach from membership-locked wave
  begin
    perform public.detach_order_from_wave(locked_wave_uuid, locked_wave_seed_order_uuid);
    raise exception 'Expected detach from released wave to fail.';
  exception
    when others then
      if sqlerrm <> 'WAVE_MEMBERSHIP_LOCKED' then
        raise;
      end if;
  end;

  if (
    select o.wave_id
    from public.orders o
    where o.id = locked_wave_seed_order_uuid
  ) is distinct from locked_wave_uuid then
    raise exception 'Expected failed detach from locked wave to keep membership unchanged.';
  end if;

  -- attach non-attachable order
  begin
    perform public.attach_order_to_wave(attach_wave_uuid, non_attachable_order_uuid);
    raise exception 'Expected non-attachable order to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_ATTACHABLE' then
        raise;
      end if;
  end;

  -- detach non-detachable order
  begin
    perform public.detach_order_from_wave(detach_wave_uuid, non_detachable_order_uuid);
    raise exception 'Expected non-detachable order to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_DETACHABLE' then
        raise;
      end if;
  end;

  if (
    select o.wave_id
    from public.orders o
    where o.id = non_detachable_order_uuid
  ) is distinct from detach_wave_uuid then
    raise exception 'Expected failed non-detachable detach to keep membership unchanged.';
  end if;

  -- attach already-attached order
  begin
    perform public.attach_order_to_wave(attach_wave_uuid, already_attached_order_uuid);
    raise exception 'Expected already-attached order to be rejected.';
  exception
    when others then
      if sqlerrm <> 'ORDER_ALREADY_IN_WAVE' then
        raise;
      end if;
  end;

  -- detach order not in requested wave
  begin
    perform public.detach_order_from_wave(detach_wave_uuid, not_in_wave_order_uuid);
    raise exception 'Expected detach with mismatched membership to fail.';
  exception
    when others then
      if sqlerrm <> 'ORDER_NOT_IN_WAVE' then
        raise;
      end if;
  end;

  -- tenant mismatch behavior
  begin
    perform public.attach_order_to_wave(mismatch_wave_uuid, tenant_mismatch_order_uuid);
    raise exception 'Expected cross-tenant attach to fail.';
  exception
    when others then
      if sqlerrm <> 'TENANT_MISMATCH' then
        raise;
      end if;
  end;

  -- unauthorized/masked behavior (caller without tenant scope)
  perform dblink_connect('pr05_unauthorized', 'dbname=postgres options=-crole=authenticated');
  begin
    perform dblink_exec(
      'pr05_unauthorized',
      format(
        'select public.attach_order_to_wave(%L::uuid, %L::uuid)',
        unauthorized_wave_uuid::text,
        unauthorized_order_uuid::text
      )
    );
    raise exception 'Expected unauthorized attach to be masked as not found.';
  exception
    when others then
      if position('WAVE_NOT_FOUND' in sqlerrm) = 0 then
        raise;
      end if;
  end;
  perform dblink_disconnect('pr05_unauthorized');

  -- concurrency: same order attached to two waves
  perform dblink_connect('pr05_attach_race_a', 'dbname=postgres');
  perform dblink_connect('pr05_attach_race_b', 'dbname=postgres');

  perform dblink_exec('pr05_attach_race_a', 'begin');
  perform dblink_exec('pr05_attach_race_b', 'begin');

  perform dblink_exec(
    'pr05_attach_race_a',
    format(
      'select public.attach_order_to_wave(%L::uuid, %L::uuid)',
      race_wave_a_uuid::text,
      race_attach_order_uuid::text
    )
  );

  perform dblink_send_query(
    'pr05_attach_race_b',
    format(
      'select public.attach_order_to_wave(%L::uuid, %L::uuid)',
      race_wave_b_uuid::text,
      race_attach_order_uuid::text
    )
  );

  perform pg_sleep(0.2);
  perform dblink_exec('pr05_attach_race_a', 'commit');

  begin
    perform *
    from dblink_get_result('pr05_attach_race_b') as r(order_id uuid);
    raise exception 'Expected second concurrent attach to fail.';
  exception
    when others then
      if position('ORDER_ALREADY_IN_WAVE' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  perform dblink_exec('pr05_attach_race_b', 'rollback');
  perform dblink_disconnect('pr05_attach_race_a');
  perform dblink_disconnect('pr05_attach_race_b');

  if (
    select o.wave_id
    from public.orders o
    where o.id = race_attach_order_uuid
  ) is distinct from race_wave_a_uuid then
    raise exception 'Expected winner of concurrent attach race to own the order.';
  end if;

  -- concurrency: attach and detach the same order
  perform dblink_connect('pr05_mix_race_a', 'dbname=postgres');
  perform dblink_connect('pr05_mix_race_b', 'dbname=postgres');

  perform dblink_exec('pr05_mix_race_a', 'begin');
  perform dblink_exec('pr05_mix_race_b', 'begin');

  perform dblink_exec(
    'pr05_mix_race_a',
    format(
      'select public.detach_order_from_wave(%L::uuid, %L::uuid)',
      race_source_wave_uuid::text,
      race_attach_detach_order_uuid::text
    )
  );

  perform dblink_send_query(
    'pr05_mix_race_b',
    format(
      'select public.attach_order_to_wave(%L::uuid, %L::uuid)',
      race_target_wave_uuid::text,
      race_attach_detach_order_uuid::text
    )
  );

  perform pg_sleep(0.2);
  perform dblink_exec('pr05_mix_race_a', 'commit');

  begin
    perform *
    from dblink_get_result('pr05_mix_race_b') as r(order_id uuid);
  exception
    when others then
      raise exception 'Expected attach after concurrent detach to succeed, got: %', sqlerrm;
  end;

  perform dblink_exec('pr05_mix_race_b', 'commit');
  perform dblink_disconnect('pr05_mix_race_a');
  perform dblink_disconnect('pr05_mix_race_b');

  if (
    select o.wave_id
    from public.orders o
    where o.id = race_attach_detach_order_uuid
  ) is distinct from race_target_wave_uuid then
    raise exception 'Expected concurrent detach+attach flow to finish with target wave ownership.';
  end if;
end
$$;

rollback;
