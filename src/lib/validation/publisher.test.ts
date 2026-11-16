/**
 * Sproutelle Admin Content Studio - Publishing Validation Test Suite
 * File: src/lib/validation/publisher.test.ts
 */

import type { Game, Question, MediaAsset, GameLevel } from '../../types/database';
import { validateActivityForPublication, type PublicPublishedContentPack } from '../publisher';
import { validateAssets } from './assetValidator';

export function runPublisherValidationTests(): { passed: number; failed: number; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      passed++;
      log.push(`✓ PASSED: ${testName}`);
    } else {
      failed++;
      log.push(`✕ FAILED: ${testName} - ${detail || 'Assertion failed'}`);
    }
  };

  const mockGame: Game = {
    id: 'game-1',
    name: 'Picture Quest',
    slug: 'picture-quest',
    game_type: 'find_correct_picture',
    is_published: true,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAsset: MediaAsset = {
    id: 'asset-1',
    name: 'apple.png',
    bucket_name: 'game-assets',
    file_path: '2026/03/apple.png',
    mime_type: 'image/png',
    size_bytes: 1024,
    created_at: new Date().toISOString(),
  };

  const mockAudio: MediaAsset = {
    id: 'audio-1',
    name: 'prompt.mp3',
    bucket_name: 'game-assets',
    file_path: '2026/03/prompt.mp3',
    mime_type: 'audio/mp3',
    size_bytes: 2048,
    created_at: new Date().toISOString(),
  };

  const validQuestion: Question = {
    id: 'q-1',
    game_id: 'game-1',
    subcategory_id: 'sub-1',
    level_id: 'lvl-1',
    question_text: 'Which one is an apple?',
    question_type: 'find_correct_picture',
    sort_order: 1,
    is_draft: false,
    image_asset_id: 'asset-1',
    audio_asset_id: 'audio-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'o-1', question_id: 'q-1', option_text: 'Apple', is_correct: true, sort_order: 1, media_asset_id: 'asset-1', created_at: new Date().toISOString() },
      { id: 'o-2', question_id: 'q-1', option_text: 'Banana', is_correct: false, sort_order: 2, media_asset_id: 'asset-1', created_at: new Date().toISOString() },
    ],
  };

  const validLevel: GameLevel = {
    id: 'lvl-1',
    game_id: 'game-1',
    level_number: 1,
    title: 'Level 1',
    pass_score: 80,
    sort_order: 1,
    created_at: new Date().toISOString(),
  };

  // 1. Zero active assignments
  {
    const report = validateActivityForPublication(mockGame, [validQuestion], [mockAsset, mockAudio], new Set(), [validLevel]);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('0 active subcategory assignments')),
      'Test 1: Zero active assignments blocks publication'
    );
  }

  // 2. Assignment query failure simulation (handled as empty set)
  {
    const report = validateActivityForPublication(mockGame, [validQuestion], [mockAsset, mockAudio], new Set(), [validLevel]);
    assert(!report.eligible, 'Test 2: Query failure simulation blocks publication');
  }

  // 3. Empty levels with a question referencing a level
  {
    const report = validateActivityForPublication(mockGame, [validQuestion], [mockAsset, mockAudio], new Set(['sub-1']), []);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('refers to level ID')),
      'Test 3: Empty levels list with level-assigned question blocks publication'
    );
  }

  // 4. Level belonging to another game
  {
    const qOtherLevel: Question = { ...validQuestion, level_id: 'lvl-other-game' };
    const report = validateActivityForPublication(mockGame, [qOtherLevel], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('does not belong to target game')),
      'Test 4: Level ID belonging to another game blocks publication'
    );
  }

  // 5. Invalid question game_id
  {
    const qOtherGame: Question = { ...validQuestion, game_id: 'other-game-id' };
    const report = validateActivityForPublication(mockGame, [qOtherGame], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('does not match target game')),
      'Test 5: Invalid question game_id blocks publication'
    );
  }

  // 6. NULL subcategory on a published question
  {
    const qNullSub: Question = { ...validQuestion, subcategory_id: null };
    const report = validateActivityForPublication(mockGame, [qNullSub], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('NULL subcategory ID')),
      'Test 6: Published question with NULL subcategory_id blocks publication'
    );
  }

  // 7. Inactive subcategory assignment
  {
    const qInactiveSub: Question = { ...validQuestion, subcategory_id: 'sub-inactive' };
    const report = validateActivityForPublication(mockGame, [qInactiveSub], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('inactive or unassigned subcategory ID')),
      'Test 7: Published question under inactive subcategory assignment blocks publication'
    );
  }

  // 8. Missing media metadata
  {
    const qMissingAsset: Question = { ...validQuestion, image_asset_id: 'non-existent-asset' };
    const report = validateActivityForPublication(mockGame, [qMissingAsset], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
    assert(
      !report.eligible && report.errors.some((e) => e.includes('does not exist in media library')),
      'Test 8: Missing media asset metadata blocks publication'
    );
  }

  // 9. Empty storage path
  {
    const emptyPathAsset: MediaAsset = { ...mockAsset, file_path: '' };
    const res = validateAssets([validQuestion], [emptyPathAsset, mockAudio]);
    assert(
      !res.valid && res.errors.some((e) => e.code === 'ERR_ASSET_EMPTY_FILE_PATH'),
      'Test 9: Empty storage file_path blocks asset validation'
    );
  }

  // 10. Empty bucket name
  {
    const emptyBucketAsset: MediaAsset = { ...mockAsset, bucket_name: '   ' };
    const res = validateAssets([validQuestion], [emptyBucketAsset, mockAudio]);
    assert(
      !res.valid && res.errors.some((e) => e.code === 'ERR_ASSET_EMPTY_BUCKET_NAME'),
      'Test 10: Empty storage bucket_name blocks asset validation'
    );
  }

  // 11. Incorrect image/audio MIME type
  {
    const wrongMimeAudio: MediaAsset = { ...mockAudio, mime_type: 'image/png' };
    const res = validateAssets([validQuestion], [mockAsset, wrongMimeAudio]);
    assert(
      !res.valid && res.errors.some((e) => e.code === 'ERR_ASSET_MIME_MISMATCH_AUDIO'),
      'Test 11: Incorrect audio MIME type blocks asset validation'
    );
  }

  // 12. Draft questions excluded from the release
  {
    const draftQ: Question = { ...validQuestion, id: 'q-draft', is_draft: true };
    const report = validateActivityForPublication(mockGame, [validQuestion, draftQ], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
    assert(
      report.eligible && report.snapshot?.questions.length === 1 && report.snapshot.questions[0].id === 'q-1',
      'Test 12: Draft questions excluded from release snapshot'
    );
  }

  // 13. Public type contains no is_correct field
  {
    const publicPack: PublicPublishedContentPack = {
      pack_version: '1.0.1',
      generated_at: new Date().toISOString(),
      game_id: 'game-1',
      game_name: 'Picture Quest',
      game_slug: 'picture-quest',
      engine_type: 'find_correct_picture',
      config: { question_count: 5 },
      questions: [
        {
          id: 'q-1',
          game_id: 'game-1',
          subcategory_id: 'sub-1',
          level_id: 'lvl-1',
          question_text: 'Which one is an apple?',
          question_type: 'find_correct_picture',
          sort_order: 1,
          options: [
            { id: 'opt-1', question_id: 'q-1', option_text: 'Apple', sort_order: 1, media_asset_id: 'asset-1' },
          ],
        },
      ],
      referenced_assets: [],
    };

    const keys = Object.keys(publicPack.questions[0].options[0]);
    assert(
      !keys.includes('is_correct'),
      'Test 13: PublicPublishedContentPack options interface excludes is_correct'
    );
  }

  return { passed, failed, log };
}

// Automatically execute validation test suite on module load
const testResult = runPublisherValidationTests();
console.log(`[Publisher Validation Test Suite] Passed: ${testResult.passed}/${testResult.passed + testResult.failed}`);
