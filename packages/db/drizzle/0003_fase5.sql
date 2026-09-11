-- FASE 5 — DDL idempotente (password_hash em users, updatedAt em meetings, speakers, visits).
-- Aplicar com psql ou Neon SQL Editor. Idempotente: IF NOT EXISTS / IF NOT EXISTS column.

-- 1. Adicionar password_hash na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- 2. Adicionar updated_at na tabela meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Tabela speakers (falantes públicos)
CREATE TABLE IF NOT EXISTS speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  celular TEXT,
  email TEXT,
  talk_numbers INTEGER[] DEFAULT '{}',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_speakers_cong ON speakers (congregation_id, activo);

-- 4. Tabela visits (visitas de falantes)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL,
  speaker_id UUID NOT NULL,
  fecha DATE NOT NULL,
  talk_number INTEGER,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_cong ON visits (congregation_id, fecha);

-- ============================================================
-- RLS para speakers e visits (ativar quando RLS estiver ativo)
-- ============================================================
-- ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY p_speakers_cong ON speakers
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
-- CREATE POLICY p_visits_cong ON visits
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);

-- ============================================================
-- RLS para users (ativar quando RLS estiver ativo)
-- ============================================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY p_users_cong ON users
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
