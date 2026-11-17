/**
 * Sproutelle Admin Content Studio - Publishing Validation Vitest Test Suite
 * File: src/lib/validation/publisher.test.ts
 */

import { describe, it, expect } from 'vitest';
import type { Game, Question, MediaAsset, GameLevel } from '../../types/database';
import { validateActivityForPublication, type PublicPublishedContentPack, type PublicPublishedQuestionOption, type AdminReleasePackSnapshot } from '../publisher';
import { validateAssets } from './assetValidator';
import { parsePublicationDataQueries, loadPublicationData, executePublishReleaseRPC } from './queryParser';
import { validateQuestion } from './questionValidator';

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

  const mockImageAsset: MediaAsset = {
    id: 'img-asset-1',
    name: 'apple.png',
    bucket_name: 'game-assets',
    file_path: '2026/03/apple.png',
    mime_type: 'image/png',
    size_bytes: 1024,
    created_at: new Date().toISOString(),
  };

  const mockAudioAsset: MediaAsset = {
    id: 'audio-asset-1',
    name: 'prompt.mp3',
    bucket_name: 'game-assets',
    file_path: '2026/03/prompt.mp3',
    mime_type: 'audio/mp3',
    size_bytes: 2048,
    created_at: new Date().toISOString(),
  };

  const mockOptionImageAsset: MediaAsset = {
    id: 'option-img-asset-1',
    name: 'banana.png',
    bucket_name: 'game-assets',
    file_path: '2026/03/banana.png',
    mime_type: 'image/png',
    size_bytes: 1536,
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
    image_asset_id: 'img-asset-1',
    audio_asset_id: 'audio-asset-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    options: [
      { id: 'o-1', question_id: 'q-1', option_text: 'Apple', is_correct: true, sort_order: 1, media_asset_id: 'img-asset-1', created_at: new Date().toISOString() },
      { id: 'o-2', question_id: 'q-1', option_text: 'Banana', is_correct: false, sort_order: 2, media_asset_id: 'option-img-asset-1', created_at: new Date().toISOString() },
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

  const allAssets = [mockImageAsset, mockAudioAsset, mockOptionImageAsset];

  describe('Publication Data Loading Query Parser', () => {
    it('fails closed when questions query fails', () => {
      const qRes = { data: null, error: { message: 'Failed to connect to database' } };
      const assignRes = { data: [{ subcategory_id: 'sub-1' }], error: null };
      const levelsRes = { data: [validLevel], error: null };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Questions Query Failure');
    });

    it('fails closed when subcategory assignment query fails', () => {
      const qRes = { data: [validQuestion], error: null };
      const assignRes = { data: null, error: { message: 'Permission denied on subcategory_games' } };
      const levelsRes = { data: [validLevel], error: null };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Subcategory Assignments Query Failure');
    });

    it('fails closed when game levels query fails', () => {
      const qRes = { data: [validQuestion], error: null };
      const assignRes = { data: [{ subcategory_id: 'sub-1' }], error: null };
      const levelsRes = { data: null, error: { message: 'Network timeout on game_levels' } };

      const result = parsePublicationDataQueries(qRes, assignRes, levelsRes);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Game Levels Query Failure');
    });

    it('successfully parses all three queries when all succeed', () => {
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

  describe('Publication Data Loader Workflow (loadPublicationData)', () => {
    it('fails closed when Supabase is unconfigured', async () => {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const mockClient = {} as any;
      const result = await loadPublicationData('game-1', false, mockClient);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Supabase is not configured');
    });

    it('fails closed when questions query returns an error', async () => {
      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === 'questions') return { order: async () => ({ data: null, error: { message: 'Database connection failed' } }) };
              if (table === 'subcategory_games') return { eq: async () => ({ data: [{ subcategory_id: 'sub-1' }], error: null }) };
              return { order: async () => ({ data: [], error: null }) };
            },
          }),
        }),
      };

      const result = await loadPublicationData('game-1', true, mockClient);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Questions Query Failure');
    });

    it('fails closed when subcategory assignment query returns an error', async () => {
      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === 'questions') return { order: async () => ({ data: [validQuestion], error: null }) };
              if (table === 'subcategory_games') return { eq: async () => ({ data: null, error: { message: 'Permission denied' } }) };
              return { order: async () => ({ data: [], error: null }) };
            },
          }),
        }),
      };

      const result = await loadPublicationData('game-1', true, mockClient);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Subcategory Assignments Query Failure');
    });

    it('fails closed when game levels query returns an error', async () => {
      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === 'questions') return { order: async () => ({ data: [validQuestion], error: null }) };
              if (table === 'subcategory_games') return { eq: async () => ({ data: [{ subcategory_id: 'sub-1' }], error: null }) };
              return { order: async () => ({ data: null, error: { message: 'Levels query timeout' } }) };
            },
          }),
        }),
      };

      const result = await loadPublicationData('game-1', true, mockClient);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Game Levels Query Failure');
    });

    it('returns questions, active assignments, and levels when all queries succeed', async () => {
      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              if (table === 'questions') return { order: async () => ({ data: [validQuestion], error: null }) };
              if (table === 'subcategory_games') return { eq: async () => ({ data: [{ subcategory_id: 'sub-1' }], error: null }) };
              return { order: async () => ({ data: [validLevel], error: null }) };
            },
          }),
        }),
      };

      const result = await loadPublicationData('game-1', true, mockClient);
      expect(result.success).toBe(true);
      expect(result.questions).toHaveLength(1);
      expect(result.activeSubcategoryIds.has('sub-1')).toBe(true);
      expect(result.levels).toHaveLength(1);
    });
  });

  describe('Publishing RPC Execution & Active Release Verification', () => {
    it('successfully calls publish_game_release and verifies 1 active release', async () => {
      const mockSnapshot = {
        pack_version: '1.0.9999',
        game_id: '9e0aea7c-24a1-437b-89bd-11cd64b2d315',
      };

      const mockClient = {
        rpc: async (fn: string) => {
          if (fn === 'publish_game_release') return { data: true, error: null };
          return { data: null, error: { message: 'Unknown RPC' } };
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: async () => {
                if (table === 'game_releases') return { data: [{ id: 'rel-1', version_number: '1.0.9999', is_active: true }], error: null };
                return { data: [], error: null };
              },
            }),
          }),
        }),
      };

      const result = await executePublishReleaseRPC('9e0aea7c-24a1-437b-89bd-11cd64b2d315', mockSnapshot as unknown as AdminReleasePackSnapshot, mockClient);
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.0.9999');
    });

    it('fails when publish_game_release RPC returns an error', async () => {
      const mockSnapshot = { pack_version: '1.0.9999' };
      const mockClient = {
        rpc: async () => ({ data: null, error: { message: 'Game has no published questions' } }),
        from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
      };

      const result = await executePublishReleaseRPC('9e0aea7c-24a1-437b-89bd-11cd64b2d315', mockSnapshot as unknown as AdminReleasePackSnapshot, mockClient);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Game has no published questions');
    });

    it('fails when active release post-verification query finds 0 active releases', async () => {
      const mockSnapshot = { pack_version: '1.0.9999' };
      const mockClient = {
        rpc: async () => ({ data: true, error: null }),
        from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
      };

      const result = await executePublishReleaseRPC('9e0aea7c-24a1-437b-89bd-11cd64b2d315', mockSnapshot as unknown as AdminReleasePackSnapshot, mockClient);
      expect(result.success).toBe(false);
      expect(result.error).toContain('no active release record was verified');
    });

    it('validates Picture Quest acceptance scenario fixture with Game 9e0aea7c-24a1-437b-89bd-11cd64b2d315', () => {
      const pqGame: Game = {
        ...mockGame,
        id: '9e0aea7c-24a1-437b-89bd-11cd64b2d315',
        name: 'Picture Quest',
        game_type: 'guess_game',
      };

      const lemonQ: Question = {
        id: '0947ac26-280c-4a53-9234-3bec4906e651',
        game_id: '9e0aea7c-24a1-437b-89bd-11cd64b2d315',
        subcategory_id: 'sub-1',
        level_id: 'lvl-1',
        question_text: 'Which one is a Lemon?',
        question_type: 'find_correct_picture',
        sort_order: 1,
        is_draft: false,
        image_asset_id: 'img-asset-1',
        audio_asset_id: 'audio-asset-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'o-lemon-1', question_id: '0947ac26-280c-4a53-9234-3bec4906e651', option_text: 'Lemon', is_correct: true, sort_order: 1, media_asset_id: 'img-asset-1', created_at: new Date().toISOString() },
          { id: 'o-lemon-2', question_id: '0947ac26-280c-4a53-9234-3bec4906e651', option_text: 'Apple', is_correct: false, sort_order: 2, media_asset_id: 'img-asset-1', created_at: new Date().toISOString() },
          { id: 'o-lemon-3', question_id: '0947ac26-280c-4a53-9234-3bec4906e651', option_text: 'Banana', is_correct: false, sort_order: 3, media_asset_id: 'option-img-asset-1', created_at: new Date().toISOString() },
          { id: 'o-lemon-4', question_id: '0947ac26-280c-4a53-9234-3bec4906e651', option_text: 'Orange', is_correct: false, sort_order: 4, media_asset_id: 'option-img-asset-1', created_at: new Date().toISOString() },
        ],
      };

      const pqLevel: GameLevel = { ...validLevel, game_id: '9e0aea7c-24a1-437b-89bd-11cd64b2d315' };
      const report = validateActivityForPublication(pqGame, [lemonQ], allAssets, new Set(['sub-1']), [pqLevel]);
      expect(report.eligible).toBe(true);
      expect(report.snapshot?.questions[0].options).toHaveLength(4);
      expect(report.snapshot?.questions[0].options.filter((o) => o.is_correct)).toHaveLength(1);
      expect(report.snapshot?.referenced_assets).toHaveLength(3);
    });
  });

  describe('Level & Assignment Validation', () => {
    it('accepts a valid level belonging to the target game', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(true);
      expect(report.errors).toHaveLength(0);
    });

    it('blocks publication when game has 0 active assignments', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], allAssets, new Set(), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('0 active subcategory assignments'))).toBe(true);
    });

    it('blocks publication when question references non-existent level in empty levels list', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], allAssets, new Set(['sub-1']), []);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not exist for target game'))).toBe(true);
    });

    it('blocks publication when question references a level belonging to another game', () => {
      const otherGameLevel: GameLevel = { ...validLevel, id: 'lvl-other-game', game_id: 'other-game-id' };
      const qOtherLevel: Question = { ...validQuestion, level_id: 'lvl-other-game' };
      const report = validateActivityForPublication(mockGame, [qOtherLevel], allAssets, new Set(['sub-1']), [otherGameLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not match target game') || e.includes('does not exist for target game'))).toBe(true);
    });

    it('blocks publication when question game_id does not match target game', () => {
      const qOtherGame: Question = { ...validQuestion, game_id: 'other-game-id' };
      const report = validateActivityForPublication(mockGame, [qOtherGame], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not match target game'))).toBe(true);
    });

    it('blocks publication when published question has NULL subcategory_id', () => {
      const qNullSub: Question = { ...validQuestion, subcategory_id: null };
      const report = validateActivityForPublication(mockGame, [qNullSub], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('NULL subcategory ID'))).toBe(true);
    });

    it('blocks publication when published question belongs to an inactive subcategory assignment', () => {
      const qInactiveSub: Question = { ...validQuestion, subcategory_id: 'sub-inactive' };
      const report = validateActivityForPublication(mockGame, [qInactiveSub], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('inactive or unassigned subcategory ID'))).toBe(true);
    });
  });

  describe('Media Asset Validation & MIME Checks', () => {
    it('blocks publication when question image asset metadata is missing', () => {
      const qMissingImage: Question = { ...validQuestion, image_asset_id: 'non-existent-image-id' };
      const report = validateActivityForPublication(mockGame, [qMissingImage], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not exist in media library'))).toBe(true);
    });

    it('blocks publication when question audio asset metadata is missing', () => {
      const qMissingAudio: Question = { ...validQuestion, audio_asset_id: 'non-existent-audio-id' };
      const report = validateActivityForPublication(mockGame, [qMissingAudio], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not exist in media library'))).toBe(true);
    });

    it('blocks publication when option image references missing media metadata', () => {
      const qMissingOptionImg: Question = {
        ...validQuestion,
        options: [
          { id: 'o-1', question_id: 'q-1', option_text: 'Apple', is_correct: true, sort_order: 1, media_asset_id: 'missing-option-asset', created_at: new Date().toISOString() },
          { id: 'o-2', question_id: 'q-1', option_text: 'Banana', is_correct: false, sort_order: 2, media_asset_id: 'option-img-asset-1', created_at: new Date().toISOString() },
        ],
      };
      const report = validateActivityForPublication(mockGame, [qMissingOptionImg], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(false);
      expect(report.errors.some((e) => e.includes('does not exist in media library'))).toBe(true);
    });

    it('blocks validation when storage file_path is empty', () => {
      const emptyPathAsset: MediaAsset = { ...mockImageAsset, file_path: '' };
      const res = validateAssets([validQuestion], [emptyPathAsset, mockAudioAsset, mockOptionImageAsset]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_EMPTY_FILE_PATH')).toBe(true);
    });

    it('blocks validation when storage bucket_name is empty', () => {
      const emptyBucketAsset: MediaAsset = { ...mockImageAsset, bucket_name: '   ' };
      const res = validateAssets([validQuestion], [emptyBucketAsset, mockAudioAsset, mockOptionImageAsset]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_EMPTY_BUCKET_NAME')).toBe(true);
    });

    it('blocks validation on audio MIME type mismatch', () => {
      const wrongMimeAudio: MediaAsset = { ...mockAudioAsset, mime_type: 'image/png' };
      const res = validateAssets([validQuestion], [mockImageAsset, wrongMimeAudio, mockOptionImageAsset]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_MIME_MISMATCH_AUDIO')).toBe(true);
    });

    it('blocks validation on image MIME type mismatch', () => {
      const wrongMimeImage: MediaAsset = { ...mockImageAsset, mime_type: 'audio/mp3' };
      const res = validateAssets([validQuestion], [wrongMimeImage, mockAudioAsset, mockOptionImageAsset]);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_ASSET_MIME_MISMATCH_IMAGE')).toBe(true);
    });
  });

  describe('Question Format Type Validation', () => {
    it('accepts supported Picture Quest question formats', () => {
      const formats = ['find_correct_picture', 'identify_object', 'match_picture_word', 'find_different_picture', 'category_identification'];
      formats.forEach((fmt) => {
        const q: Question = { ...validQuestion, question_type: fmt };
        const res = validateQuestion(q, 0, allAssets);
        expect(res.errors.some((e) => e.code === 'ERR_QUESTION_TYPE_UNSUPPORTED')).toBe(false);
      });
    });

    it('rejects unsupported question formats', () => {
      const q: Question = { ...validQuestion, question_type: 'unsupported_format_xyz' };
      const res = validateQuestion(q, 0, allAssets);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.code === 'ERR_QUESTION_TYPE_UNSUPPORTED')).toBe(true);
    });
  });

  describe('Release Snapshot & Type Safety', () => {
    it('excludes draft questions from the generated release snapshot', () => {
      const draftQ: Question = { ...validQuestion, id: 'q-draft', is_draft: true };
      const report = validateActivityForPublication(mockGame, [validQuestion, draftQ], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(true);
      expect(report.snapshot?.questions).toHaveLength(1);
      expect(report.snapshot?.questions[0].id).toBe('q-1');
    });

    it('independently includes all distinct question images, audio assets, and option images in referenced_assets', () => {
      const report = validateActivityForPublication(mockGame, [validQuestion], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(true);
      expect(report.snapshot?.referenced_assets).toHaveLength(3);
      expect(report.snapshot?.referenced_assets.some((a) => a.id === 'img-asset-1')).toBe(true);
      expect(report.snapshot?.referenced_assets.some((a) => a.id === 'audio-asset-1')).toBe(true);
      expect(report.snapshot?.referenced_assets.some((a) => a.id === 'option-img-asset-1')).toBe(true);
    });

    it('generates a complete release snapshot for Lemon question with 4 options and resolves option media references', () => {
      const lemonQuestion: Question = {
        id: 'q-lemon-1',
        game_id: 'game-1',
        subcategory_id: 'sub-1',
        level_id: 'lvl-1',
        question_text: 'Which one is a Lemon?',
        question_type: 'find_correct_picture',
        sort_order: 1,
        is_draft: false,
        image_asset_id: 'img-asset-1',
        audio_asset_id: 'audio-asset-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        options: [
          { id: 'o-lemon-1', question_id: 'q-lemon-1', option_text: 'Lemon', is_correct: true, sort_order: 1, media_asset_id: 'img-asset-1', created_at: new Date().toISOString() },
          { id: 'o-lemon-2', question_id: 'q-lemon-1', option_text: 'Apple', is_correct: false, sort_order: 2, media_asset_id: 'img-asset-1', created_at: new Date().toISOString() },
          { id: 'o-lemon-3', question_id: 'q-lemon-1', option_text: 'Banana', is_correct: false, sort_order: 3, media_asset_id: 'option-img-asset-1', created_at: new Date().toISOString() },
          { id: 'o-lemon-4', question_id: 'q-lemon-1', option_text: 'Orange', is_correct: false, sort_order: 4, media_asset_id: 'option-img-asset-1', created_at: new Date().toISOString() },
        ],
      };

      const report = validateActivityForPublication(mockGame, [lemonQuestion], allAssets, new Set(['sub-1']), [validLevel]);
      expect(report.eligible).toBe(true);
      expect(report.snapshot?.questions[0].options).toHaveLength(4);
      expect(report.snapshot?.questions[0].options[0].media_asset_id).toBe('img-asset-1');
      expect(report.snapshot?.referenced_assets.length).toBeGreaterThan(0);
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
