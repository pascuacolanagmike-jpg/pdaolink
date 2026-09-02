-- Create PDAOLink database schema
-- Tables: profiles, applications, documents, announcements, notifications, status_logs
-- RLS enabled on all tables with role-based policies (client vs admin)

-- Profiles: extends auth.users with role (client/admin) and demographic fields
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fullname text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client','admin')),
  contact_number text,
  address text,
  birth_date date,
  gender text,
  civil_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Applications: a PWD registration application submitted by a client
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Pending',
  submission_date timestamptz DEFAULT now(),
  last_updated timestamptz DEFAULT now(),
  remarks text DEFAULT '',
  -- Personal information
  first_name text,
  middle_name text,
  last_name text,
  suffix text,
  birth_date date,
  gender text,
  civil_status text,
  address text,
  contact_number text,
  email text,
  -- PWD information
  disability_type text,
  disability_cause text,
  blood_type text,
  occupation text,
  education text,
  -- Emergency contact
  emergency_name text,
  emergency_relationship text,
  emergency_contact_number text,
  emergency_address text,
  -- Representative
  representative_name text,
  representative_relationship text,
  representative_contact text,
  -- Government IDs
  pwd_id_number text,
  philsys_id text,
  other_gov_id_type text,
  other_gov_id_number text
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Clients see only their own applications; admins see all
DROP POLICY IF EXISTS "applications_select" ON applications;
CREATE POLICY "applications_select" ON applications FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "applications_insert_own" ON applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "applications_update_own" ON applications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Documents: files attached to an application (path references Supabase Storage)
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select" ON documents FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM applications WHERE applications.id = documents.application_id AND applications.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "documents_insert_own" ON documents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM applications WHERE applications.id = documents.application_id AND applications.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "documents_delete_own" ON documents FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM applications WHERE applications.id = documents.application_id AND applications.user_id = auth.uid())
  );

-- Announcements: published by admin, visible to all authenticated users
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_all" ON announcements;
CREATE POLICY "announcements_select_all" ON announcements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "announcements_admin_insert" ON announcements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "announcements_admin_update" ON announcements FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "announcements_admin_delete" ON announcements FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Notifications: per-user messages
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Status logs: audit trail for application status changes
CREATE TABLE IF NOT EXISTS status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  remarks text DEFAULT '',
  changed_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_logs_select" ON status_logs;
CREATE POLICY "status_logs_select" ON status_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM applications WHERE applications.id = status_logs.application_id AND applications.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "status_logs_admin_insert" ON status_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_status_logs_application_id ON status_logs(application_id);
