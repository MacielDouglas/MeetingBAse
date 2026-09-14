-- Fase 13: familiaId em publishers + novas partes.
-- Idempotente (IF NOT EXISTS).

-- Campo familiaId para agrupar membros da mesma família
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS familia_id UUID;
