-- Sproutelle Admin Content Studio - Additive Migration: Homescreen Explorer Subcategories
-- File: 20260330000200_add_homescreen_explorer_subcategories.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Adds the 'homescreen_explorer_subcategories' table, RLS policies, grants,
-- and updates is_published_media_asset helper to support subcategory images.

BEGIN;

-- 1. Create homescreen_explorer_subcategories table
CREATE TABLE IF NOT EXISTS public.homescreen_explorer_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    explorer_id UUID NOT NULL REFERENCES public.homescreen_explorer(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    background_color TEXT NOT NULL DEFAULT '#FFF0F3',
    category_id UUID REFERENCES public.game_categories(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.homescreen_explorer_subcategories ENABLE ROW LEVEL SECURITY;

-- 2. Grant table privileges
GRANT SELECT ON TABLE public.homescreen_explorer_subcategories TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.homescreen_explorer_subcategories TO authenticated, service_role;

-- 3. Update is_published_media_asset helper to grant storage access for active subcategory card icons
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
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.homescreen_explorer_subcategories sub ON sub.image_asset_id = ma.id
        JOIN public.homescreen_explorer he ON sub.explorer_id = he.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'game-assets'
          AND sub.is_active = TRUE AND he.is_active = TRUE
    );
END;
$$;

-- 4. Create RLS Policies for homescreen_explorer_subcategories
DROP POLICY IF EXISTS "Public or Admin select homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories;
DROP POLICY IF EXISTS "Admins can insert homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories;
DROP POLICY IF EXISTS "Admins can update homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories;
DROP POLICY IF EXISTS "Admins can delete homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories;

CREATE POLICY "Public or Admin select homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories
    FOR SELECT USING (
        public.is_admin() OR (
            is_active = TRUE AND EXISTS (
                SELECT 1 FROM public.homescreen_explorer he
                WHERE he.id = public.homescreen_explorer_subcategories.explorer_id
                  AND he.is_active = TRUE
            )
        )
    );

CREATE POLICY "Admins can insert homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete homescreen_explorer_subcategories" ON public.homescreen_explorer_subcategories
    FOR DELETE USING (public.is_admin());

COMMIT;
