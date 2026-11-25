# Referência pública do CDI

Esta função retorna somente `{rate,date,source,cached}` com a taxa anual de referência. Não consulta nem recebe investimentos, contas, saldos ou identificadores de usuários. O gateway JWT fica desativado e a função valida a chave pública do frontend no cabeçalho `apikey`; essa chave identifica a aplicação e não concede acesso a dados privados.

Fontes fixas, em ordem: SGS/BCB 12 (% ao dia convertido em taxa anual com 252 dias úteis), SGS/BCB 4389 (% ao ano, base 252) e BrasilAPI `/api/taxas/v1/CDI` (% ao ano). A BrasilAPI não retorna data de publicação: nesse caso `date` é a data da consulta, identificada por `dateKind: consulted`.

Cada consulta tem timeout; o cache da instância dura uma hora. Durante falhas temporárias, a última referência da instância pode ser usada por até sete dias. O frontend também mantém uma referência local e o snapshot público `cdi-reference.json`, com limite de sete dias e aviso de última referência válida. Atualize o snapshot somente com uma resposta verificada, nunca com taxa presumida. O snapshot publicado em 04/10/2026 corresponde a uma consulta real da BrasilAPI (CDI 13,65% a.a.).

O frontend tenta atualizar ao reconectar, ao voltar ao app e pelo botão Atualizar CDI. O cálculo aplica o percentual informado à taxa diária equivalente antes da capitalização mensal. As projeções mantêm a referência constante; não representam a rentabilidade histórica real nem previsão de futuras mudanças do CDI.

Verificação: `node --test tests/investment-cdi.test.js tests/service-worker.test.js`.
