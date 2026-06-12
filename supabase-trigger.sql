-- Trigger function to automatically create a profile when a new user registers
-- Run this in your Supabase SQL Editor: Dashboard > SQL Editor > New Query > Paste & Run

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER -- Runs with superuser privileges, bypassing RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 0;
BEGIN
  -- Generate a base username from email (e.g. john from john@example.com)
  base_username := REGEXP_REPLACE(SPLIT_PART(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g');
  IF base_username = '' THEN
    base_username := 'user';
  END IF;
  
  final_username := base_username;
  
  -- Resolve username uniqueness conflicts by appending a number if necessary
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, email, username, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    final_username,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', final_username),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Prevent trigger failures from blocking user registration completely
  RETURN new;
END;
$$;

-- Bind the trigger to run after a new user insert in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
