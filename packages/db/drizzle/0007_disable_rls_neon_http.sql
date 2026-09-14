-- Fix sync vazio: desativa RLS ativado em 0004_fase5_rls.sql.
-- Motivo: o driver Neon HTTP é stateless — cada query abre uma conexão
-- nova, então `SET app.congregation_id` (feito no middleware) não persiste
-- e `current_setting('app.congregation_id')` lança erro em TODA query das
-- tabelas com RLS. O resultado era fallback silencioso para memória:
-- confirm salvava só em memória (`persistencia: "memoria"`) e após
-- reiniciar a API o sync voltava vazio ("Sin reuniones todavía").
-- A proteção principal continua sendo o filtro app-level
-- WHERE congregation_id = :id (ver 0001/0002). Idempotente.

DROP POLICY IF EXISTS p_imports_cong ON imports;
DROP POLICY IF EXISTS p_meetings_cong ON meetings;
DROP POLICY IF EXISTS p_parts_cong ON parts;
DROP POLICY IF EXISTS p_publishers_cong ON publishers;
DROP POLICY IF EXISTS p_assignments_cong ON assignments;
DROP POLICY IF EXISTS p_warnings_meeting ON assignment_warnings;
DROP POLICY IF EXISTS p_speakers_cong ON speakers;
DROP POLICY IF EXISTS p_visits_cong ON visits;
DROP POLICY IF EXISTS p_users_cong ON users;

ALTER TABLE imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE publishers DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_warnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE speakers DISABLE ROW LEVEL SECURITY;
ALTER TABLE visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
