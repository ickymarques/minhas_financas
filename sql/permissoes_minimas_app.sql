-- Aplicado em 2026-09-25. As politicas RLS continuam limitando as linhas.
-- Conceder somente as colunas usadas no aplicativo; jamais permitir
-- atualizar user_id, email ou outros campos de identidade pelo cliente.
grant update (uber_enabled, onboarding_requested_at)
  on public.app_users to authenticated;

grant update (answers, completed_at)
  on public.user_onboarding to authenticated;

grant insert (message), update (status)
  on public.issue_reports to authenticated;
