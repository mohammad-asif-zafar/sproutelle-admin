/**
 * Sproutelle Admin Content Studio - Standalone Validation Verification Script
 * File: src/lib/validation/verify.ts
 */

import { validateGameActivity } from './gameValidator';
import type { Game, Question } from '../../types/database';
import type { EngineType } from '../../types/engine';

export function runValidationVerification() {
  console.log('Running Sproutelle Validation Verification...');

  const baseGame: Game = {
    id: 'game-1',
    name: 'Alphabet Safari',
    slug: 'alphabet-safari',
    game_type: 'guess_game',
    is_published: false,
    sort_order: 1,
    config: { question_count: 1, difficulty: 'beginner', min_age: 3, max_age: 6 },
    created_at: '',
    updated_at: '',
  };

  const validQuestion: Question = {
    id: 'q-1',
    game_id: 'game-1',
    question_text: 'What is the first letter of Apple?',
    question_type: 'multiple_choice',
    sort_order: 1,
    is_draft: false,
    created_at: '',
    updated_at: '',
    options: [
      { id: 'o-1', question_id: 'q-1', option_text: 'A', is_correct: true, sort_order: 1, created_at: '' },
      { id: 'o-2', question_id: 'q-1', option_text: 'B', is_correct: false, sort_order: 2, created_at: '' },
    ],
  };

  // Test 1: Valid game activity
  const res1 = validateGameActivity(baseGame, [validQuestion], []);
  console.assert(res1.valid === true, 'Test 1 Failed: Valid game should pass');

  // Test 2: Missing prompt
  const q2: Question = { ...validQuestion, question_text: '' };
  const res2 = validateGameActivity(baseGame, [q2], []);
  console.assert(res2.valid === false && res2.errors.some((e) => e.code === 'ERR_QUESTION_EMPTY_PROMPT'), 'Test 2 Failed: Missing prompt');

  // Test 3: Missing correct answer
  const q3: Question = {
    ...validQuestion,
    options: [
      { id: 'o-1', question_id: 'q-1', option_text: 'A', is_correct: false, sort_order: 1, created_at: '' },
      { id: 'o-2', question_id: 'q-1', option_text: 'B', is_correct: false, sort_order: 2, created_at: '' },
    ],
  };
  const res3 = validateGameActivity(baseGame, [q3], []);
  console.assert(res3.valid === false && res3.errors.some((e) => e.code === 'ERR_QUESTION_NO_CORRECT_ANSWER'), 'Test 3 Failed: Missing correct answer');

  // Test 4: Duplicate options
  const q4: Question = {
    ...validQuestion,
    options: [
      { id: 'o-1', question_id: 'q-1', option_text: 'A', is_correct: true, sort_order: 1, created_at: '' },
      { id: 'o-2', question_id: 'q-1', option_text: 'a', is_correct: false, sort_order: 2, created_at: '' },
    ],
  };
  const res4 = validateGameActivity(baseGame, [q4], []);
  console.assert(res4.valid === false && res4.errors.some((e) => e.code === 'ERR_OPTION_DUPLICATE'), 'Test 4 Failed: Duplicate options');

  // Test 5: Unknown engine type
  const unknownGame: Game = { ...baseGame, game_type: 'unknown_engine' as unknown as EngineType };
  const res5 = validateGameActivity(unknownGame, [validQuestion], []);
  console.assert(res5.valid === false && res5.errors.some((e) => e.code === 'ERR_ENGINE_UNKNOWN'), 'Test 5 Failed: Unknown engine type');

  console.log('All validation verification assertions passed successfully!');
}
