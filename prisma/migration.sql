-- =============================================
-- NinDuelist — Schema completo
-- Estado: atualizado (inclui todas as fases ate Phase 8)
--
-- QUANDO USAR:
--   Banco novo (primeira instalacao). Rodar uma unica vez no SQL Editor do Supabase.
--   Contem todas as tabelas, constraints, indices e enums do estado atual.
-- =============================================

-- 1. Enums

CREATE TYPE "DuelStatus" AS ENUM (
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'AWAITING_VALIDATION',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "DuelFormat" AS ENUM ('MD1', 'MD3');

-- 2. Tabela Player

CREATE TABLE "Player" (
  "id" SERIAL PRIMARY KEY,
  "discordId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "dmEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Player_discordId_key" UNIQUE ("discordId")
);

-- 3. Tabela Season

CREATE TABLE "Season" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "name" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "endingNotificationSent" BOOLEAN NOT NULL DEFAULT false,
  "championId" INTEGER,
  CONSTRAINT "Season_number_key" UNIQUE ("number"),
  CONSTRAINT "Season_championId_fkey" FOREIGN KEY ("championId")
    REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. Tabela PlayerSeason

CREATE TABLE "PlayerSeason" (
  "id" SERIAL PRIMARY KEY,
  "playerId" INTEGER NOT NULL,
  "seasonId" INTEGER NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "peakStreak" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PlayerSeason_playerId_seasonId_key" UNIQUE ("playerId", "seasonId"),
  CONSTRAINT "PlayerSeason_playerId_fkey" FOREIGN KEY ("playerId")
    REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayerSeason_seasonId_fkey" FOREIGN KEY ("seasonId")
    REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Tabela Duel

CREATE TABLE "Duel" (
  "id" SERIAL PRIMARY KEY,
  "status" "DuelStatus" NOT NULL DEFAULT 'PROPOSED',
  "format" "DuelFormat" NOT NULL,
  "challengerId" INTEGER NOT NULL,
  "opponentId" INTEGER NOT NULL,
  "witnessId" INTEGER NOT NULL,
  "seasonId" INTEGER NOT NULL,
  "winnerId" INTEGER,
  "scoreWinner" INTEGER,
  "scoreLoser" INTEGER,
  "opponentAccepted" BOOLEAN NOT NULL DEFAULT false,
  "expiryWarned" BOOLEAN NOT NULL DEFAULT false,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Duel_challengerId_fkey" FOREIGN KEY ("challengerId")
    REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_opponentId_fkey" FOREIGN KEY ("opponentId")
    REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_witnessId_fkey" FOREIGN KEY ("witnessId")
    REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_seasonId_fkey" FOREIGN KEY ("seasonId")
    REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_winnerId_fkey" FOREIGN KEY ("winnerId")
    REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Duel_score_format_check" CHECK (
    ("scoreWinner" IS NULL AND "scoreLoser" IS NULL)
    OR ("format" = 'MD1' AND "scoreWinner" = 1 AND "scoreLoser" = 0)
    OR ("format" = 'MD3' AND "scoreWinner" = 2 AND "scoreLoser" IN (0, 1))
  ),
  CONSTRAINT "Duel_winner_participant_check" CHECK (
    "winnerId" IS NULL
    OR "winnerId" = "challengerId"
    OR "winnerId" = "opponentId"
  )
);

-- 6. Tabela AdminActionLog

CREATE TABLE "AdminActionLog" (
  "id" SERIAL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "adminDiscordId" TEXT NOT NULL,
  "duelId" INTEGER,
  "reason" TEXT,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminActionLog_duelId_fkey" FOREIGN KEY ("duelId")
    REFERENCES "Duel"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 7. Indices

CREATE INDEX "Duel_status_challengerId_idx" ON "Duel"("status", "challengerId");
CREATE INDEX "Duel_status_opponentId_idx" ON "Duel"("status", "opponentId");
CREATE INDEX "Duel_status_createdAt_idx" ON "Duel"("status", "createdAt");
CREATE INDEX "PlayerSeason_leaderboard_idx" ON "PlayerSeason"("seasonId", "points" DESC, "wins" DESC, "peakStreak" DESC);
CREATE INDEX "AdminActionLog_duelId_idx" ON "AdminActionLog"("duelId");
CREATE INDEX "AdminActionLog_adminDiscordId_idx" ON "AdminActionLog"("adminDiscordId");
CREATE UNIQUE INDEX "Season_single_active_idx" ON "Season"("active") WHERE "active" = true;

-- 8. Tabela de controle do Prisma Migrate

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMP WITH TIME ZONE,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMP WITH TIME ZONE,
  "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual_migration_full',
  '20260309_full_schema',
  now(),
  1
);
