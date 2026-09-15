-- Fase 23: simplificar publishers (remover privilegios granulares)
-- Remove 20 colunas de privilegios + cabeza_familia da tabela publishers
-- Sexo agora é apenas M/F (hombre/mujer)

ALTER TABLE publishers DROP COLUMN IF EXISTS cabeza_familia;
ALTER TABLE publishers DROP COLUMN IF EXISTS presidente_semana;
ALTER TABLE publishers DROP COLUMN IF EXISTS tesouros_discurso;
ALTER TABLE publishers DROP COLUMN IF EXISTS tesouros_joias;
ALTER TABLE publishers DROP COLUMN IF EXISTS tesouros_leitura;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_iniciar;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_cultivar;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_discipulos;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_explicar;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_ajudante;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_discurso;
ALTER TABLE publishers DROP COLUMN IF EXISTS ministerio_oque;
ALTER TABLE publishers DROP COLUMN IF EXISTS vida_discurso;
ALTER TABLE publishers DROP COLUMN IF EXISTS vida_condutor;
ALTER TABLE publishers DROP COLUMN IF EXISTS vida_leitor;
ALTER TABLE publishers DROP COLUMN IF EXISTS oracao;
ALTER TABLE publishers DROP COLUMN IF EXISTS pub_presidente;
ALTER TABLE publishers DROP COLUMN IF EXISTS pub_discurso;
ALTER TABLE publishers DROP COLUMN IF EXISTS pub_sentinela_condutor;
ALTER TABLE publishers DROP COLUMN IF EXISTS pub_sentinela_leitor;
