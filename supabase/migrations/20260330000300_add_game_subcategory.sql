-- Sproutelle Admin Content Studio - Additive Migration: Add subcategory_id to games
-- File: 20260330000300_add_game_subcategory.sql
--
-- SAFE ADDITIVE MIGRATION:
-- Adds subcategory_id foreign key to public.games table without disrupting existing games or categories.

BEGIN;

ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.homescreen_explorer_subcategories(id) ON DELETE SET NULL;

COMMIT;
