-- =========================================================================
-- EVARATECH ENTERPRISE HIERARCHY
-- =========================================================================
-- This script ensures the pure, absolute relationship between 
-- [ZONES -> COMMUNITIES -> CUSTOMERS -> DEVICES] 
-- without explicitly requiring isolated tables like "distributors" 
-- which clutter the database.
-- =========================================================================

-- 1. Tighten the user table to enforce Roles
-- Distributors and Customers exist harmoniously in `users`.
-- They are defined cleanly through constraints rather than empty tables.
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS valid_user_roles;

ALTER TABLE public.users 
ADD CONSTRAINT valid_user_roles 
CHECK (role IN ('superadmin', 'admin', 'distributor', 'customer', 'engineer', 'technician'));

-- 2. Create an Enterprise Admin View for Distributors
-- This allows you to easily query Distributors inside Supabase 
-- as if they were a real table, without destroying the Auth Architecture.
CREATE OR REPLACE VIEW public.distributors_view AS 
    SELECT 
        id as distributor_id, 
        email, 
        display_name, 
        full_name,
        phone_number,
        status,
        created_at
    FROM public.users
    WHERE role = 'distributor';

-- 3. Create an Enterprise Customer View 
CREATE OR REPLACE VIEW public.customers_view AS 
    SELECT 
        u.id as customer_id, 
        u.email, 
        u.full_name,
        u.phone_number,
        c.name as community_name,
        r.name as zone_name
    FROM public.users u
    LEFT JOIN public.communities c ON u.community_id = c.id
    LEFT JOIN public.regions r ON c.region_id = r.id
    WHERE u.role = 'customer';

-- 4. Foreign Key Constraints & Cascades
-- Ensures when a Zone dies, Communities die, meaning devices become orphaned natively.
ALTER TABLE public.communities 
DROP CONSTRAINT IF EXISTS communities_region_id_fkey;

ALTER TABLE public.communities 
ADD CONSTRAINT communities_region_id_fkey 
FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;

-- Ensure users inside a community handle deletion safely
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_community_id_fkey;

ALTER TABLE public.users 
ADD CONSTRAINT users_community_id_fkey 
FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;

-- 5. Deep Device Hierarchy Security (RLS Preparation)
-- Create explicit indices targeting these foreign keys to dramatically
-- speed up map loading arrays and Dashboard queries when spanning
-- thousands of assets across Zones.
CREATE INDEX IF NOT EXISTS idx_devices_community ON public.devices(community_id);
CREATE INDEX IF NOT EXISTS idx_devices_customer ON public.devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_community ON public.users(community_id);
CREATE INDEX IF NOT EXISTS idx_communities_region ON public.communities(region_id);
