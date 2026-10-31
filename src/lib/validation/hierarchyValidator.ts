/**
 * Sproutelle Admin Content Studio - Hierarchy Validator
 * File: src/lib/validation/hierarchyValidator.ts
 */

import type { Game, Question } from '../../types/database';
import type { ValidationMessage, ValidationResult } from './types';

export function validateHierarchy(
  game: Game,
  questions: Question[]
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  // Location check
  if (!game.category_id && !game.subcategory_id) {
    warnings.push({
      code: 'WARN_GAME_UNASSIGNED_LOCATION',
      message: `Game "${game.name}" is not assigned to any learning topic category or Home Explorer subcategory.`,
      severity: 'warning',
      field: 'subcategory_id',
      entityId: game.id,
      entityType: 'hierarchy',
    });
  }

  // Question count vs session requirement
  const rawConfig = game.config || {};
  const requiredCount = Number(rawConfig.question_count || 5);
  const publishedQuestions = questions.filter((q) => !q.is_draft);

  if (publishedQuestions.length === 0) {
    errors.push({
      code: 'ERR_GAME_ZERO_PUBLISHED_QUESTIONS',
      message: `Game "${game.name}" has 0 published questions. Add and publish questions before making this game available.`,
      severity: 'error',
      field: 'questions',
      entityId: game.id,
      entityType: 'game',
    });
  } else if (publishedQuestions.length < requiredCount) {
    errors.push({
      code: 'ERR_GAME_INSUFFICIENT_PUBLISHED_QUESTIONS',
      message: `Game configuration requires ${requiredCount} questions per session, but only ${publishedQuestions.length} published questions exist.`,
      severity: 'error',
      field: 'question_count',
      entityId: game.id,
      entityType: 'game',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
