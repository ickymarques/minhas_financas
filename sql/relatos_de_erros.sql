create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved')),
  email_status text not null default 'pending' check (email_status in ('pending', 'sending', 'sent', 'failed')),
  email_sent_at timestamptz
);

create index if not exists issue_reports_created_at_idx on public.issue_reports(created_at desc);
create index if not exists issue_reports_user_id_idx on public.issue_reports(user_id);
alter table public.issue_reports enable row level security;

revoke all on public.issue_reports from public, anon, authenticated;
grant select on public.issue_reports to authenticated;
grant insert (message) on public.issue_reports to authenticated;
grant update (status) on public.issue_reports to authenticated;

create policy issue_reports_select_own_or_admin on public.issue_reports
  for select to authenticated
  using (
    user_id = (select auth.uid()) or exists (
      select 1 from public.app_admins a where a.user_id = (select auth.uid())
    )
  );

create policy issue_reports_insert_own on public.issue_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy issue_reports_update_admin on public.issue_reports
  for update to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));
