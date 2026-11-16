/**
 * Sproutelle Admin Content Studio - Publishing Validation Pipeline & Offline Content Pack Exporter
 * File: src/lib/publisher.ts
 */

import type { Game, Question, MediaAsset, GameLevel } from '../types/database';
import type { EngineType } from '../types/engine';
import { validateGameActivity } from './validation/gameValidator';

/**
 * Admin-facing release snapshot interface (includes is_correct for preview validation before deployment)
 */
export interface AdminReleasePackSnapshot {
  pack_version: string;
  generated_at: string;
  game_id: string;
  game_name: string;
  game_slug: string;
  engine_type: string;
  category_id?: string | null;
  config: Record<string, unknown>;
  questions: Array<{
    id: string;
    game_id: string;
    subcategory_id: string;
    level_id?: string | null;
    question_text: string;
    question_type: string;
    instructions?: string | null;
    sort_order: number;
    image_asset_id?: string | null;
    audio_asset_id?: string | null;
    options: Array<{
      id: string;
      question_id: string;
      option_text?: string | null;
      is_correct: boolean;
      sort_order: number;
      media_asset_id?: string | null;
    }>;
  }>;
  referenced_assets: Array<{
    id: string;
    name: string;
    file_path: string;
    mime_type: string;
  }>;
}

/**
 * Public-facing content pack interface (strictly excludes is_correct for public/mobile clients)
 */
export interface PublicPublishedQuestionOption {
  id: string;
  question_id: string;
  option_text?: string | null;
  sort_order: number;
  media_asset_id?: string | null;
}

export interface PublicPublishedQuestion {
  id: string;
  game_id: string;
  subcategory_id: string;
  level_id?: string | null;
  question_text: string;
  question_type: string;
  instructions?: string | null;
  sort_order: number;
  image_asset_id?: string | null;
  audio_asset_id?: string | null;
  options: PublicPublishedQuestionOption[];
}

export interface PublicPublishedContentPack {
  pack_version: string;
  generated_at: string;
  game_id: string;
  game_name: string;
  game_slug: string;
  engine_type: string;
  category_id?: string | null;
  config: Record<string, unknown>;
  questions: PublicPublishedQuestion[];
  referenced_assets: Array<{
    id: string;
    name: string;
    file_path: string;
    mime_type: string;
  }>;
}

export type ReleasePackSnapshot = AdminReleasePackSnapshot;

export interface ValidationReport {
  eligible: boolean;
  errors: string[];
  warnings: string[];
  snapshot: AdminReleasePackSnapshot | null;
}

export function validateActivityForPublication(
  game: Game,
  questions: Question[],
  availableMediaAssets: MediaAsset[] = [],
  activeSubcategoryIds: Set<string> = new Set(),
  gameLevels: GameLevel[] = []
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Fail-closed check: Game MUST have at least 1 active subcategory assignment
  if (activeSubcategoryIds.size === 0) {
    errors.push(`Publication Blocked: Game "${game.name}" has 0 active subcategory assignments. Assign the game to at least one active subcategory in Explorer Studio before publishing.`);
  }

  // 2. Validate question ownership, subcategory assignment membership, and level ownership BEFORE filtering
  const validLevelIds = new Set((gameLevels || []).map((l) => l.id));

  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    if (q.game_id !== game.id) {
      errors.push(`Question #${qNum} belongs to game ID "${q.game_id}", which does not match target game "${game.id}".`);
    }

    if (!q.subcategory_id) {
      if (!q.is_draft) {
        errors.push(`Published Question #${qNum} ("${q.question_text || 'Untitled'}") has a NULL subcategory ID and cannot be published.`);
      }
    } else if (!activeSubcategoryIds.has(q.subcategory_id)) {
      if (!q.is_draft) {
        errors.push(`Published Question #${qNum} ("${q.question_text || 'Untitled'}") belongs to an inactive or unassigned subcategory ID (${q.subcategory_id}) and cannot be published.`);
      }
    }

    if (q.level_id && !validLevelIds.has(q.level_id)) {
      errors.push(`Question #${qNum} refers to level ID "${q.level_id}", which does not belong to target game "${game.id}".`);
    }
  });

  // 3. Filter eligible questions strictly by valid ownership, active subcategory, and valid level
  const eligibleQuestions = questions.filter((q) => {
    if (q.is_draft) return false;
    if (!q.subcategory_id) return false;
    if (!activeSubcategoryIds.has(q.subcategory_id)) return false;
    if (q.game_id !== game.id) return false;
    if (q.level_id && !validLevelIds.has(q.level_id)) return false;
    return true;
  });

  const result = validateGameActivity(game, eligibleQuestions, availableMediaAssets);
  errors.push(...result.errors.map((e) => e.message));
  warnings.push(...result.warnings.map((w) => w.message));

  let snapshot: AdminReleasePackSnapshot | null = null;

  if (errors.length === 0) {
    const assetIdsSet = new Set<string>();
    const engineType = (game.game_type as EngineType) || 'guess_game';
    const rawConfig = game.config || {};

    eligibleQuestions.forEach((q) => {
      if (q.image_asset_id) assetIdsSet.add(q.image_asset_id);
      if (q.audio_asset_id) assetIdsSet.add(q.audio_asset_id);
      (q.options || []).forEach((o) => {
        if (o.media_asset_id) assetIdsSet.add(o.media_asset_id);
        if (o.media_asset?.id) assetIdsSet.add(o.media_asset.id);
      });
    });

    const referencedAssets = availableMediaAssets
      .filter((a) => assetIdsSet.has(a.id) && Boolean(a.file_path))
      .map((a) => ({
        id: a.id,
        name: a.name,
        file_path: a.file_path,
        mime_type: a.mime_type,
      }));

    snapshot = {
      pack_version: `1.0.${Date.now().toString().slice(-4)}`,
      generated_at: new Date().toISOString(),
      game_id: game.id,
      game_name: game.name,
      game_slug: game.slug,
      engine_type: engineType,
      category_id: game.category_id || null,
      config: rawConfig,
      questions: eligibleQuestions.map((q) => ({
        id: q.id,
        game_id: game.id,
        subcategory_id: q.subcategory_id as string,
        level_id: q.level_id || null,
        question_text: q.question_text,
        question_type: q.question_type,
        instructions: q.instructions || null,
        sort_order: q.sort_order,
        image_asset_id: q.image_asset_id || null,
        audio_asset_id: q.audio_asset_id || null,
        options: (q.options || []).map((o) => ({
          id: o.id,
          question_id: q.id,
          option_text: o.option_text || null,
          is_correct: o.is_correct,
          sort_order: o.sort_order,
          media_asset_id: o.media_asset_id || o.media_asset?.id || null,
        })),
      })),
      referenced_assets: referencedAssets,
    };
  }

  return {
    eligible: errors.length === 0,
    errors,
    warnings,
    snapshot,
  };
}
