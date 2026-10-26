-- Sproutelle Admin Content Studio - Additive Migration: Final Sanitized Public RPC & Hardened Publish Function
-- File: 20260330000800_final_harden_publish.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Restricts raw game_releases table access to admins, creates sanitized public get_published_content_pack()
-- RPC function stripping is_correct answer keys for public clients, and implements hardened atomic publish_game_release().

BEGIN;

-- 1. Restrict direct table SELECT on game_releases to admins only
REVOKE SELECT ON TABLE public.game_releases FROM anon;
GRANT SELECT ON TABLE public.game_releases TO authenticated;

DROP POLICY IF EXISTS "Admin select game_releases" ON public.game_releases;
CREATE POLICY "Admin select game_releases" ON public.game_releases
    FOR SELECT USING (public.is_admin());

-- 2. Create sanitized public RPC function for fetching published game content packs (strips is_correct answer keys)
CREATE OR REPLACE FUNCTION public.get_published_content_pack(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_pack JSONB;
    v_is_published BOOLEAN;
    v_sanitized JSONB;
BEGIN
    -- Verify game is published
    SELECT is_published INTO v_is_published
    FROM public.games
    WHERE id = p_game_id;

    IF v_is_published IS NOT TRUE THEN
        RETURN NULL;
    END IF;

    -- Fetch active release pack data
    SELECT pack_data INTO v_pack
    FROM public.game_releases
    WHERE game_id = p_game_id
      AND is_active = TRUE;

    IF v_pack IS NULL THEN
        RETURN NULL;
    END IF;

    -- Sanitize pack_data to strip is_correct from questions options for public mobile clients
    SELECT jsonb_set(
        v_pack,
        '{questions}',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_set(
                        q.value,
                        '{options}',
                        COALESCE(
                            (
                                SELECT jsonb_agg(opt.value - 'is_correct')
                                FROM jsonb_array_elements(q.value->'options') AS opt(value)
                            ),
                            '[]'::jsonb
                        )
                    )
                )
                FROM jsonb_array_elements(v_pack->'questions') AS q(value)
            ),
            '[]'::jsonb
        )
    ) INTO v_sanitized;

    RETURN v_sanitized;
END;
$$;

ALTER FUNCTION public.get_published_content_pack(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_published_content_pack(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_content_pack(UUID) TO anon, authenticated, service_role;

-- 3. Fully hardened publish_game_release function with correct inactive-version retry handling
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
    -- 1. Verify admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can publish game releases.';
    END IF;

    -- 2. Explicit row selection and locking (FOR UPDATE)
    SELECT id INTO v_locked_game_id
    FROM public.games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game with ID % does not exist.', p_game_id;
    END IF;

    -- 3. Verify published questions exist
    SELECT EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.game_id = p_game_id AND q.is_draft = FALSE
    ) INTO v_has_published_questions;

    IF NOT v_has_published_questions THEN
        RAISE EXCEPTION 'Cannot publish game: game has no published questions.';
    END IF;

    -- 4. Check existing version across all releases
    SELECT pack_data INTO v_existing_pack
    FROM public.game_releases
    WHERE game_id = p_game_id
      AND version_number = p_version_number;

    IF FOUND THEN
        IF v_existing_pack = p_pack_data THEN
            -- Idempotent retry: deactivate any OTHER active release first to respect idx_game_releases_single_active
            UPDATE public.game_releases
            SET is_active = FALSE
            WHERE game_id = p_game_id
              AND is_active = TRUE
              AND version_number <> p_version_number;

            -- Set target version to active
            UPDATE public.game_releases
            SET is_active = TRUE
            WHERE game_id = p_game_id
              AND version_number = p_version_number;

            UPDATE public.games
            SET is_published = TRUE, updated_at = NOW()
            WHERE id = p_game_id;

            RETURN TRUE;
        ELSE
            RAISE EXCEPTION 'Version number % already exists for this game with a different content payload. Please increment the version number.', p_version_number;
        END IF;
    END IF;

    -- 5. Deactivate prior active releases
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
