-- Sproutelle Admin Content Studio Database Migration
-- Version: 20260330000000_initial_schema.sql
--
-- TARGET ENVIRONMENT & SAFETY WARNING:
-- This script is designed for initializing a NEW, EMPTY Supabase project ('sproutelle-admin').
-- Do not run against existing mobile app databases or production databases without a reviewed migration plan.
-- 'CREATE TABLE IF NOT EXISTS' alone does not make a migration safe for altered schemas.
--
-- TRANSACTION & RECOVERY GUIDELINES:
-- The entire migration is enclosed in a BEGIN; ... COMMIT; block.
-- If any statement fails during execution in the Supabase SQL Editor or Supabase CLI,
-- PostgreSQL will automatically ROLLBACK the entire transaction.
-- If an error occurs, inspect the error message, correct the statement, and re-run.
--
-- FIRST ADMIN ENROLLMENT BOOTSTRAP PROCEDURE:
-- 1. Sign in once with the GitHub account that should become the first administrator.
-- 2. In Supabase Dashboard -> Authentication -> Users, copy that account's auth user UUID and verified email.
-- 3. Run the following SQL in Supabase SQL Editor:
--    INSERT INTO public.admin_users (id, email, is_admin)
--    SELECT id, email, TRUE
--    FROM auth.users
--    WHERE id = 'REPLACE-WITH-AUTH-USER-UUID'::uuid
--      AND email = 'REPLACE-WITH-VERIFIED-EMAIL'
--    ON CONFLICT (id)
--    DO UPDATE SET email = EXCLUDED.email, is_admin = TRUE;

BEGIN;

-- Enable required UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. ADMIN USERS TABLE & HARDENED SECURITY DEFINER HELPERS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Hardened Security Definer function to check if current user is an authorized admin.
-- SET search_path = '' forces fully qualified object references (public.admin_users, auth.uid)
-- preventing search_path manipulation attacks.
-- Since this function runs as SECURITY DEFINER owned by postgres, it reads public.admin_users
-- directly with owner privileges, bypassing RLS recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE id = (SELECT auth.uid()) AND is_admin = TRUE
    );
END;
$$;

-- Set explicit function ownership and restricted execution scope
ALTER FUNCTION public.is_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

--------------------------------------------------------------------------------
-- 2. APPLICATION CONTENT TABLES & WRITE-TIME CONSTRAINTS
--------------------------------------------------------------------------------

-- Media Assets
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    bucket_name TEXT NOT NULL DEFAULT 'game-assets',
    file_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Game Categories
CREATE TABLE IF NOT EXISTS public.game_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_categories ENABLE ROW LEVEL SECURITY;

-- Games
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.game_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    game_type TEXT NOT NULL DEFAULT 'multiple_choice',
    is_published BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Game Levels
CREATE TABLE IF NOT EXISTS public.game_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    level_number INT NOT NULL,
    title TEXT,
    description TEXT,
    pass_score INT DEFAULT 100,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT game_levels_id_game_id_key UNIQUE (id, game_id)
);

ALTER TABLE public.game_levels ENABLE ROW LEVEL SECURITY;

-- Trigger Function: Prevents changing game_id on game_levels if questions reference the level
CREATE OR REPLACE FUNCTION public.validate_game_level_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.game_id IS DISTINCT FROM NEW.game_id THEN
        -- Lock any existing questions attached to this level to prevent concurrent question updates
        IF EXISTS (
            SELECT 1
            FROM public.questions
            WHERE level_id = OLD.id
            FOR UPDATE
        ) THEN
            RAISE EXCEPTION 'Cannot change game_id for level %: questions are attached to this level', OLD.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_game_level_update() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_validate_game_level_update ON public.game_levels;
CREATE TRIGGER trg_validate_game_level_update
    BEFORE UPDATE ON public.game_levels
    FOR EACH ROW EXECUTE FUNCTION public.validate_game_level_update();

-- Questions
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    level_id UUID REFERENCES public.game_levels(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice',
    instructions TEXT,
    sort_order INT DEFAULT 0,
    is_draft BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    audio_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_questions_level_game FOREIGN KEY (level_id, game_id)
        REFERENCES public.game_levels(id, game_id) ON UPDATE CASCADE
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Trigger Function: Ensures level_id belongs to the same game_id as questions.game_id on write
CREATE OR REPLACE FUNCTION public.validate_question_level_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_level_game_id UUID;
BEGIN
    IF NEW.level_id IS NOT NULL THEN
        -- Acquiring FOR KEY SHARE on game_levels row forces serialization against concurrent game_level updates
        SELECT game_id INTO v_level_game_id
        FROM public.game_levels
        WHERE id = NEW.level_id
        FOR KEY SHARE;

        IF v_level_game_id IS NULL THEN
            RAISE EXCEPTION 'Level % does not exist', NEW.level_id;
        ELSIF v_level_game_id IS DISTINCT FROM NEW.game_id THEN
            RAISE EXCEPTION 'Level % belongs to Game %, but Question specifies Game %', NEW.level_id, v_level_game_id, NEW.game_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_question_level_game() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_validate_question_level_game ON public.questions;
CREATE TRIGGER trg_validate_question_level_game
    BEFORE INSERT OR UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.validate_question_level_game();

-- Question Options (Base table contains answer key is_correct; direct table access revoked from anon)
CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

-- Activity Media Relations
CREATE TABLE IF NOT EXISTS public.activity_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID REFERENCES public.media_assets(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    usage_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_media ENABLE ROW LEVEL SECURITY;

-- Game Versions
CREATE TABLE IF NOT EXISTS public.game_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number TEXT NOT NULL UNIQUE,
    release_notes TEXT,
    min_app_version TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_versions ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3. EXPLICIT TABLE GRANTS & PERMISSIONS
--------------------------------------------------------------------------------

-- Revoke all default public/anon table privileges on sensitive tables
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO service_role;

REVOKE ALL ON TABLE public.question_options FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_options TO authenticated, service_role;

-- Grant table level permissions for content delivery & management
GRANT SELECT ON TABLE public.media_assets, public.game_categories, public.games, public.game_levels, public.questions, public.activity_media, public.game_versions TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.media_assets, public.game_categories, public.games, public.game_levels, public.questions, public.activity_media, public.game_versions TO authenticated, service_role;

--------------------------------------------------------------------------------
-- 4. PUBLIC CONTENT ACCESS VIEW & PUBLISHED MEDIA HELPER
--------------------------------------------------------------------------------

-- Public view for mobile clients that exposes options WITHOUT revealing answer keys (is_correct).
-- Evaluated with owner (postgres) privileges so anonymous users can read options for published games
-- without requiring direct SELECT access to the base question_options table.
CREATE OR REPLACE VIEW public.published_question_options AS
SELECT
    qo.id,
    qo.question_id,
    qo.option_text,
    qo.sort_order,
    qo.media_asset_id,
    qo.created_at
FROM public.question_options qo
JOIN public.questions q ON qo.question_id = q.id
JOIN public.games g ON q.game_id = g.id
WHERE q.is_draft = FALSE AND g.is_published = TRUE;

GRANT SELECT ON public.published_question_options TO anon, authenticated, service_role;

-- Hardened SECURITY DEFINER helper function to check if a file path in game-assets belongs to genuinely published content.
-- Allows storage policies and media asset queries to safely evaluate access across admin-only tables
-- without requiring anon table SELECT privileges on question_options.
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
    );
END;
$$;

ALTER FUNCTION public.is_published_media_asset(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_published_media_asset(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_published_media_asset(TEXT) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES & OBSOLETE POLICY CLEANUP
--------------------------------------------------------------------------------

-- Clean up any obsolete policy names across migration iterations
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Users can view own admin row or admins view all" ON public.admin_users;
DROP POLICY IF EXISTS "Users can view own admin_users record" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;

DROP POLICY IF EXISTS "Allow public select for media_assets" ON public.media_assets;
DROP POLICY IF EXISTS "Public or Admin select media_assets" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can insert media_assets" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can update media_assets" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can delete media_assets" ON public.media_assets;

DROP POLICY IF EXISTS "Allow public select for game_categories" ON public.game_categories;
DROP POLICY IF EXISTS "Public or Admin select game_categories" ON public.game_categories;
DROP POLICY IF EXISTS "Admins can insert game_categories" ON public.game_categories;
DROP POLICY IF EXISTS "Admins can update game_categories" ON public.game_categories;
DROP POLICY IF EXISTS "Admins can delete game_categories" ON public.game_categories;

DROP POLICY IF EXISTS "Allow public select for games" ON public.games;
DROP POLICY IF EXISTS "Public or Admin select games" ON public.games;
DROP POLICY IF EXISTS "Admins can insert games" ON public.games;
DROP POLICY IF EXISTS "Admins can update games" ON public.games;
DROP POLICY IF EXISTS "Admins can delete games" ON public.games;

DROP POLICY IF EXISTS "Allow public select for game_levels" ON public.game_levels;
DROP POLICY IF EXISTS "Public or Admin select game_levels" ON public.game_levels;
DROP POLICY IF EXISTS "Admins can insert game_levels" ON public.game_levels;
DROP POLICY IF EXISTS "Admins can update game_levels" ON public.game_levels;
DROP POLICY IF EXISTS "Admins can delete game_levels" ON public.game_levels;

DROP POLICY IF EXISTS "Allow public select for published questions" ON public.questions;
DROP POLICY IF EXISTS "Public or Admin select questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;

DROP POLICY IF EXISTS "Allow public select for question_options" ON public.question_options;
DROP POLICY IF EXISTS "Admins select question_options" ON public.question_options;
DROP POLICY IF EXISTS "Admins can insert question_options" ON public.question_options;
DROP POLICY IF EXISTS "Admins can update question_options" ON public.question_options;
DROP POLICY IF EXISTS "Admins can delete question_options" ON public.question_options;

DROP POLICY IF EXISTS "Allow public select for activity_media" ON public.activity_media;
DROP POLICY IF EXISTS "Public or Admin select activity_media" ON public.activity_media;
DROP POLICY IF EXISTS "Admins select activity_media" ON public.activity_media;
DROP POLICY IF EXISTS "Admins can insert activity_media" ON public.activity_media;
DROP POLICY IF EXISTS "Admins can update activity_media" ON public.activity_media;
DROP POLICY IF EXISTS "Admins can delete activity_media" ON public.activity_media;

DROP POLICY IF EXISTS "Allow public select for game_versions" ON public.game_versions;
DROP POLICY IF EXISTS "Public or Admin select game_versions" ON public.game_versions;
DROP POLICY IF EXISTS "Admins can insert game_versions" ON public.game_versions;
DROP POLICY IF EXISTS "Admins can update game_versions" ON public.game_versions;
DROP POLICY IF EXISTS "Admins can delete game_versions" ON public.game_versions;

-- Admin Users Policies (Direct check for own row prevents RLS recursion on admin_users table)
CREATE POLICY "Users can view own admin_users record" ON public.admin_users
    FOR SELECT USING (id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Admins can manage admin_users" ON public.admin_users
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Media Assets Policies (Uses is_published_media_asset helper to safely verify published media)
CREATE POLICY "Public or Admin select media_assets" ON public.media_assets
    FOR SELECT USING (
        public.is_admin() OR
        public.is_published_media_asset(public.media_assets.file_path)
    );

CREATE POLICY "Admins can insert media_assets" ON public.media_assets
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update media_assets" ON public.media_assets
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete media_assets" ON public.media_assets
    FOR DELETE USING (public.is_admin());

-- Game Categories Policies
CREATE POLICY "Public or Admin select game_categories" ON public.game_categories
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.games g
            WHERE g.category_id = public.game_categories.id
              AND g.is_published = TRUE
        )
    );

CREATE POLICY "Admins can insert game_categories" ON public.game_categories
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update game_categories" ON public.game_categories
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete game_categories" ON public.game_categories
    FOR DELETE USING (public.is_admin());

-- Games Policies
CREATE POLICY "Public or Admin select games" ON public.games
    FOR SELECT USING (public.is_admin() OR is_published = TRUE);

CREATE POLICY "Admins can insert games" ON public.games
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update games" ON public.games
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete games" ON public.games
    FOR DELETE USING (public.is_admin());

-- Game Levels Policies
CREATE POLICY "Public or Admin select game_levels" ON public.game_levels
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.games g
            WHERE g.id = public.game_levels.game_id
              AND g.is_published = TRUE
        )
    );

CREATE POLICY "Admins can insert game_levels" ON public.game_levels
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update game_levels" ON public.game_levels
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete game_levels" ON public.game_levels
    FOR DELETE USING (public.is_admin());

-- Questions Policies
CREATE POLICY "Public or Admin select questions" ON public.questions
    FOR SELECT USING (
        public.is_admin() OR
        (
            is_draft = FALSE AND EXISTS (
                SELECT 1 FROM public.games g
                WHERE g.id = public.questions.game_id
                  AND g.is_published = TRUE
            )
        )
    );

CREATE POLICY "Admins can insert questions" ON public.questions
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update questions" ON public.questions
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete questions" ON public.questions
    FOR DELETE USING (public.is_admin());

-- Question Options Policies (Direct table SELECT restricted to verified Admins)
CREATE POLICY "Admins select question_options" ON public.question_options
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert question_options" ON public.question_options
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update question_options" ON public.question_options
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete question_options" ON public.question_options
    FOR DELETE USING (public.is_admin());

-- Activity Media Policies (Strictly restricted to verified Admins)
CREATE POLICY "Admins select activity_media" ON public.activity_media
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert activity_media" ON public.activity_media
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update activity_media" ON public.activity_media
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete activity_media" ON public.activity_media
    FOR DELETE USING (public.is_admin());

-- Game Versions Policies
CREATE POLICY "Public or Admin select game_versions" ON public.game_versions
    FOR SELECT USING (public.is_admin() OR is_active = TRUE);

CREATE POLICY "Admins can insert game_versions" ON public.game_versions
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update game_versions" ON public.game_versions
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete game_versions" ON public.game_versions
    FOR DELETE USING (public.is_admin());

--------------------------------------------------------------------------------
-- 6. STORAGE BUCKET CONFIGURATION & PUBLISHED ASSETS DELIVERY POLICY
--------------------------------------------------------------------------------

-- Storage bucket for game assets (private bucket for draft/unreleased asset protection)
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-assets', 'game-assets', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Access for Storage" ON storage.objects;
DROP POLICY IF EXISTS "Admin or Authorized Storage Select" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Select Access" ON storage.objects;
DROP POLICY IF EXISTS "Public or Admin Storage Select" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Delete Access" ON storage.objects;

-- Storage object SELECT policy uses is_published_media_asset helper to safely allow anon reads for published media
CREATE POLICY "Public or Admin Storage Select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'game-assets' AND (
            public.is_admin() OR
            public.is_published_media_asset(storage.objects.name)
        )
    );

CREATE POLICY "Admin Storage Insert Access" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'game-assets' AND public.is_admin());

CREATE POLICY "Admin Storage Update Access" ON storage.objects
    FOR UPDATE USING (bucket_id = 'game-assets' AND public.is_admin())
    WITH CHECK (bucket_id = 'game-assets' AND public.is_admin());

CREATE POLICY "Admin Storage Delete Access" ON storage.objects
    FOR DELETE USING (bucket_id = 'game-assets' AND public.is_admin());

COMMIT;
