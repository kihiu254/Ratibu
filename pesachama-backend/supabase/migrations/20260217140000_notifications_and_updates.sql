-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Create app_updates table for OTA-like checks
CREATE TABLE IF NOT EXISTS public.app_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    build_number INT NOT NULL,
    release_notes TEXT,
    download_url TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT false,
    platform TEXT DEFAULT 'android',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Public read access for updates
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can check for updates" ON public.app_updates;
CREATE POLICY "Anyone can check for updates"
    ON public.app_updates FOR SELECT
    USING (true);
