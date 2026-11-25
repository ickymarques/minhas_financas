create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  appearance text not null default 'auto' check (appearance in ('auto','light','dark')),
  avatar text check (char_length(avatar) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.account_preferences enable row level security;
revoke all on public.account_preferences from anon, public;
create policy account_preferences_select_own on public.account_preferences
 for select to authenticated using (
  user_id = (select auth.uid()) and exists (
   select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.access_status='approved'
  ));
create policy account_preferences_insert_own on public.account_preferences
 for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
   select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.access_status='approved'
  ));
create policy account_preferences_update_own on public.account_preferences
 for update to authenticated using (
  user_id = (select auth.uid()) and exists (
   select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.access_status='approved'
  )) with check (
  user_id = (select auth.uid()) and exists (
   select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.access_status='approved'
  ));
grant select on public.account_preferences to authenticated;
grant insert (user_id,display_name,appearance,avatar) on public.account_preferences to authenticated;
grant update (display_name,appearance,avatar,updated_at) on public.account_preferences to authenticated;
