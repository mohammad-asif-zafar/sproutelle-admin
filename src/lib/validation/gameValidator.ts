/**
 * Sproutelle Admin Content Studio - Comprehensive Game Validator
 * File: src/lib/validation/gameValidator.ts
 */

import type { Game, Question, MediaAsset } from '../../types/database';
import type { EngineType } from '../../types/engine';
import { validateEngine } from './engineValidator';
import { validateQuestion } from './questionValidator';
import { validateAssets } from './assetValidator';
import { validateHierarchy } from './hierarchyValidator';
import type { ValidationMessage, ValidationResult } from './types';

export function validateGameActivity(
  game: Game | null,
  questions: Question[] = [],
  availableAssets: MediaAsset[] = []
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  if (!game) {
    return {
      valid: false,
      errors: [
        {
          code: 'ERR_GAME_NULL',
          message: 'Game record is null or undefined.',
          severity: 'error',
          entityType: 'game',
        },
      ],
      warnings: [],
    };
  }

  // 1. Metadata check
  if (!game.name || !game.name.trim()) {
    errors.push({
      code: 'ERR_GAME_NAME_EMPTY',
      message: 'Game name is required.',
      severity: 'error',
      field: 'name',
      entityId: game.id,
      entityType: 'game',
    });
  }

  if (!game.slug || !game.slug.trim()) {
    errors.push({
      code: 'ERR_GAME_SLUG_EMPTY',
      message: 'Game URL slug is required.',
      severity: 'error',
      field: 'slug',
      entityId: game.id,
      entityType: 'game',
    });
  }

  // 2. Engine validation
  const engineType = (game.game_type as EngineType) || 'guess_game';
  const rawConfig = game.config || {};
  const engineRes = validateEngine(engineType, rawConfig);
  errors.push(...engineRes.errors);
  warnings.push(...engineRes.warnings);

  // 3. Hierarchy validation
  const hierarchyRes = validateHierarchy(game, questions);
  errors.push(...hierarchyRes.errors);
  warnings.push(...hierarchyRes.warnings);

  // 4. Question validation
  questions.forEach((q, idx) => {
    const qRes = validateQuestion(q, idx, availableAssets);
    errors.push(...qRes.errors);
    warnings.push(...qRes.warnings);
  });

  // 5. Asset validation
  const assetRes = validateAssets(questions, availableAssets);
  errors.push(...assetRes.errors);
  warnings.push(...assetRes.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
