-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Roles v2 migration
-- Upgrades user_roles from single-role-per-user to multi-role junction table.
--
-- Run AFTER migration_roles.sql has been applied.
--
-- What changes:
--   • user_id is no longer the sole PK — (user_id, role) is the composite PK
--   • Role values expanded: admin | front_desk | unpacker | sorter | lotter | pickup
--   • is_default boolean added — which role the user lands on at login
--   • RLS policies updated to use 'admin' instead of 'supervisor'
--
-- Breaking: drops and recreates user_roles. Re-assign roles after running.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop old policies and table
DROP POLICY IF EXISTS "users read own role"      ON user_roles;
DROP POLICY IF EXISTS "supervisors manage roles" ON user_roles;
DROP TABLE IF EXISTS user_roles;

-- ── New table ─────────────────────────────────────────────────────────────────

CREATE TABLE user_roles (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN (
               'admin', 'front_desk', 'unpacker', 'sorter', 'lotter', 'pickup'
             )),
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

COMMENT ON TABLE  user_roles            IS 'Granted roles per user. One row per (user, role) pair.';
COMMENT ON COLUMN user_roles.is_default IS 'The role this user starts with after login. At most one true per user.';

-- Enforces at most one default role per user
CREATE UNIQUE INDEX user_roles_one_default_per_user
  ON user_roles (user_id)
  WHERE is_default = true;

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all role assignments (needed for role switcher)
CREATE POLICY "authenticated read" ON user_roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can write role assignments
-- Uses SECURITY DEFINER to avoid recursive RLS check
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "admin write" ON user_roles
  FOR ALL USING (is_admin());

-- ── Bootstrap ─────────────────────────────────────────────────────────────────
-- After running this migration, assign yourself as admin:
--
--   INSERT INTO user_roles (user_id, role, is_default)
--   VALUES ('<your-user-uuid>', 'admin', true);
--
-- Grant multiple roles to a user (e.g., lotter who can also sort):
--
--   INSERT INTO user_roles (user_id, role, is_default) VALUES
--     ('<uuid>', 'lotter',  true),   -- default role
--     ('<uuid>', 'sorter',  false);
--
-- Revoke a role:
--   DELETE FROM user_roles WHERE user_id = '<uuid>' AND role = 'sorter';
