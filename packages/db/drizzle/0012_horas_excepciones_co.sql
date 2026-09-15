-- Fase 22: horários das partes (hora_fin), semanas com exceções, visita CO
-- Adiciona hora_fin na tabela parts
ALTER TABLE parts ADD COLUMN hora_fin text;

-- Adiciona excepcion e visita_co na tabela meetings
ALTER TABLE meetings ADD COLUMN excepcion text; -- null=normal, 'convencao', 'sin_reunion', 'convencao_virtual'
ALTER TABLE meetings ADD COLUMN visita_co boolean DEFAULT false;
