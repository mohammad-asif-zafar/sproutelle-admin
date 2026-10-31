/**
 * Sproutelle Admin Content Studio - Publishing Validation Pipeline & Offline Content Pack Exporter
 * File: src/lib/publisher.ts
 */

import type { Game, Question, MediaAsset } from '../types/database';
import type { EngineType } from '../types/engine';
import { validateGameActivity } from './validation/gameValidator';

export interface ReleasePackSnapshot {
  pack_version: string;
  generated_at: string;
  game_id: string;
  game_name: string;
  game_slug: string;
  engine_type: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  config: Record<string, unknown>;
  questions: Array<{
    id: string;
    question_text: string;
    question_type: string;
    instructions?: string | null;
    sort_order: number;
    image_asset_id?: string | null;
    audio_asset_id?: string | null;
    options: Array<{
      id: string;
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

export interface ValidationReport {
  eligible: boolean;
  errors: string[];
  warnings: string[];
  snapshot: ReleasePackSnapshot | null;
}

export function validateActivityForPublication(
  game: Game,
  questions: Question[],
  availableMediaAssets: MediaAsset[] = []
): ValidationReport {
  const result = validateGameActivity(game, questions, availableMediaAssets);

  const errors = result.errors.map((e) => e.message);
  const warnings = result.warnings.map((w) => w.message);

  let snapshot: ReleasePackSnapshot | null = null;

  if (result.valid) {
    const assetIdsSet = new Set<string>();
    const publishedQuestions = questions.filter((q) => !q.is_draft);
    const engineType = (game.game_type as EngineType) || 'guess_game';
    const rawConfig = game.config || {};

    publishedQuestions.forEach((q) => {
      if (q.image_asset_id) assetIdsSet.add(q.image_asset_id);
      if (q.audio_asset_id) assetIdsSet.add(q.audio_asset_id);
      (q.options || []).forEach((o) => {
        if (o.media_asset_id) assetIdsSet.add(o.media_asset_id);
        if (o.media_asset?.id) assetIdsSet.add(o.media_asset.id);
      });
    });

    const referencedAssets = availableMediaAssets
      .filter((a) => assetIdsSet.has(a.id))
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
      subcategory_id: game.subcategory_id || null,
      config: rawConfig,
      questions: publishedQuestions.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        instructions: q.instructions || null,
        sort_order: q.sort_order,
        image_asset_id: q.image_asset_id || null,
        audio_asset_id: q.audio_asset_id || null,
        options: (q.options || []).map((o) => ({
          id: o.id,
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
    eligible: result.valid,
    errors,
    warnings,
    snapshot,
  };
}
