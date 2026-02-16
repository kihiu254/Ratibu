-- Migration: Create Notifications Table (v2 - Clean)
-- This migration drops the old notifications table if it exists and recreates it
-- to match the current schema (users instead of profiles).

DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
    is_read BOOLEAN DEFAULT false,
    link TEXT, -- Optional link to navigate to
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Helper function to push notification
CREATE OR REPLACE FUNCTION public.push_notification(
    _user_id UUID,
    _title TEXT,
    _message TEXT,
    _type TEXT DEFAULT 'info',
    _link TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (_user_id, _title, _message, _type, _link);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
