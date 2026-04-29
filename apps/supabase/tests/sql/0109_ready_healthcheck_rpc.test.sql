begin;
select plan(3);

select is(public.healthcheck(), 'ok', 'healthcheck returns stable ok payload');

truncate table public.sites cascade;
select is(public.healthcheck(), 'ok', 'healthcheck does not depend on business table rows');

set local role anon;
select is(public.healthcheck(), 'ok', 'anon role can execute healthcheck');
reset role;

select * from finish();
rollback;
