-- =============================================
-- NinDuelist — Migration Phase 8 (Hardening)
-- Rodar no SQL Editor do Supabase (uma única vez)
-- =============================================

-- 1. Remover coluna witnessAccepted (lógica removida na Fase 5.5.2)
ALTER TABLE "Duel" DROP COLUMN IF EXISTS "witnessAccepted";

-- 2. Corrigir witnessId para NOT NULL (schema já define como obrigatório)
-- Garantir que não há registros com witnessId NULL antes de aplicar
UPDATE "Duel" SET "witnessId" = "challengerId" WHERE "witnessId" IS NULL;
ALTER TABLE "Duel" ALTER COLUMN "witnessId" SET NOT NULL;

-- 3. CHECK constraint: placar válido por formato
-- MD1: scoreWinner=1, scoreLoser=0
-- MD3: scoreWinner=2, scoreLoser IN (0,1)
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_score_format_check" CHECK (
  ("scoreWinner" IS NULL AND "scoreLoser" IS NULL)
  OR (
    "format" = 'MD1' AND "scoreWinner" = 1 AND "scoreLoser" = 0
  )
  OR (
    "format" = 'MD3' AND "scoreWinner" = 2 AND "scoreLoser" IN (0, 1)
  )
);

-- 4. CHECK constraint: winnerId deve ser challengerId ou opponentId
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_winner_participant_check" CHECK (
  "winnerId" IS NULL
  OR "winnerId" = "challengerId"
  OR "winnerId" = "opponentId"
);

-- 5. Índice único parcial: apenas uma season ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS "Season_single_active_idx" ON "Season"("active") WHERE "active" = true;
