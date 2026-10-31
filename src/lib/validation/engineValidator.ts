/**
 * Sproutelle Admin Content Studio - Engine-Specific Validator
 * File: src/lib/validation/engineValidator.ts
 */

import { GAME_ENGINE_REGISTRY, type EngineType } from '../../types/engine';
import type { ValidationMessage, ValidationResult } from './types';

export function validateEngine(
  engineType: EngineType,
  config: Record<string, unknown>
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  const registryDef = GAME_ENGINE_REGISTRY[engineType];
  if (!registryDef) {
    errors.push({
      code: 'ERR_ENGINE_UNKNOWN',
      message: `Unknown game engine type: "${engineType}".`,
      severity: 'error',
      field: 'game_type',
      entityType: 'engine',
    });
    return { valid: false, errors, warnings };
  }

  // Question count boundary check
  const questionCount = Number(config.question_count ?? registryDef.defaultConfig.question_count);
  if (isNaN(questionCount) || questionCount < 1 || questionCount > 20) {
    errors.push({
      code: 'ERR_ENGINE_QUESTION_COUNT_BOUNDS',
      message: `Engine "${registryDef.name}" question count per session must be between 1 and 20.`,
      severity: 'error',
      field: 'question_count',
      entityType: 'engine',
    });
  }

  // Age range boundary check
  const minAge = Number(config.min_age ?? registryDef.defaultConfig.min_age);
  const maxAge = Number(config.max_age ?? registryDef.defaultConfig.max_age);
  if (isNaN(minAge) || minAge < 3 || minAge > 12) {
    errors.push({
      code: 'ERR_ENGINE_MIN_AGE_BOUNDS',
      message: 'Minimum target age must be between 3 and 12.',
      severity: 'error',
      field: 'min_age',
      entityType: 'engine',
    });
  }
  if (isNaN(maxAge) || maxAge < minAge || maxAge > 12) {
    errors.push({
      code: 'ERR_ENGINE_MAX_AGE_BOUNDS',
      message: 'Maximum target age must be greater than or equal to minimum target age and up to 12.',
      severity: 'error',
      field: 'max_age',
      entityType: 'engine',
    });
  }

  // Difficulty check
  const difficulty = String(config.difficulty || registryDef.defaultConfig.difficulty);
  if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    errors.push({
      code: 'ERR_ENGINE_DIFFICULTY_INVALID',
      message: 'Difficulty level must be beginner, intermediate, or advanced.',
      severity: 'error',
      field: 'difficulty',
      entityType: 'engine',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
