-- Migration: Phase 1 - Customer Unification
-- Description: Unifies profiles and customers into a single authoritative tenancy layer.

BEGIN;

-- 1. Ensure 'customers' table has all necessary fields from 'profiles'
-- If 'customers' table doesn't exist (it was definition-only in previous audits), create it.
-- Based on models.py, we have a 'profiles' table that is the actual one used by Supabase.

-- Strategy: Rename 'profiles' to 'customers' to make it the official tenant table.
-- First, drop the unused 'customers' table if it exists as a shell.
DROP TABLE IF EXISTS public.customers CASCADE;

-- Rename profiles to customers
ALTER TABLE public.profiles RENAME TO customers;

-- 2. Update foreign keys in dependent tables
-- The hierarchy: Zone -> Community -> Customer -> Device
-- devices.user_id currently points to profiles(id). 
-- This ID is the Supabase Auth UID.

-- Add alias or comments for clarity
COMMENT ON TABLE public.customers IS 'Authoritative tenant/customer table. ID matches Supabase Auth UID.';

-- 3. Ensure devices.user_id is renamed for clarity to customers_id or kept as is if preferred.
-- We will keep it as user_id for now to avoid breaking existing code, but add a comment.
COMMENT ON COLUMN public.devices.user_id IS 'References the customer (formerly profile) who owns this device.';

COMMIT;
