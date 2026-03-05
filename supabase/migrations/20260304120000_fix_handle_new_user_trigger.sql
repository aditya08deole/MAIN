-- Migration: Fix handle_new_user() trigger function
-- Problem: The trigger was trying to INSERT into public.profiles (which doesn't
--          exist in this project) OR triggers a CHECK CONSTRAINT violation on
--          public.customers (profiles_customer_community_check requires community_id,
--          which is not known at auth user creation time).
-- Result:  Every supabase.auth.admin.create_user() call failed with
--          "Database error creating new user".
-- Fix:     Make handle_new_user() a safe no-op. The EvaraTech backend
--          (server/routers/admin.py) creates the customers row directly after
--          auth user creation with all required fields including community_id.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- No-op: EvaraTech backend creates the customers row directly.
  -- (Trigger definition preserved to avoid breaking on_auth_user_created trigger)
  RETURN new;
END;
$$;
