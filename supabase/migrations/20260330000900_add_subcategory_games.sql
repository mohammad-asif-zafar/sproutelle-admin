-- Sproutelle Admin Content Studio - Additive Migration: Subcategory Games & Patterns Junction Table
-- File: 20260330000900_add_subcategory_games.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Creates public.subcategory_games to support multiple games per subcategory,
-- per-game pattern configurations, stable sort order, and active toggles.

BEGIN;

-- 1. Create subcategory_games junction table
CREATE TABLE IF NOT EXISTS public.subcategory_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_id UUID NOT NULL REFERENCES public.homescreen_explorer_subcategories(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    enabled_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subcategory_games_unique_assignment UNIQUE (subcategory_id, game_id)
);

-- Enable RLS
ALTER TABLE public.subcategory_games ENABLE ROW LEVEL SECURITY;

-- 2. Grants
GRANT SELECT ON TABLE public.subcategory_games TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.subcategory_games TO authenticated, service_role;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Public or Admin select subcategory_games" ON public.subcategory_games;
DROP POLICY IF EXISTS "Admins can insert subcategory_games" ON public.subcategory_games;
DROP POLICY IF EXISTS "Admins can update subcategory_games" ON public.subcategory_games;
DROP POLICY IF EXISTS "Admins can delete subcategory_games" ON public.subcategory_games;

CREATE POLICY "Public or Admin select subcategory_games" ON public.subcategory_games
    FOR SELECT USING (
        public.is_admin() OR (
            is_active = TRUE AND EXISTS (
                SELECT 1 FROM public.homescreen_explorer_subcategories sub
                JOIN public.homescreen_explorer he ON he.id = sub.explorer_id
                WHERE sub.id = public.subcategory_games.subcategory_id
                  AND sub.is_active = TRUE
                  AND he.is_active = TRUE
            )
        )
    );

CREATE POLICY "Admins can insert subcategory_games" ON public.subcategory_games
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update subcategory_games" ON public.subcategory_games
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete subcategory_games" ON public.subcategory_games
    FOR DELETE USING (public.is_admin());

COMMIT;
