create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table if not exists public.push_scheduler_auth(id boolean primary key default true check(id), token text not null);
alter table public.push_scheduler_auth enable row level security;
revoke all on public.push_scheduler_auth from public,anon,authenticated;
grant select on public.push_scheduler_auth to service_role;
create policy push_scheduler_backend on public.push_scheduler_auth to service_role using(true);
insert into public.push_scheduler_auth(id,token) values(true,encode(gen_random_bytes(32),'hex')) on conflict(id) do nothing;
select cron.schedule('mf-payment-reminders','0 * * * *', $job$
 select net.http_post(url:='https://xdgxjvlyiiqxubmxsrir.supabase.co/functions/v1/payment-reminders',headers:=jsonb_build_object('Content-Type','application/json','x-reminder-key',(select token from public.push_scheduler_auth where id)),body:='{}'::jsonb,timeout_milliseconds:=60000);
$job$);
