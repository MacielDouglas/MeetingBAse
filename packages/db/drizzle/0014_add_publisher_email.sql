-- Migration 0014: Adiciona campo email a publishers
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS email TEXT;
