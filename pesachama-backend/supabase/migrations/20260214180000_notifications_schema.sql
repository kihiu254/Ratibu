-- Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own notifications
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications'
) THEN
    CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
END IF; END $$;

-- Policy: Users can update their own notifications (e.g. mark as read)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications'
) THEN
    CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
END IF; END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
