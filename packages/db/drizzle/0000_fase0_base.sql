-- FASE 0 — DDL idempotente: congregations + users.
-- Base para todas as outras tabelas. Aplicar antes de 0001_fase2a.sql.
-- Idempotente: IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Congregações
CREATE TABLE IF NOT EXISTS congregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  numero TEXT,
  circuito TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Santiago',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usuários (ligados a uma congregação)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL REFERENCES congregations(id),
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'publicador',
  password_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
