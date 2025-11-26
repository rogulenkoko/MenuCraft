-- Add credits system columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_activated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS menu_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_generated INTEGER DEFAULT 0;

-- Update existing profiles to have default values
UPDATE profiles SET 
  has_activated = COALESCE(has_activated, FALSE),
  menu_credits = COALESCE(menu_credits, 0),
  total_generated = COALESCE(total_generated, 0);
