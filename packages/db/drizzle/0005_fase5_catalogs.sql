-- Fase 5: persistent catalogs for sjj (songs) and S-34 (public talks)
-- These replace the in-memory Maps used during server restarts.

CREATE TABLE IF NOT EXISTS catalogs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  congregation_id TEXT NOT NULL REFERENCES congregations(id),
  kind          TEXT NOT NULL CHECK (kind IN ('sjj', 's34')),
  data          JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One catalog per congregation per kind (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS catalogs_cong_kind_idx
  ON catalogs (congregation_id, kind);
