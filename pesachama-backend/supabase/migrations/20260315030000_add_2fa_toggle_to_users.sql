-- Add two_factor_enabled column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Update RLS policies to allow users to update their own 2FA setting if not already covered
-- (Assuming existing policies allow users to update their own profiles)
