-- Sproutelle Admin Content Studio - Additive Migration: Engine Registry Config & Content Releases
-- File: 20260330000400_engine_registry_and_releases.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Adds config JSONB column to games and game_releases table for versioned offline content packs.

BEGIN;

-- 1. Ensure config JSONB exists on games table
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- 2. Create game_releases table for versioned content packs
CREATE TABLE IF NOT EXISTS public.game_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    version_number TEXT NOT NULL,
    pack_data JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.game_releases ENABLE ROW LEVEL SECURITY;

-- 3. Grants
GRANT SELECT ON TABLE public.game_releases TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.game_releases TO authenticated, service_role;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Public or Admin select game_releases" ON public.game_releases;
DROP POLICY IF EXISTS "Admins can insert game_releases" ON public.game_releases;
DROP POLICY IF EXISTS "Admins can update game_releases" ON public.game_releases;
DROP POLICY IF EXISTS "Admins can delete game_releases" ON public.game_releases;

CREATE POLICY "Public or Admin select game_releases" ON public.game_releases
    FOR SELECT USING (
        public.is_admin() OR (
            is_active = TRUE AND EXISTS (
                SELECT 1 FROM public.games g
                WHERE g.id = public.game_releases.game_id
                  AND g.is_published = TRUE
            )
        )
    );

CREATE POLICY "Admins can insert game_releases" ON public.game_releases
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update game_releases" ON public.game_releases
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete game_releases" ON public.game_releases
    FOR DELETE USING (public.is_admin());

COMMIT;
