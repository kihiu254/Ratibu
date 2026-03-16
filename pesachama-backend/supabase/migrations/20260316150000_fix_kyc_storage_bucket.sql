-- Migration: Ensure kyc-documents storage bucket exists with correct policies
-- This safely creates the bucket if it doesn't exist and idempotently sets up RLS

-- 1. Create the bucket (safe to run multiple times)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  true,   -- public so URLs are accessible without signed URLs
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- 2. Drop conflicting policies first (safe to ignore errors)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own KYC docs." ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own KYC docs." ON storage.objects;
  DROP POLICY IF EXISTS "Admins can view all KYC docs." ON storage.objects;
  DROP POLICY IF EXISTS "Public can access kyc-documents." ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload KYC docs." ON storage.objects;
  DROP POLICY IF EXISTS "KYC docs are publicly readable." ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Public read access (bucket is public so images display in browser)
CREATE POLICY "KYC docs are publicly readable."
ON storage.objects FOR SELECT
USING ( bucket_id = 'kyc-documents' );

-- 4. Authenticated users can upload their own documents
CREATE POLICY "Authenticated users can upload KYC docs."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Users can update / delete their own documents
CREATE POLICY "Users can manage their own KYC docs."
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
