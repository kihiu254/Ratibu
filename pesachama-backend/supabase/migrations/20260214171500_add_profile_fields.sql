-- Add bio and preferences columns to profiles table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE profiles ADD COLUMN bio TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'preferences') THEN
        ALTER TABLE profiles ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
