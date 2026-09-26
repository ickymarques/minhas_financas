-- Aplicado ao projeto em 2026-09-25. A RLS continua controlando quais linhas
-- cada usuario autenticado pode ler e alterar.
revoke all privileges on table public.finance_state from anon;
revoke delete, truncate, references, trigger on table public.finance_state from authenticated;
