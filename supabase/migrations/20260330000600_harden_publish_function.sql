-- Sproutelle Admin Content Studio - Additive Migration: Hardened Atomic Publish Function
-- File: 20260330000600_harden_publish_function.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Enhances publish_game_release with row-level locking (FOR UPDATE), game existence & eligibility checks,
-- version collision payload verification, and strict transaction rollback on error.

BEGIN;

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
    v_game_exists BOOLEAN;
    v_has_published_questions BOOLEAN;
    v_existing_pack JSONB;
BEGIN
    -- 1. Verify admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can publish game releases.';
    END IF;

    -- 2. Lock the target game row with FOR UPDATE to serialize concurrent publishes for the same game
    SELECT EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id FOR UPDATE)
    INTO v_game_exists;

    IF NOT v_game_exists THEN
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

    -- 4. Check for existing version number
    SELECT pack_data INTO v_existing_pack
    FROM public.game_releases
    WHERE game_id = p_game_id
      AND version_number = p_version_number
      AND is_active = TRUE;

    IF v_existing_pack IS NOT NULL THEN
        -- If exact same payload, treat as successful idempotent retry
        IF v_existing_pack = p_pack_data THEN
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

    -- 6. Insert new active release snapshot
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
