-- FASE 5 — RLS activation (defense-in-depth with app-level filtering).
-- This migration enables RLS policies as a safety net.
-- The app still uses WHERE congregation_id = :id as the primary filter.
-- RLS provides an additional layer of protection.

-- Enable RLS on all tables
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for congregation-scoped tables
DO $$ BEGIN
  CREATE POLICY p_imports_cong ON imports
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_meetings_cong ON meetings
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_parts_cong ON parts
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_publishers_cong ON publishers
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_assignments_cong ON assignments
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- assignment_warnings: check via JOIN with meetings (no congregation_id column)
DO $$ BEGIN
  CREATE POLICY p_warnings_meeting ON assignment_warnings
    USING (EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = assignment_warnings.meeting_id
        AND m.congregation_id = current_setting('app.congregation_id')::uuid
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_speakers_cong ON speakers
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_visits_cong ON visits
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY p_users_cong ON users
    USING (congregation_id = current_setting('app.congregation_id')::uuid)
    WITH CHECK (congregation_id = current_setting('app.congregation_id')::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
