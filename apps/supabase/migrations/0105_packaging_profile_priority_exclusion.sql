-- 0105_packaging_profile_priority_exclusion.sql
--
-- Enforce active packaging profile priority uniqueness under concurrent inserts.

create extension if not exists btree_gist;

alter table public.packaging_profiles
  drop constraint if exists packaging_profiles_active_priority_no_overlap;

alter table public.packaging_profiles
  add constraint packaging_profiles_active_priority_no_overlap
  exclude using gist (
    tenant_id with =,
    product_id with =,
    scope_type with =,
    scope_id with =,
    priority with =,
    public.packaging_profile_effective_window(valid_from, valid_to) with &&
  )
  where (status = 'active');
