-- Fase 11: indisponibilidade de publicadores.
-- Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL,
  publisher_id UUID NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unav_pub ON unavailability (congregation_id, publisher_id);
