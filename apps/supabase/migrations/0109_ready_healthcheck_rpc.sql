create or replace function public.healthcheck()
returns text
language sql
security definer
set search_path = public
as $$
  select 'ok';
$$;

grant execute on function public.healthcheck() to anon;
grant execute on function public.healthcheck() to authenticated;
