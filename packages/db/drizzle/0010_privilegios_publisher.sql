-- Fase 12: privilégios de publicadores.
-- Idempotente (IF NOT EXISTS).

-- Cabeça de família
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS cabeza_familia BOOLEAN DEFAULT false;

-- Reunião Meio de semana
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS presidente_semana BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS tesouros_discurso BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS tesouros_joias BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS tesouros_leitura BOOLEAN DEFAULT false;

-- Faça Seu Melhor no Ministério
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_iniciar BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_cultivar BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_discipulos BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_explicar BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_ajudante BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_discurso BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS ministerio_oque BOOLEAN DEFAULT false;

-- Nossa Vida Cristã
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS vida_discurso BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS vida_condutor BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS vida_leitor BOOLEAN DEFAULT false;

-- Oração
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS oracao BOOLEAN DEFAULT false;

-- Reunião Pública
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS pub_presidente BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS pub_discurso BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS pub_sentinela_condutor BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS pub_sentinela_leitor BOOLEAN DEFAULT false;
