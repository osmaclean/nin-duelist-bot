# Decisões de Produto: Operações, Notificações e Administração

## Objetivo
- Aumentar taxa de conclusão dos duelos.
- Reduzir abandono por falta de resposta dos jogadores.
- Dar ferramentas operacionais seguras para manutenção sem acesso direto ao banco.

## Escopo priorizado
1. Notificações automáticas (DM + fallback em canal)
2. Comando `/pending` (pendências do usuário)
3. Comandos administrativos com trilha de auditoria

---

## 1) Notificações automáticas

### Eventos que devem gerar notificação
- Duelo criado:
  - notificar oponente e testemunha.
- Duelo pronto para iniciar (`ACCEPTED`):
  - notificar duelistas.
- Resultado enviado (`AWAITING_VALIDATION`):
  - notificar testemunha.
- Resultado confirmado (`CONFIRMED`):
  - notificar duelistas com placar final.
- Resultado rejeitado (volta para `IN_PROGRESS`):
  - notificar duelistas para reenvio.
- Duelo próximo de expirar:
  - aviso com janela final (ex.: 10 min antes).
- Duelo expirado:
  - notificar participantes.

### Estratégia de entrega
- Prioridade 1: DM.
- Fallback: mensagem no canal do duelo com menção se DM falhar.
- Anti-spam:
  - deduplicação por evento (não repetir mesmo evento para mesmo usuário).
  - cooldown curto por usuário/evento (ex.: 60s).

### Conteúdo padrão das notificações
- Identificador do duelo (`#id`).
- Estado atual e ação esperada.
- Link/menção da mensagem original do duelo (quando possível).
- Prazo restante (quando aplicável).

### Regras de produto
- Notificações só para duelos `RANKED` (fase inicial).
- Não reenviar notificação de evento já confirmado em auditoria.
- Permitir desativar DM por usuário no futuro (roadmap).

---

## 2) Comando `/pending`

### Objetivo
- Mostrar ao usuário tudo que depende de ação dele naquele momento.

### Saída do comando
- Seções separadas:
  - `Aguardando sua aceitação`
  - `Aguardando sua validação`
  - `Prontos para iniciar`
  - `Duelos perto de expirar`
- Para cada item:
  - `#duelId`, adversário, status, tempo restante, ação esperada.

### Filtros
- `season: current|all` (default `current`).
- `limit` (default 10, max 25).

### Regras
- Mostrar apenas duelos em que o usuário participa.
- Ordenação por urgência:
  1. perto de expirar
  2. aguardando validação
  3. aguardando aceitação
  4. prontos para iniciar

---

## 3) Painel Admin (comandos operacionais)

### Motivação
- Resolver casos travados sem alterar dados manualmente no banco.
- Garantir rastreabilidade de qualquer intervenção.

### Comandos propostos
1. `/admin duel reopen duel_id:<id> reason:<texto>`
- Reabre duelo para `IN_PROGRESS` quando estava travado incorretamente.

2. `/admin duel cancel duel_id:<id> reason:<texto>`
- Cancela duelo forçando status `CANCELLED`.

3. `/admin duel fix-result duel_id:<id> winner:@user score:<x-y> reason:<texto>`
- Corrige resultado confirmado em caso de erro humano comprovado.

4. `/admin duel force-expire duel_id:<id> reason:<texto>`
- Força `EXPIRED` quando necessário.

### Controle de permissão
- Apenas cargos autorizados (lista em config/env).
- Toda ação exige `reason` obrigatório.
- Opcional: segundo aprovador para ações de alto impacto (`fix-result`).

### Regras de segurança
- Bloquear comandos admin em duelos já arquivados por muito tempo (janela de segurança).
- Validar transições permitidas por comando.
- Em `fix-result`, recalcular pontos/streak de forma transacional.

---

## Auditoria obrigatória

### Tabela sugerida: `AdminActionLog`
- `id`
- `actionType` (`REOPEN`, `CANCEL`, `FIX_RESULT`, `FORCE_EXPIRE`)
- `duelId`
- `performedByDiscordId`
- `reason`
- `beforeSnapshot` (JSON)
- `afterSnapshot` (JSON)
- `createdAt`

### Requisitos
- Toda ação admin grava log antes e depois.
- Logs visíveis por comando de consulta:
  - `/admin logs duel_id:<id>`

---

## Métricas de sucesso
- Taxa de duelos confirmados por semana.
- Tempo médio entre criação e confirmação.
- Redução de duelos expirados sem resposta.
- Quantidade de intervenções admin por categoria.

---

## Ordem de implementação recomendada
1. `/pending` + queries de pendência
2. Notificações automáticas principais (criação, validação, pronto para iniciar, expiração)
3. Fallback DM -> canal
4. Infra de auditoria
5. `/admin duel cancel` e `/admin duel reopen`
6. `/admin duel fix-result` com transação e rollback seguro

---

## Riscos e mitigação
- Spam de mensagens:
  - mitigar com deduplicação e cooldown.
- Correção indevida por admin:
  - reason obrigatório + auditoria + permissão restrita.
- Inconsistência de ranking após `fix-result`:
  - usar transação única para status + ranking + streak + log.
