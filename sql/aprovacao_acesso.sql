-- Contas atuais permanecem aprovadas; cadastros posteriores começam pendentes.
alter table public.app_users
  add column access_status text not null default 'pending'
  constraint app_users_access_status_check check (access_status in ('pending','approved','rejected'));

update public.app_users set access_status = 'approved';

-- A política RLS limita a alteração ao administrador; o privilégio de coluna
-- permite que o botão de aprovação/suspensão envie a atualização.
grant update (access_status) on public.app_users to authenticated;

-- A autorização é conferida no banco para cada acesso aos dados privados.
alter policy finance_state_select_own on public.finance_state
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u
    where u.user_id = (select auth.uid()) and u.access_status = 'approved'));
alter policy finance_state_insert_own on public.finance_state
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u
    where u.user_id = (select auth.uid()) and u.access_status = 'approved'));
alter policy finance_state_update_own on public.finance_state
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u
    where u.user_id = (select auth.uid()) and u.access_status = 'approved'))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u
    where u.user_id = (select auth.uid()) and u.access_status = 'approved'));

alter policy user_onboarding_read_own_or_admin on public.user_onboarding
  using ((user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u where u.user_id = (select auth.uid()) and u.access_status = 'approved'))
    or exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));
alter policy user_onboarding_insert_own on public.user_onboarding
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u where u.user_id = (select auth.uid()) and u.access_status = 'approved'));
alter policy user_onboarding_update_own on public.user_onboarding
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u where u.user_id = (select auth.uid()) and u.access_status = 'approved'))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u where u.user_id = (select auth.uid()) and u.access_status = 'approved'));

alter policy issue_reports_select_own_or_admin on public.issue_reports
  using ((user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u where u.user_id = (select auth.uid()) and u.access_status = 'approved'))
    or exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));
alter policy issue_reports_insert_own on public.issue_reports
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.app_users u where u.user_id = (select auth.uid()) and u.access_status = 'approved'));
