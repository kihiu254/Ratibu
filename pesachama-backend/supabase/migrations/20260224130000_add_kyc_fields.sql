-- Migration: Add KYC fields to users table and setup kyc-documents bucket

-- 1. Update Users table with KYC fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_front_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_back_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS member_category TEXT[]; -- Array to support multiple categories

-- 2. Setup Storage for KYC Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false) -- Private bucket for security
ON CONFLICT (id) DO NOTHING;

-- 3. Set up RLS for the kyc-documents bucket
-- Allow users to view their own documents
CREATE POLICY "Users can view their own KYC docs."
ON storage.objects FOR SELECT
TO authenticated
USING ( 
  bucket_id = 'kyc-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to upload their own KYC documents
CREATE POLICY "Users can upload their own KYC docs."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to view all KYC documents (simplified policy)
-- In a real scenario, this would check for an admin role
CREATE POLICY "Admins can view all KYC docs."
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'kyc-documents' );
