-- Fase 10: orações por reunião + horários de início.
-- Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS prayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  congregation_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicial', 'final')),
  publisher_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_prayers_meeting ON prayers (meeting_id);

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS hora_inicio TEXT;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS hora_inicio TEXT;
