/**
 * Sproutelle Admin Content Studio - Enhanced Question-Level Validator
 * File: src/lib/validation/questionValidator.ts
 */

import type { Question, QuestionOption, MediaAsset } from '../../types/database';
import type { ValidationMessage, ValidationResult } from './types';

const SUPPORTED_QUESTION_TYPES = [
  'multiple_choice',
  'image_selection',
  'audio_recognition',
  'matching',
  'spelling',
  'missing_letters',
  'true_false',
  'quiz',
  'memory_pairs',
  'sequencing',
];

export function validateQuestion(
  question: Question,
  index: number,
  availableAssets: MediaAsset[] = []
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const qNum = index + 1;
  const entityId = question.id || `q-temp-${index}`;

  // 1. Prompt check
  if (!question.question_text || !question.question_text.trim()) {
    errors.push({
      code: 'ERR_QUESTION_EMPTY_PROMPT',
      message: `Question #${qNum} is missing prompt text.`,
      severity: 'error',
      field: 'question_text',
      entityId,
      entityType: 'question',
    });
  }

  // 2. Question Type Support check
  if (!question.question_type || !SUPPORTED_QUESTION_TYPES.includes(question.question_type)) {
    errors.push({
      code: 'ERR_QUESTION_TYPE_UNSUPPORTED',
      message: `Question #${qNum} uses an unsupported question type: "${question.question_type}".`,
      severity: 'error',
      field: 'question_type',
      entityId,
      entityType: 'question',
    });
  }

  // 3. Ordering check
  if (question.sort_order === undefined || question.sort_order === null || isNaN(Number(question.sort_order))) {
    errors.push({
      code: 'ERR_QUESTION_INVALID_ORDER',
      message: `Question #${qNum} has invalid sorting order value.`,
      severity: 'error',
      field: 'sort_order',
      entityId,
      entityType: 'question',
    });
  }

  // 4. Options check
  const opts: QuestionOption[] = question.options || [];
  if (opts.length < 2 && question.question_type !== 'spelling') {
    errors.push({
      code: 'ERR_OPTION_INSUFFICIENT',
      message: `Question #${qNum} requires at least 2 answer options.`,
      severity: 'error',
      field: 'options',
      entityId,
      entityType: 'question',
    });
  }

  // Empty or duplicate options check
  const optionTexts = new Set<string>();
  const sortOrders = new Set<number>();

  opts.forEach((opt, optIdx) => {
    const optNum = optIdx + 1;
    const optId = opt.id || `opt-${optIdx}`;

    if (opt.sort_order !== undefined && opt.sort_order !== null) {
      if (sortOrders.has(opt.sort_order)) {
        errors.push({
          code: 'ERR_OPTION_SORT_DUPLICATE',
          message: `Question #${qNum} contains duplicate sort order position (${opt.sort_order}) among options.`,
          severity: 'error',
          field: 'sort_order',
          entityId: optId,
          entityType: 'option',
        });
      }
      sortOrders.add(opt.sort_order);
    }

    if (!opt.option_text || !opt.option_text.trim()) {
      if (question.question_type !== 'image_selection' && question.question_type !== 'memory_pairs') {
        errors.push({
          code: 'ERR_OPTION_EMPTY_TEXT',
          message: `Question #${qNum}, Option #${optNum} has empty option text.`,
          severity: 'error',
          field: 'option_text',
          entityId: optId,
          entityType: 'option',
        });
      }
    } else {
      const trimmed = opt.option_text.trim().toLowerCase();
      if (optionTexts.has(trimmed) && question.question_type !== 'memory_pairs') {
        errors.push({
          code: 'ERR_OPTION_DUPLICATE',
          message: `Question #${qNum} contains duplicate answer option text ("${opt.option_text}").`,
          severity: 'error',
          field: 'option_text',
          entityId: optId,
          entityType: 'option',
        });
      }
      optionTexts.add(trimmed);
    }
  });

  // 5. Correct answer check
  const correctOpts = opts.filter((o) => o.is_correct);
  if (correctOpts.length === 0 && question.question_type !== 'matching' && question.question_type !== 'memory_pairs') {
    errors.push({
      code: 'ERR_QUESTION_NO_CORRECT_ANSWER',
      message: `Question #${qNum} has no correct answer selected.`,
      severity: 'error',
      field: 'is_correct',
      entityId,
      entityType: 'question',
    });
  }

  // 6. Interaction-specific validation
  if (question.question_type === 'true_false') {
    if (opts.length !== 2) {
      errors.push({
        code: 'ERR_TRUE_FALSE_COUNT',
        message: `Question #${qNum} (True/False mode) must have exactly 2 options.`,
        severity: 'error',
        field: 'options',
        entityId,
        entityType: 'question',
      });
    }
    if (correctOpts.length !== 1) {
      errors.push({
        code: 'ERR_TRUE_FALSE_SINGLE_CORRECT',
        message: `Question #${qNum} (True/False mode) must have exactly 1 correct answer.`,
        severity: 'error',
        field: 'is_correct',
        entityId,
        entityType: 'question',
      });
    }
  }

  if (question.question_type === 'image_selection') {
    const missingImg = opts.some((o) => !o.media_asset_id && !o.media_asset);
    if (missingImg) {
      errors.push({
        code: 'ERR_IMAGE_SELECTION_MISSING_ASSET',
        message: `Question #${qNum} (Image Selection mode) requires an image asset for every answer option.`,
        severity: 'error',
        field: 'media_asset_id',
        entityId,
        entityType: 'question',
      });
    }
  }

  if (question.question_type === 'spelling' || question.question_type === 'missing_letters') {
    if (correctOpts.length > 0 && (!correctOpts[0].option_text || !correctOpts[0].option_text.trim())) {
      errors.push({
        code: 'ERR_SPELLING_SOLUTION_EMPTY',
        message: `Question #${qNum} (Spelling / Missing Letters mode) requires a valid target word solution.`,
        severity: 'error',
        field: 'option_text',
        entityId,
        entityType: 'question',
      });
    }
  }

  if (question.question_type === 'matching' || question.question_type === 'memory_pairs') {
    if (opts.length % 2 !== 0) {
      warnings.push({
        code: 'WARN_PAIRS_INCOMPLETE',
        message: `Question #${qNum} (${question.question_type}) has an odd number of options (${opts.length}), which may indicate incomplete pairs.`,
        severity: 'warning',
        field: 'options',
        entityId,
        entityType: 'question',
      });
    }
  }

  // 7. Asset reference validation
  const assetIdsToCheck = [
    question.image_asset_id,
    question.audio_asset_id,
    ...opts.map((o) => o.media_asset_id),
  ].filter(Boolean) as string[];

  if (availableAssets.length > 0 && assetIdsToCheck.length > 0) {
    assetIdsToCheck.forEach((id) => {
      const found = availableAssets.find((a) => a.id === id);
      if (!found) {
        errors.push({
          code: 'ERR_ASSET_REFERENCE_BROKEN',
          message: `Question #${qNum} references media asset ID ${id} which was not found in available media assets.`,
          severity: 'error',
          field: 'media_asset_id',
          entityId,
          entityType: 'asset',
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
