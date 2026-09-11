-- FASE 2B — DDL idempotente (publishers, assignments, assignment_warnings).
-- Espelho de packages/db/schema.ts. Aplicar depois do 0001_fase2a.sql
-- com psql ou Neon SQL Editor. Idempotente: IF NOT EXISTS.
-- Filtro app-level obrigatório (WHERE congregation_id = :id).
-- Policies RLS prontas como comentários no fim (ativar na Fase 3).

CREATE TABLE IF NOT EXISTS publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL,
  user_id UUID,
  nombre TEXT NOT NULL,
  sexo TEXT NOT NULL,
  cargo TEXT NOT NULL DEFAULT 'publicador',
  activo BOOLEAN NOT NULL DEFAULT true,
  telefono TEXT
);
CREATE INDEX IF NOT EXISTS idx_pub_cong ON publishers (congregation_id, activo);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL UNIQUE,
  meeting_id UUID NOT NULL,
  congregation_id UUID NOT NULL,
  titular_id UUID NOT NULL,
  ayudante_id UUID,
  created_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Garante titular != ajudante também no banco (além do 422 da API):
DO $$ BEGIN
  ALTER TABLE assignments ADD CONSTRAINT ck_titular_ayudante CHECK (titular_id != ayudante_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS assignment_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  publisher_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  mensaje_es TEXT NOT NULL,
  reconocido_por UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warn_meeting ON assignment_warnings (meeting_id);

-- ============================================================
-- RLS pronto para ativar (comentado na Fase 2B).
-- NÃO ativar ainda: a API usa filtro app-level.
-- Passo a passo (Fase 3): ver docs/FASE2B.md.
-- ============================================================
-- ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assignment_warnings ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY p_publishers_cong ON publishers
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
-- CREATE POLICY p_assignments_cong ON assignments
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
-- CREATE POLICY p_warnings_meeting ON assignment_warnings
--   USING (EXISTS (
--     SELECT 1 FROM meetings m
--     WHERE m.id = assignment_warnings.meeting_id
--       AND m.congregation_id = current_setting('app.congregation_id')::uuid
--   ));
