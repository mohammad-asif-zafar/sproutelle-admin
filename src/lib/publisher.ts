/**
 * Sproutelle Admin Content Studio - Publishing Validation Pipeline & Offline Content Pack Exporter
 * File: src/lib/publisher.ts
 */

import type { Game, Question, MediaAsset } from '../types/database';
import { validateEngineConfig, type EngineType } from '../types/engine';

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
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Basic Metadata Check
  if (!game.name || !game.name.trim()) {
    errors.push('Game name is required.');
  }
  if (!game.slug || !game.slug.trim()) {
    errors.push('Game URL slug is required.');
  }

  // 2. Location Assignment Check
  if (!game.category_id && !game.subcategory_id) {
    warnings.push('Game is not assigned to a learning category or Home Explorer subcategory.');
  }

  // 3. Engine Config Validation
  const engineType = (game.game_type as EngineType) || 'guess_game';
  const rawConfig = (game as unknown as { config?: Record<string, unknown> }).config || {};
  const configValidation = validateEngineConfig(engineType, rawConfig);
  if (!configValidation.valid) {
    errors.push(...configValidation.errors);
  }

  // 4. Eligible Questions Validation
  const publishedQuestions = questions.filter((q) => !q.is_draft);
  const requiredCount = Number(rawConfig.question_count || 5);

  if (publishedQuestions.length === 0) {
    errors.push('Activity has 0 published questions. Add and publish questions before publishing the game.');
  } else if (publishedQuestions.length < requiredCount) {
    errors.push(
      `Engine configuration requires ${requiredCount} questions per session, but only ${publishedQuestions.length} published questions exist.`
    );
  }

  // 5. Individual Question & Options Validation
  const assetIdsSet = new Set<string>();

  publishedQuestions.forEach((q, idx) => {
    const qNum = idx + 1;
    if (!q.question_text || !q.question_text.trim()) {
      errors.push(`Question #${qNum} is missing prompt text.`);
    }

    if (q.image_asset_id) assetIdsSet.add(q.image_asset_id);
    if (q.audio_asset_id) assetIdsSet.add(q.audio_asset_id);

    const opts = q.options || [];
    if (opts.length < 2) {
      errors.push(`Question #${qNum} requires at least 2 answer options.`);
    }

    const correctOpts = opts.filter((o) => o.is_correct);
    if (correctOpts.length === 0) {
      errors.push(`Question #${qNum} ("${q.question_text.slice(0, 30)}...") has no correct answer selected.`);
    }

    if (q.question_type === 'true_false') {
      if (opts.length !== 2) {
        errors.push(`Question #${qNum} (True/False mode) must have exactly 2 options.`);
      }
      if (correctOpts.length !== 1) {
        errors.push(`Question #${qNum} (True/False mode) must have exactly 1 correct answer.`);
      }
    }

    if (q.question_type === 'image_selection') {
      const missingOptionImg = opts.some((o) => !o.media_asset_id && !o.media_asset);
      if (missingOptionImg) {
        errors.push(`Question #${qNum} (Image Selection mode) requires an image asset for every answer option.`);
      }
    }

    opts.forEach((o) => {
      if (o.media_asset_id) assetIdsSet.add(o.media_asset_id);
      if (o.media_asset?.id) assetIdsSet.add(o.media_asset.id);
    });
  });

  // 6. Build Snapshot if Eligible
  let snapshot: ReleasePackSnapshot | null = null;

  if (errors.length === 0) {
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
    eligible: errors.length === 0,
    errors,
    warnings,
    snapshot,
  };
}
