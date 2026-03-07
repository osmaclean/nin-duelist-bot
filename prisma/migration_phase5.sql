-- =============================================
-- NinDuelist — Migration Phase 5 (Notificações)
-- Rodar no SQL Editor do Supabase (uma única vez)
-- =============================================

-- 1. Player: adicionar coluna dmEnabled (opt-out de DMs)
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "dmEnabled" BOOLEAN NOT NULL DEFAULT true;

-- 2. Season: adicionar coluna endingNotificationSent (aviso 24h)
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "endingNotificationSent" BOOLEAN NOT NULL DEFAULT false;
