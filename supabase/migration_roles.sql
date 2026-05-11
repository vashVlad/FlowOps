-- Migration: Soft role system
-- Roles: 'supervisor' (default) | 'worker'
-- Defaults to 'supervisor' so existing users keep full access until explicitly restricted.

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role    text NOT NULL DEFAULT 'supervisor'
          CHECK (role IN ('worker', 'supervisor'))
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own role"       ON user_roles;
DROP POLICY IF EXISTS "supervisors manage roles"  ON user_roles;

-- Users can read their own role
CREATE POLICY "users read own role" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Supervisors can manage all roles
CREATE POLICY "supervisors manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'supervisor'
    )
  );

/*
  SETUP:
  After running this migration, assign yourself as supervisor:

  INSERT INTO user_roles (user_id, role)
  VALUES ('<your-user-uuid>', 'supervisor')
  ON CONFLICT (user_id) DO UPDATE SET role = 'supervisor';

  To restrict a user to worker:
  INSERT INTO user_roles (user_id, role)
  VALUES ('<worker-user-uuid>', 'worker')
  ON CONFLICT (user_id) DO UPDATE SET role = 'worker';

  Any user with no row defaults to 'supervisor' (fail open — safe for existing deployments).
*/
