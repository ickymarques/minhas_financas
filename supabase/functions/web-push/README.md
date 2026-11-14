# Web Push

O frontend `push.js` ativa a assinatura por gesto do usuário em Ajustes. O service worker recebe o aviso e abre o comunicado interno. O aparelho deve oferecer Push API; no iOS/iPadOS 16.4+, o app precisa estar instalado na Tela de Início.

## Backend

Execute `sql/web-push.sql` uma vez no projeto antes de publicar esta função. As três tabelas permitem acesso somente ao backend com `service_role`; RLS e revogação de grants bloqueiam clientes. As chaves VAPID são geradas uma vez e a chave privada fica na tabela protegida, nunca no cliente ou nos logs. Faça backup seguro dessa tabela: trocar a chave requer novas assinaturas.

A função `web-push` usa `verify_jwt=false` porque `config` retorna apenas a chave pública. Todas as outras ações validam o token com `auth.getUser` e consultam a aprovação atual na tabela `app_users`. O envio do comunicado exige também registro em `app_admins`. Não altere essa autenticação ao modificar a função.

As variáveis do Supabase são fornecidas pelo ambiente da Edge Function: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEYS`). Não são necessárias credenciais de Firebase, Apple ou Resend.

## Ações

- `config`: chave VAPID pública.
- `subscribe`: assinatura válida do usuário aprovado, com endpoint de provedor permitido.
- `status` e `unsubscribe`: somente assinatura da própria conta.
- `test`: aviso para o próprio endpoint, um por intervalo de minuto.
- `send_regularize`: administrador envia o comunicado aprovado, uma vez por assinatura. Contas suspensas são ignoradas; respostas 404/410 eliminam assinaturas expiradas. Falhas de envio podem ser tentadas novamente.

O aviso contém apenas o comunicado, sem saldos, transações ou outros dados financeiros. URLs fornecidas no payload não são abertas pelo service worker.

## Verificação

`node --test tests/push.test.js tests/service-worker.test.js` verifica recebimento, payload inválido, abertura segura, reutilização de janela e arquivos de cache. A entrega real precisa ser verificada em Ajustes → Notificações no celular → Enviar teste, com a permissão concedida no aparelho.

Limitação: se um provedor aceitar um aviso e a função parar antes de registrar o resultado, a reserva de entrega evita duplicá-lo. A aceitação pelo provedor não garante exibição pelo sistema operacional (por exemplo, durante um modo de concentração).
