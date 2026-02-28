# Decisões de Produto: Histórico e Estatísticas de Jogador

## Ideia principal
- Adicionar comando: `/history player:@user season:current|all mode:ranked`
- Objetivo: aumentar transparência do ranking e confiança dos jogadores.

## Resposta do histórico (primeira versão)
- Resumo:
  - total de duelos
  - vitórias
  - derrotas
  - taxa de vitória (win rate)
  - streak atual
  - melhor streak
- Seção de confronto direto (top 5):
  - adversários mais enfrentados
  - W/L contra cada adversário
- Partidas recentes (últimos 10 duelos):
  - data
  - adversário
  - placar
  - resultado
  - testemunha
- Filtros opcionais:
  - `vs:@user`
  - `from:date`
  - `to:date`

## Regras de negócio
- Por padrão, o histórico deve incluir apenas duelos `CONFIRMED`.
- Rankings de win rate devem exigir um número mínimo de partidas.
- A saída do comando deve ter paginação/limites para evitar estouro de mensagem no Discord.

## Status de implementação

### Implementados
- `/history [@player]` — v1 com stats + últimos 10 duelos (sem filtros avançados ainda)
- `/profile [@player]` — Card compacto com ranking, stats, streak e seasons jogadas

### Próximos comandos de produto (roadmap)
1. ~~`/profile @user`~~ — IMPLEMENTADO
2. `/h2h @a @b`
  - Histórico e estatísticas de confronto direto entre dois jogadores.
3. `/activity`
  - Jogadores mais ativos da season.
4. `/records`
  - Maior streak, melhor win rate (com mínimo de jogos) e outros recordes.

### Filtros pendentes para `/history`
- `vs:@user` — confronto direto
- `from:date` / `to:date` — filtro por período
- Paginação por botões para mais de 10 duelos

## Direcionamento técnico
- Criar queries eficientes no Prisma para:
  - histórico de duelos confirmados por jogador
  - estatísticas agrupadas por adversário (head-to-head)
  - lista de duelos recentes com paginação
- Manter formato da resposta orientado a embeds, com paginação por botões para páginas adicionais.
