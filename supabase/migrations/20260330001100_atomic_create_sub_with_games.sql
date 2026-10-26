-- Sproutelle Admin Content Studio - Additive Migration: All-in-One Atomic Subcategory & Games Save RPC
-- File: 20260330001100_atomic_create_sub_with_games.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Creates public.save_subcategory_with_games(...) to atomically create/update a subcategory
-- and replace its game assignments in a single transaction with strict validation.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_subcategory_with_games(
    p_subcategory_id UUID,
    p_explorer_id UUID,
    p_name TEXT,
    p_image_asset_id UUID,
    p_background_color TEXT,
    p_category_id UUID,
    p_sort_order INT,
    p_is_active BOOLEAN,
    p_assignments JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sub_id UUID;
    v_item JSONB;
    v_game_id UUID;
    v_patterns JSONB;
    v_sort_order INT;
    v_is_active BOOLEAN;
    v_game_type TEXT;
    v_pattern_text TEXT;
    v_seen_game_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    -- 1. Verify admin authorization
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can manage subcategory records.';
    END IF;

    -- 2. Validate basic fields
    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Subcategory name cannot be empty.';
    END IF;

    IF p_explorer_id IS NULL THEN
        RAISE EXCEPTION 'Explorer ID is required for subcategory.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.homescreen_explorer WHERE id = p_explorer_id) THEN
        RAISE EXCEPTION 'Explorer card with ID % does not exist.', p_explorer_id;
    END IF;

    -- 3. Validate JSONB assignments input (must be an array or null)
    IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) <> 'array' THEN
        RAISE EXCEPTION 'Malformed assignments input: expected JSON array.';
    END IF;

    -- 4. Upsert subcategory record
    IF p_subcategory_id IS NOT NULL THEN
        -- Update existing subcategory (locking row with FOR UPDATE)
        IF NOT EXISTS (SELECT 1 FROM public.homescreen_explorer_subcategories WHERE id = p_subcategory_id FOR UPDATE) THEN
            RAISE EXCEPTION 'Subcategory with ID % does not exist.', p_subcategory_id;
        END IF;

        UPDATE public.homescreen_explorer_subcategories
        SET name = trim(p_name),
            image_asset_id = p_image_asset_id,
            background_color = COALESCE(p_background_color, '#FFF0F3'),
            category_id = p_category_id,
            sort_order = COALESCE(p_sort_order, 0),
            is_active = COALESCE(p_is_active, TRUE),
            updated_at = NOW()
        WHERE id = p_subcategory_id;

        v_sub_id := p_subcategory_id;
    else
        -- Insert new subcategory
        INSERT INTO public.homescreen_explorer_subcategories (
            explorer_id,
            name,
            image_asset_id,
            background_color,
            category_id,
            sort_order,
            is_active
        )
        VALUES (
            p_explorer_id,
            trim(p_name),
            p_image_asset_id,
            COALESCE(p_background_color, '#FFF0F3'),
            p_category_id,
            COALESCE(p_sort_order, 0),
            COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_sub_id;
    END IF;

    -- 5. Replace subcategory game assignments atomically
    DELETE FROM public.subcategory_games WHERE subcategory_id = v_sub_id;

    IF p_assignments IS NOT NULL AND jsonb_array_length(p_assignments) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            v_game_id := (v_item->>'game_id')::UUID;
            v_patterns := COALESCE(v_item->'enabled_patterns', '[]'::jsonb);
            v_sort_order := COALESCE((v_item->>'sort_order')::INT, 0);
            v_is_active := COALESCE((v_item->>'is_active')::BOOLEAN, TRUE);

            IF v_game_id IS NULL THEN
                RAISE EXCEPTION 'Assignment item is missing game_id.';
            END IF;

            -- Check for duplicate game IDs in the assignment array
            IF v_game_id = ANY(v_seen_game_ids) THEN
                RAISE EXCEPTION 'Duplicate game assignment detected for game ID %.', v_game_id;
            END IF;
            v_seen_game_ids := array_append(v_seen_game_ids, v_game_id);

            -- Verify game exists and get its game_type (engine type)
            SELECT game_type INTO v_game_type
            FROM public.games
            WHERE id = v_game_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Game with ID % does not exist.', v_game_id;
            END IF;

            -- Validate pattern values against engine allowlist
            IF jsonb_typeof(v_patterns) <> 'array' THEN
                RAISE EXCEPTION 'Malformed enabled_patterns: expected JSON array.';
            END IF;

            FOR v_pattern_text IN SELECT * FROM jsonb_array_elements_text(v_patterns)
            LOOP
                -- Allowlist check grounded in supported question/pattern types per engine
                IF v_game_type = 'guess_game' AND v_pattern_text NOT IN ('multiple_choice', 'image_selection', 'audio_recognition') THEN
                    RAISE EXCEPTION 'Invalid pattern "%" for Guess Game engine.', v_pattern_text;
                ELSIF v_game_type = 'matching_fun' AND v_pattern_text NOT IN ('matching') THEN
                    RAISE EXCEPTION 'Invalid pattern "%" for Matching Fun engine.', v_pattern_text;
                ELSIF v_game_type = 'spelling_bee' AND v_pattern_text NOT IN ('spelling', 'missing_letters') THEN
                    RAISE EXCEPTION 'Invalid pattern "%" for Spelling Bee engine.', v_pattern_text;
                ELSIF v_game_type = 'garden_quiz' AND v_pattern_text NOT IN ('true_false', 'quiz') THEN
                    RAISE EXCEPTION 'Invalid pattern "%" for Garden Quiz engine.', v_pattern_text;
                ELSIF v_game_type = 'memory_flip' AND v_pattern_text NOT IN ('memory_pairs') THEN
                    RAISE EXCEPTION 'Invalid pattern "%" for Memory Flip engine.', v_pattern_text;
                END IF;
            END LOOP;

            INSERT INTO public.subcategory_games (
                subcategory_id,
                game_id,
                enabled_patterns,
                sort_order,
                is_active
            )
            VALUES (
                v_sub_id,
                v_game_id,
                v_patterns,
                v_sort_order,
                v_is_active
            );
        END LOOP;
    END IF;

    RETURN v_sub_id;
END;
$$;

ALTER FUNCTION public.save_subcategory_with_games(UUID, UUID, TEXT, UUID, TEXT, UUID, INT, BOOLEAN, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.save_subcategory_with_games(UUID, UUID, TEXT, UUID, TEXT, UUID, INT, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_subcategory_with_games(UUID, UUID, TEXT, UUID, TEXT, UUID, INT, BOOLEAN, JSONB) TO authenticated, service_role;

COMMIT;
