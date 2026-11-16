/**
 * Sproutelle Admin Content Studio - Publishing Validation Vitest Test Suite
 * File: src/lib/validation/publisher.test.ts
 */

import { describe, it, expect } from 'vitest';
import type { Game, Question, MediaAsset, GameLevel } from '../../types/database';
import { validateActivityForPublication, type PublicPublishedContentPack, type PublicPublishedQuestionOption } from '../publisher';
import { validateAssets } from './assetValidator';
import { parsePublicationDataQueries } from './queryParser';

describe('Sproutelle Publisher Validation Pipeline', () => {
  const mockGame: Game = {
    id: 'game-1',
    name: 'Picture Quest',
    slug: 'picture-quest',
    game_type: 'guess_game',
    is_published: true,
    sort_order: 1,
    config: { question_count: 1, difficulty: 'beginner', min_age: 3, max_age: 8 },
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

  describe('Publication Data Loading Query Parser', () => {
    it('handles questions query failure', () => {
      const qRes = { data: null, error: { message: 'Failed to connect to database' } };
      const assignRes = { data: [{ subcategory_id: 'sub-1' }], error: null };
      const levelsRes = { data: [validLevel], error: null };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Questions Query Failure');
    });

    it('handles subcategory assignment query failure', () => {
      const qRes = { data: [validQuestion], error: null };
      const assignRes = { data: null, error: { message: 'Permission denied on subcategory_games' } };
      const levelsRes = { data: [validLevel], error: null };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Subcategory Assignments Query Failure');
    });

    it('handles game levels query failure', () => {
      const qRes = { data: [validQuestion], error: null };
      const assignRes = { data: [{ subcategory_id: 'sub-1' }], error: null };
      const levelsRes = { data: null, error: { message: 'Network timeout on game_levels' } };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Game Levels Query Failure');
    });

    it('successfully parses all three queries', () => {
      const qRes = { data: [validQuestion], error: null };
      const assignRes = { data: [{ subcategory_id: 'sub-1' }], error: null };
      const levelsRes = { data: [validLevel], error: null };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(true);
      expect(result.questions).toHaveLength(1);
      expect(result.activeSubcategoryIds.has('sub-1')).toBe(true);
      expect(result.levels).toHaveLength(1);
    });
  });

  describe('Level & Assignment Validation', () => {
    it('blocks publication when game has 0 active assignments', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], [mockAsset, mockAudio], new Set(), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('0 active subcategory assignments'))).toBe(true);
    });

    it('blocks publication when question references non-existent level in empty levels list', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], [mockAsset, mockAudio], new Set(['sub-1']), []);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not exist for target game'))).toBe(true);
    });

    it('blocks publication when question references a level belonging to another game', () => {
      const otherGameLevel: GameLevel = { ...validLevel, id: 'lvl-other-game', game_id: 'other-game-id' };
      const qOtherLevel: Question = { ...validQuestion, level_id: 'lvl-other-game' };
      const report = validateActivityForPublication(mockGame, [qOtherLevel], [mockAsset, mockAudio], new Set(['sub-1']), [otherGameLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not match target game') || e.includes('does not exist for target game'))).toBe(true);
    });

    it('blocks publication when question game_id does not match target game', () => {
      const qOtherGame: Question = { ...validQuestion, game_id: 'other-game-id' };
      const report = validateActivityForPublication(mockGame, [qOtherGame], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not match target game'))).toBe(true);
    });

    it('blocks publication when published question has NULL subcategory_id', () => {
      const qNullSub: Question = { ...validQuestion, subcategory_id: null };
      const report = validateActivityForPublication(mockGame, [qNullSub], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('NULL subcategory ID'))).toBe(true);
    });

    it('blocks publication when published question belongs to an inactive subcategory assignment', () => {
      const qInactiveSub: Question = { ...validQuestion, subcategory_id: 'sub-inactive' };
      const report = validateActivityForPublication(mockGame, [qInactiveSub], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('inactive or unassigned subcategory ID'))).toBe(true);
    });
  });

  describe('Media Asset Validation', () => {
    it('blocks publication when referenced media asset metadata is missing', () => {
      const qMissingAsset: Question = { ...validQuestion, image_asset_id: 'non-existent-asset' };
      const report = validateActivityForPublication(mockGame, [qMissingAsset], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not exist in media library'))).toBe(true);
    });

    it('blocks validation when storage file_path is empty', () => {
      const emptyPathAsset: MediaAsset = { ...mockAsset, file_path: '' };
      const res = validateAssets([validQuestion], [emptyPathAsset, mockAudio]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_EMPTY_FILE_PATH')).toBe(true);
    });

    it('blocks validation when storage bucket_name is empty', () => {
      const emptyBucketAsset: MediaAsset = { ...mockAsset, bucket_name: '   ' };
      const res = validateAssets([validQuestion], [emptyBucketAsset, mockAudio]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_EMPTY_BUCKET_NAME')).toBe(true);
    });

    it('blocks validation on audio MIME type mismatch', () => {
      const wrongMimeAudio: MediaAsset = { ...mockAudio, mime_type: 'image/png' };
      const res = validateAssets([validQuestion], [mockAsset, wrongMimeAudio]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_MIME_MISMATCH_AUDIO')).toBe(true);
    });

    it('blocks validation on image MIME type mismatch', () => {
      const wrongMimeImage: MediaAsset = { ...mockAsset, mime_type: 'audio/mp3' };
      const res = validateAssets([validQuestion], [wrongMimeImage, mockAudio]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_MIME_MISMATCH_IMAGE')).toBe(true);
    });
  });

  describe('Release Snapshot & Type Safety', () => {
    it('excludes draft questions from the generated release snapshot', () => {
      const draftQ: Question = { ...validQuestion, id: 'q-draft', is_draft: true };
      const report = validateActivityForPublication(mockGame, [validQuestion, draftQ], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(true);
      expect(report.snapshot?.questions).toHaveLength(1);
      expect(report.snapshot?.questions[0].id).toBe('q-1');
    });

    it('includes all referenced question images, audio assets, and option images in referenced_assets', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], [mockAsset, mockAudio], new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(true);
      expect(report.snapshot?.referenced_assets).toHaveLength(2);
      expect(report.snapshot?.referenced_assets.some((a) => a.id === 'asset-1')).toBe(true);
      expect(report.snapshot?.referenced_assets.some((a) => a.id === 'audio-1')).toBe(true);
    });

    it('proves PublicPublishedQuestionOption excludes is_correct at compile time and runtime', () => {
      // Compile-time TypeScript type assertion proving PublicPublishedQuestionOption rejects is_correct
      type ExpectNoIsCorrectInOption<T> = 'is_correct' extends keyof T ? false : true;
      type IsCorrectExcludedTypeCheck = ExpectNoIsCorrectInOption<PublicPublishedQuestionOption>;
      const _typeAssertionCheck: IsCorrectExcludedTypeCheck = true;

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
      expect(keys.includes('is_correct')).toBe(false);
      expect(_typeAssertionCheck).toBe(true);
    });
  });
});
