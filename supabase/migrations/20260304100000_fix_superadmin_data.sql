-- ============================================================
-- Migration: Fix superadmin data placement
-- Date: 2026-03-04
-- Problem: Superadmin users were inserted into `customers`
--          with role='superadmin' instead of the `superadmin` table.
-- Fix:     Copy those rows into `superadmin`, then remove from `customers`.
-- ============================================================

BEGIN;

-- 1. Insert superadmin users from customers into superadmin table
--    (skip any that already exist by id or email)
INSERT INTO public.superadmin (id, email, display_name, created_at, updated_at)
SELECT
    id,
    email,
    COALESCE(display_name, full_name, email) AS display_name,
    created_at,
    updated_at
FROM public.customers
WHERE role IN ('superadmin', 'super_admin')
ON CONFLICT (id) DO UPDATE
    SET email        = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.superadmin.display_name),
        updated_at   = NOW();

-- 2. Remove those rows from customers
DELETE FROM public.customers
WHERE role IN ('superadmin', 'super_admin');

COMMIT;
