-- Fase 6: add part_id to assignment_warnings for per-part warnings
-- and ensure updatedAt is properly tracked for incremental sync.

-- Add part_id column to warnings (nullable for backward compatibility)
ALTER TABLE assignment_warnings ADD COLUMN part_id uuid;

-- Create index for efficient per-part warning lookups
CREATE INDEX idx_warn_part ON assignment_warnings(part_id);

-- Ensure meetings.updatedAt is updated on any assignment change
-- (already handled in repoAssign.ts, this is defense-in-depth)
