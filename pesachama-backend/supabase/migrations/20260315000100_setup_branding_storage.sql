-- Migration: Setup Branding Storage
-- Create a public bucket for branding assets like logos

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to branding assets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Branding assets are publicly accessible.'
    ) THEN
        CREATE POLICY "Branding assets are publicly accessible."
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'branding' );
    END IF;
END
$$;

-- Allow authenticated admins to manage branding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Admins can manage branding assets.'
    ) THEN
        CREATE POLICY "Admins can manage branding assets."
        ON storage.objects FOR ALL
        TO authenticated
        USING ( bucket_id = 'branding' );
    END IF;
END
$$;
