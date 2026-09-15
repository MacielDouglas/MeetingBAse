-- Fase 32: Refatoração completa dos publicadores.
-- Adiciona campos de apellido, contacto, familia, privilegios,
-- permisos midweek/weekend, sala. Remove coluna cargo (substituída por booleans).

-- Datos personales
ALTER TABLE publishers ADD COLUMN apellido TEXT;
ALTER TABLE publishers ADD COLUMN apuntes TEXT;

-- Contacto (celular = teléfono principal, telefono = secundário)
ALTER TABLE publishers ADD COLUMN celular TEXT;

-- Familia
ALTER TABLE publishers ADD COLUMN cabeza_familia BOOLEAN DEFAULT FALSE;

-- Privilegios (substitui coluna cargo)
ALTER TABLE publishers ADD COLUMN ministro_campo TEXT;
ALTER TABLE publishers ADD COLUMN siervo BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN anciano BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN oracion BOOLEAN DEFAULT FALSE;

-- Permisos reunião entre semana
ALTER TABLE publishers ADD COLUMN presidente_entre_semana BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN discurso_entre_semana BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN busquemos_perlas BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN lectura_biblia BOOLEAN DEFAULT FALSE;

-- Enseñanzas entre semana
ALTER TABLE publishers ADD COLUMN empiece_conversaciones BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN haga_revisitas BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN haga_discipulos BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN explique_crencas BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN discurso_ensenanza BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN ayudante_ensenanza BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN analisis_auditorio BOOLEAN DEFAULT FALSE;

-- Más permisos entre semana
ALTER TABLE publishers ADD COLUMN discurso_analisis BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN ebc BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN lector_ebc BOOLEAN DEFAULT FALSE;

-- Sala
ALTER TABLE publishers ADD COLUMN sala TEXT DEFAULT 'todas';

-- Reunión fin de semana
ALTER TABLE publishers ADD COLUMN presidente_fin_semana BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN conductor_atalaya BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN lector_atalaya BOOLEAN DEFAULT FALSE;
ALTER TABLE publishers ADD COLUMN hospitalidad BOOLEAN DEFAULT FALSE;
