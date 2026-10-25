-- Sproutelle Admin Content Studio - Additive Migration: Homescreen Explorer Cards
-- File: 20260330000100_add_homescreen_explorer.sql
--
-- SAFE ADDITIVE MIGRATION:
-- This script safely adds the 'homescreen_explorer' table, RLS policies, and grants
-- to an existing database without dropping existing tables or truncating data.

BEGIN;

-- 1. Create homescreen_explorer table
CREATE TABLE IF NOT EXISTS public.homescreen_explorer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_name TEXT NOT NULL,
    title_image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    background_color TEXT NOT NULL DEFAULT '#FFF0F3',
    category_id UUID REFERENCES public.game_categories(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.homescreen_explorer ENABLE ROW LEVEL SECURITY;

-- 2. Grant table privileges
GRANT SELECT ON TABLE public.homescreen_explorer TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.homescreen_explorer TO authenticated, service_role;

-- 3. Update is_published_media_asset helper to grant storage access for active explorer card icons
CREATE OR REPLACE FUNCTION public.is_published_media_asset(p_file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.questions q ON (q.image_asset_id = ma.id OR q.audio_asset_id = ma.id)
        JOIN public.games g ON q.game_id = g.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'game-assets'
          AND q.is_draft = FALSE AND g.is_published = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.question_options qo ON qo.media_asset_id = ma.id
        JOIN public.questions q ON qo.question_id = q.id
        JOIN public.games g ON q.game_id = g.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'game-assets'
          AND q.is_draft = FALSE AND g.is_published = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.game_categories gc ON gc.icon_asset_id = ma.id
        JOIN public.games g ON g.category_id = gc.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'game-assets'
          AND g.is_published = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.homescreen_explorer he ON he.title_image_asset_id = ma.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'game-assets'
          AND he.is_active = TRUE
    );
END;
$$;

-- 4. Create RLS Policies for homescreen_explorer
DROP POLICY IF EXISTS "Public or Admin select homescreen_explorer" ON public.homescreen_explorer;
DROP POLICY IF EXISTS "Admins can insert homescreen_explorer" ON public.homescreen_explorer;
DROP POLICY IF EXISTS "Admins can update homescreen_explorer" ON public.homescreen_explorer;
DROP POLICY IF EXISTS "Admins can delete homescreen_explorer" ON public.homescreen_explorer;

CREATE POLICY "Public or Admin select homescreen_explorer" ON public.homescreen_explorer
    FOR SELECT USING (public.is_admin() OR is_active = TRUE);

CREATE POLICY "Admins can insert homescreen_explorer" ON public.homescreen_explorer
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update homescreen_explorer" ON public.homescreen_explorer
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete homescreen_explorer" ON public.homescreen_explorer
    FOR DELETE USING (public.is_admin());

COMMIT;
