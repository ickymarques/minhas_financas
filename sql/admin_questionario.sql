-- A solicitação do administrador é lida apenas pelo próprio usuário ou por administradores,
-- conforme a política RLS já existente em public.app_users.
alter table public.app_users
  add column if not exists onboarding_requested_at timestamptz;

-- A política de atualização de app_users já restringe a edição aos administradores.
grant update (onboarding_requested_at) on public.app_users to authenticated;
