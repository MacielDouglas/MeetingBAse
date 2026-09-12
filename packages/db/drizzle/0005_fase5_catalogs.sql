-- Fase 5: persistent catalogs for sjj (songs) and S-34 (public talks)
-- These replace the in-memory Maps used during server restarts.

-- If table exists with wrong column types (TEXT instead of UUID), drop it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalogs' AND column_name = 'congregation_id' AND data_type = 'text'
  ) THEN
    DROP TABLE IF EXISTS catalogs CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS catalogs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL REFERENCES congregations(id),
  kind          TEXT NOT NULL CHECK (kind IN ('sjj', 's34')),
  data          JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One catalog per congregation per kind (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS catalogs_cong_kind_idx
  ON catalogs (congregation_id, kind);
