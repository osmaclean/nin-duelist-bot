# Melhorias Pendentes — Auditoria 2025-02

Issues identificadas na auditoria de qualidade. Organizadas por severidade.

---

## ALTO — Bugs reais

### ~~3. Guard de NaN no `duelId` parseado de `customId`~~ — RESOLVIDO

Adicionado `isNaN(duelId)` guard em `handler.ts`, `confirm-result.ts`, `submit-result.ts` e `submit-score.ts`. Testes cobrindo o cenário em todos os 4 arquivos.

---

### ~~4. Bug de fuso horário no antifarm~~ — RESOLVIDO

Trocado `setDate/getDate` por `setUTCDate/getUTCDate`. Teste adicionado validando janela de 24h exatas.

---

### ~~5. Antifarm checa `createdAt` ao invés de data de confirmação~~ — RESOLVIDO

Trocado filtro `createdAt` por `updatedAt` para refletir a data real de confirmação.

---

### ~~6. Pagination retorna antes do `deferUpdate`~~ — RESOLVIDO

Movido `deferUpdate` para antes do guard. Guard agora responde com "Página inválida." ephemeral. Adicionado clamp `Math.min(page, totalPages)` para pages fora do range.

---

## MEDIO — Robustez

### ~~7. Sem graceful shutdown~~ — RESOLVIDO

Adicionado handler `SIGTERM`/`SIGINT` em `index.ts` que chama `client.destroy()` + `prisma.$disconnect()` antes de sair.

---

### ~~8. `ensureActiveSeason` sem try/catch no ready~~ — RESOLVIDO

Envolvido body do ready em try/catch. Falha loga erro e chama `process.exit(1)` ao invés de deixar o bot "morto".

---

### ~~9. `confirm-result.ts` importa `prisma` diretamente~~ — RESOLVIDO

Criada função `confirmAndApplyResult` no `duel.service.ts` que encapsula a transação de confirmação + aplicação de resultado. O handler agora chama apenas essa função, sem importar `prisma` diretamente. `TxClient` extraído para `lib/prisma.ts` para evitar dependência circular.

---

### ~~10. `submitResult` faz `findUnique` redundante~~ — RESOLVIDO

Removido `findUnique` prévio. `submitResult` agora chama `transitionDuel` diretamente (como `startDuel` já fazia), confiando no guard de status do `updateMany`.

---

### ~~11. Paginação sem check de `page > totalPages`~~ — RESOLVIDO

Resolvido junto com o item 6. Adicionado clamp `Math.min(page, totalPages)` no handler de paginação.

---

## BAIXO — Clean code / Schema

### 12. `DISCORD_GUILD_ID` tipagem inconsistente

`config.ts` exporta como `string` (pode ser `''`), mas `deploy-commands.ts` faz `if (DISCORD_GUILD_ID)` tratando como opcional. Funciona porque string vazia é falsy, mas a semântica poderia ser mais clara com tipo `string | undefined`.

**Status:** Resolvido parcialmente na validação de env vars — agora é `'' ` quando não definido, e o `if` funciona corretamente.

---

### 13. `channelId` nullable no schema mas sempre populado

**Arquivo:** `prisma/schema.prisma`

`channelId String?` é nullable mas `createDuel` sempre exige o valor. Se o bot crashar entre `createDuel` e `setMessageId`, o `messageId` fica null e o job de expiração não consegue atualizar a mensagem no Discord.

**Fix:** Tornar `channelId` required (`String` sem `?`). Considerar retry/recovery para `messageId`.

---

### 14. `points` pode ficar negativo sem floor

**Arquivo:** `schema.prisma` / `config.ts`

`POINTS_LOSS = -1` e não há constraint no banco impedindo `points < 0`. Jogador com 0 pontos que perde fica com -1.

**Fix:** Adicionar `GREATEST(0, "points" + ${POINTS_LOSS})` na query de update do loser, ou aceitar pontos negativos como decisão de produto.

---

### 15. `typescript` em `dependencies` infla imagem Docker

**Arquivo:** `package.json` / `Dockerfile`

`typescript` está em `dependencies` ao invés de `devDependencies`. A imagem de produção inclui o compilador desnecessariamente. Multi-stage build resolveria.

**Fix:** Mover `typescript` pra `devDependencies` e usar multi-stage Dockerfile (build stage com dev deps, runtime stage só com `dist/`).

---

### 16. `as any` desnecessários no `interactionCreate.ts`

**Arquivo:** `events/interactionCreate.ts:36`

```typescript
const interactionId = 'customId' in interaction
  ? (interaction as any).customId
  : (interaction as any).commandName;
```

Após o `in` check, TypeScript já faz narrowing. Os `as any` são desnecessários.

---

### 17. `startRank` duplicado

**Arquivos:** `commands/rank.ts:25`, `lib/pagination.ts:38`

Ambos calculam `(page - 1) * RANK_PAGE_SIZE + 1`. Poderia ser extraído ou retornado por `getLeaderboard`.

---

### 18. `submit-result.ts` não usa `createDuelButtonHandler`

**Arquivo:** `buttons/submit-result.ts`

Não usa o pattern HOF do `handler.ts`, duplicando boilerplate de fetch + status check + permission check. A diferença é que mostra modal ao invés de editar mensagem, mas o pattern poderia ser adaptado.
