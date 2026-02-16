-- Migration: Add Profile fields and setup Avatars Storage

-- 1. Update Users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Setup Storage for Avatars
-- Note: This assumes the storage schema exists (standard in Supabase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the avatars bucket
-- Allow public read access
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload to the avatars bucket
CREATE POLICY "Users can upload their own avatar."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update/delete their own avatars
CREATE POLICY "Users can update their own avatar."
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar."
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
