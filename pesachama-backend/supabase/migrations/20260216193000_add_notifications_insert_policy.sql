-- Migration: Add INSERT policy for notifications
-- This allows authenticated users to create notifications for themselves.

CREATE POLICY "Users can insert their own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);
