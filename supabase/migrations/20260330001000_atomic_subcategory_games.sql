-- Sproutelle Admin Content Studio - Additive Migration: Atomic Subcategory Games Save RPC
-- File: 20260330001000_atomic_subcategory_games.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Creates public.save_subcategory_games(p_subcategory_id UUID, p_assignments JSONB) to perform
-- atomic replacement of subcategory game assignments inside a secure transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_subcategory_games(
    p_subcategory_id UUID,
    p_assignments JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_item JSONB;
    v_game_id UUID;
    v_patterns JSONB;
    v_sort_order INT;
    v_is_active BOOLEAN;
BEGIN
    -- 1. Verify admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can manage subcategory game assignments.';
    END IF;

    -- 2. Verify subcategory exists (locks row with FOR UPDATE)
    IF NOT EXISTS (SELECT 1 FROM public.homescreen_explorer_subcategories WHERE id = p_subcategory_id FOR UPDATE) THEN
        RAISE EXCEPTION 'Subcategory with ID % does not exist.', p_subcategory_id;
    END IF;

    -- 3. Perform atomic replacement within transaction
    DELETE FROM public.subcategory_games WHERE subcategory_id = p_subcategory_id;

    -- 4. Insert new validated assignments
    IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            v_game_id := (v_item->>'game_id')::UUID;
            v_patterns := COALESCE(v_item->'enabled_patterns', '[]'::jsonb);
            v_sort_order := COALESCE((v_item->>'sort_order')::INT, 0);
            v_is_active := COALESCE((v_item->>'is_active')::BOOLEAN, TRUE);

            -- Validate game exists
            IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = v_game_id) THEN
                RAISE EXCEPTION 'Game with ID % does not exist.', v_game_id;
            END IF;

            INSERT INTO public.subcategory_games (
                subcategory_id,
                game_id,
                enabled_patterns,
                sort_order,
                is_active
            )
            VALUES (
                p_subcategory_id,
                v_game_id,
                v_patterns,
                v_sort_order,
                v_is_active
            );
        END LOOP;
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.save_subcategory_games(UUID, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.save_subcategory_games(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_subcategory_games(UUID, JSONB) TO authenticated, service_role;

COMMIT;
