-- Sproutelle Admin Content Studio - Additive Migration: Hardened Publish Constraints & Unique Indexes
-- File: 20260330000700_harden_publish_constraints.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Adds unique indexes for (game_id, version_number) and single active release per game,
-- and updates publish_game_release with explicit FOR UPDATE locking and robust retry checks.

BEGIN;

-- 1. Add unique indexes to enforce database invariants
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_releases_game_version
    ON public.game_releases(game_id, version_number);

-- Ensures at most one active release per game at any given time
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_releases_single_active
    ON public.game_releases(game_id)
    WHERE is_active = TRUE;

-- 2. Hardened atomic publish function with explicit FOR UPDATE row locking
CREATE OR REPLACE FUNCTION public.publish_game_release(
    p_game_id UUID,
    p_version_number TEXT,
    p_pack_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_locked_game_id UUID;
    v_has_published_questions BOOLEAN;
    v_existing_pack JSONB;
BEGIN
    -- 1. Verify admin authorization via public.is_admin()
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can publish game releases.';
    END IF;

    -- 2. Explicit row selection and locking (FOR UPDATE) to serialize concurrent publishes for this game
    SELECT id INTO v_locked_game_id
    FROM public.games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game with ID % does not exist.', p_game_id;
    END IF;

    -- 3. Verify game has at least one published question
    SELECT EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.game_id = p_game_id AND q.is_draft = FALSE
    ) INTO v_has_published_questions;

    IF NOT v_has_published_questions THEN
        RAISE EXCEPTION 'Cannot publish game: game has no published questions.';
    END IF;

    -- 4. Check for existing version number across all releases (active and inactive)
    SELECT pack_data INTO v_existing_pack
    FROM public.game_releases
    WHERE game_id = p_game_id
      AND version_number = p_version_number;

    IF FOUND THEN
        IF v_existing_pack = p_pack_data THEN
            -- Idempotent retry with identical payload: ensure active and game published
            UPDATE public.game_releases
            SET is_active = TRUE
            WHERE game_id = p_game_id AND version_number = p_version_number;

            UPDATE public.games
            SET is_published = TRUE, updated_at = NOW()
            WHERE id = p_game_id;

            RETURN TRUE;
        ELSE
            -- Version collision: same version number but different content payload
            RAISE EXCEPTION 'Version number % already exists for this game with a different content payload. Please increment the version number.', p_version_number;
        END IF;
    END IF;

    -- 5. Deactivate prior active releases for this game (preserving historical records)
    UPDATE public.game_releases
    SET is_active = FALSE
    WHERE game_id = p_game_id
      AND is_active = TRUE;

    -- 6. Insert new active release snapshot (enforced by idx_game_releases_single_active)
    INSERT INTO public.game_releases (game_id, version_number, pack_data, is_active)
    VALUES (p_game_id, p_version_number, p_pack_data, TRUE);

    -- 7. Mark game as published
    UPDATE public.games
    SET is_published = TRUE, updated_at = NOW()
    WHERE id = p_game_id;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.publish_game_release(UUID, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.publish_game_release(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_game_release(UUID, TEXT, JSONB) TO authenticated, service_role;

COMMIT;
