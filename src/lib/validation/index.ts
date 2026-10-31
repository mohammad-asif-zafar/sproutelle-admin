/**
 * Sproutelle Admin Content Studio - Validation Module Index
 * File: src/lib/validation/index.ts
 */

export * from './types';
export * from './questionValidator';
export * from './engineValidator';
export * from './assetValidator';
export * from './hierarchyValidator';
export * from './gameValidator';

import { validateEngineConfig as legacyValidateEngineConfig } from '../../types/engine';
import { validateActivityForPublication as legacyValidateActivityForPublication } from '../publisher';
import type { Game, Question, MediaAsset } from '../../types/database';
import type { EngineType } from '../../types/engine';
import { validateGameActivity } from './gameValidator';

/**
 * Backward-compatible adapter for validateEngineConfig
 */
export function validateEngineConfig(
  engineType: EngineType,
  config: Record<string, unknown>
) {
  return legacyValidateEngineConfig(engineType, config);
}

/**
 * Backward-compatible adapter for validateActivityForPublication
 */
export function validateActivityForPublication(
  game: Game,
  questions: Question[],
  availableMediaAssets: MediaAsset[] = []
) {
  const result = validateGameActivity(game, questions, availableMediaAssets);
  return {
    eligible: result.valid,
    errors: result.errors.map((e) => e.message),
    warnings: result.warnings.map((w) => w.message),
    snapshot: legacyValidateActivityForPublication(game, questions, availableMediaAssets).snapshot,
  };
}
