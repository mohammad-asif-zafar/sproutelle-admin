-- Sproutelle Admin Content Studio - Additive Migration: Atomic Publish Function
-- File: 20260330000500_atomic_publish_function.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Creates atomic publish_game_release function to handle versioning, duplicate prevention,
-- prior release deactivation, and game publishing in a single transaction.

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
BEGIN
    -- 1. Verify admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can publish game releases.';
    END IF;

    -- 2. Check for duplicate release version retry
    IF EXISTS (
        SELECT 1 FROM public.game_releases
        WHERE game_id = p_game_id
          AND version_number = p_version_number
          AND is_active = TRUE
    ) THEN
        UPDATE public.games
        SET is_published = TRUE, updated_at = NOW()
        WHERE id = p_game_id;

        RETURN TRUE;
    END IF;

    -- 3. Deactivate prior active releases for this game
    UPDATE public.game_releases
    SET is_active = FALSE
    WHERE game_id = p_game_id
      AND is_active = TRUE;

    -- 4. Insert new active release
    INSERT INTO public.game_releases (game_id, version_number, pack_data, is_active)
    VALUES (p_game_id, p_version_number, p_pack_data, TRUE);

    -- 5. Mark game as published
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
