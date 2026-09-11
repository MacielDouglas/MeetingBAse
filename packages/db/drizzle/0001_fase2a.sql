-- FASE 2A — DDL idempotente (imports, meetings, parts).
-- Espejo de packages/db/schema.ts. Sala siempre "A" (default).
-- Aplicar con psql o Neon SQL Editor. Idempotente: IF NOT EXISTS.
-- Estrategia RLS: empieza con congregation_id + filtro app-level
-- obligatorio (WHERE congregation_id = :id en todo query).
-- Las policies RLS listas estan abajo como comentarios: desmarcar
-- cuando el rol de la API use SET app.congregation_id por request.
-- (Futuro: 1 proyecto Neon por congregacion via API.)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL,
  filename TEXT NOT NULL,
  kind TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'preview',
  weeks_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imports_cong ON imports (congregation_id);

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL,
  import_id UUID,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL,
  lectura_semanal TEXT,
  cancion_inicial INTEGER,
  cancion_intermedia INTEGER,
  cancion_final INTEGER,
  titulo_atalaya TEXT,
  semana_label TEXT,
  estado TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (congregation_id, fecha, tipo)
);

CREATE TABLE IF NOT EXISTS parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  congregation_id UUID NOT NULL,
  orden INTEGER NOT NULL,
  seccion TEXT NOT NULL,
  tipo_clave TEXT NOT NULL,
  titulo TEXT NOT NULL,
  detalle TEXT,
  duracion_min INTEGER,
  sala TEXT NOT NULL DEFAULT 'A',
  requiere_ayudante BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (meeting_id, orden)
);
-- CHECK sala fija (solo A):
-- ALTER TABLE parts ADD CONSTRAINT ck_sala_a CHECK (sala = 'A');

-- ============================================================
-- RLS listo para activar (comentado en Fase 2A).
-- Filtro app-level obligatorio mientras tanto:
--   WHERE congregation_id = :congregationId en todo query.
-- ============================================================
-- ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY p_imports_cong ON imports
--   USING (congregation_id = current_setting('app.congregation_id')::uuid);
-- CREATE POLICY p_meetings_cong ON meetings
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
-- CREATE POLICY p_parts_cong ON parts
--   USING (congregation_id = current_setting('app.congregation_id')::uuid)
--   WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
