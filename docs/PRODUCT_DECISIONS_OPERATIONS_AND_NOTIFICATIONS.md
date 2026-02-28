# Decisões de Produto: Operações, Notificações e Administração

## Objetivo
- Aumentar taxa de conclusão dos duelos.
- Reduzir abandono por falta de resposta dos jogadores.
- Dar ferramentas operacionais seguras para manutenção sem acesso direto ao banco.

## Escopo priorizado
1. Notificações automáticas (DM + fallback em canal) — **parcialmente implementado**
2. Comando `/pending` (pendências do usuário) — **IMPLEMENTADO**
3. Comandos administrativos com trilha de auditoria — **parcialmente implementado**

---

## 1) Notificações automáticas

### Eventos que devem gerar notificação
- Duelo criado:
  - notificar oponente e testemunha. *(pendente)*
- Duelo pronto para iniciar (`ACCEPTED`):
  - notificar duelistas. *(pendente)*
- Resultado enviado (`AWAITING_VALIDATION`):
  - notificar testemunha. **IMPLEMENTADO** — DM com fallback para menção no canal (`lib/notifications.ts`)
- Resultado confirmado (`CONFIRMED`):
  - notificar duelistas com placar final. *(pendente)*
- Resultado rejeitado (volta para `IN_PROGRESS`):
  - notificar duelistas para reenvio. *(pendente)*
- Duelo próximo de expirar:
  - aviso com janela final (ex.: 10 min antes). *(pendente)*
- Duelo expirado:
  - notificar participantes. *(pendente)*

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

## 2) Comando `/pending` — IMPLEMENTADO

### Implementação atual (`commands/pending.ts` + `services/pending.service.ts`)
- Mostra duelos que precisam de ação do usuário na season atual
- Resposta ephemeral (só o usuário vê)
- Ordenação por urgência (5 níveis): expirando > validação > aceitação > pronto > em andamento
- Exibe tempo restante para duelos PROPOSED
- Para cada item: `#duelId`, adversário, status, ação esperada

### Pendente para v2
- Filtros `season: current|all` e `limit`
- Seções visuais separadas por categoria de urgência

---

## 3) Painel Admin (comandos operacionais)

### Motivação
- Resolver casos travados sem alterar dados manualmente no banco.
- Garantir rastreabilidade de qualquer intervenção.

### Comandos propostos
1. `/admin duel reopen duel_id:<id> reason:<texto>` *(pendente)*
- Reabre duelo para `IN_PROGRESS` quando estava travado incorretamente.

2. `/admin duel cancel duel_id:<id> reason:<texto>` — **IMPLEMENTADO**
- Cancela duelo forçando status `CANCELLED`.
- Implementado em `commands/admin.ts` com verificação de cargo via `ADMIN_ROLE_IDS`.
- Valida que o duelo não está em estado terminal.
- Loga ação com admin ID, motivo e status anterior.
- Atualiza embed original (remove botões).

3. `/admin duel fix-result duel_id:<id> winner:@user score:<x-y> reason:<texto>` *(pendente)*
- Corrige resultado confirmado em caso de erro humano comprovado.

4. `/admin duel force-expire duel_id:<id> reason:<texto>` *(pendente)*
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
1. ~~`/pending` + queries de pendência~~ — IMPLEMENTADO
2. ~~Notificação de validação (testemunha)~~ — IMPLEMENTADO (DM + fallback canal)
3. ~~`/admin duel cancel`~~ — IMPLEMENTADO
4. Notificações automáticas restantes (criação, aceitação, confirmação, rejeição, expiração)
5. Infra de auditoria (`AdminActionLog`)
6. `/admin duel reopen`
7. `/admin duel fix-result` com transação e rollback seguro

---

## Riscos e mitigação
- Spam de mensagens:
  - mitigar com deduplicação e cooldown.
- Correção indevida por admin:
  - reason obrigatório + auditoria + permissão restrita.
- Inconsistência de ranking após `fix-result`:
  - usar transação única para status + ranking + streak + log.
