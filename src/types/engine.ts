/**
 * Sproutelle Admin Content Studio - Dynamic Game Engine Registry
 * File: src/types/engine.ts
 */

export type EngineType =
  | 'guess_game'
  | 'matching_fun'
  | 'spelling_bee'
  | 'garden_quiz'
  | 'memory_flip';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface BaseEngineConfig {
  question_count: number;
  difficulty: DifficultyLevel;
  min_age: number;
  max_age: number;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  hints_enabled: boolean;
  audio_narration: boolean;
  retry_limit: number;
  feedback_behavior: 'instant' | 'session_end';
}

export interface GuessGameConfig extends BaseEngineConfig {
  option_count: number; // 2, 3, 4
  allow_picture_options: boolean;
}

export interface MatchingFunConfig extends BaseEngineConfig {
  pair_count: number; // 3, 4, 6
  match_type: 'image_to_text' | 'image_to_image' | 'audio_to_image' | 'word_to_meaning';
}

export interface SpellingBeeConfig extends BaseEngineConfig {
  missing_letter_mode: boolean;
  show_letter_bank: boolean;
  case_sensitive: boolean;
}

export interface GardenQuizConfig extends BaseEngineConfig {
  pass_percentage: number; // 50 - 100
  show_explanation: boolean;
}

export interface MemoryFlipConfig extends BaseEngineConfig {
  grid_size: '2x2' | '2x3' | '3x4' | '4x4';
  flip_delay_ms: number;
}

export type EngineConfig =
  | GuessGameConfig
  | MatchingFunConfig
  | SpellingBeeConfig
  | GardenQuizConfig
  | MemoryFlipConfig;

export interface EngineTemplateDefinition {
  id: EngineType;
  legacyGameType: string;
  name: string;
  tagline: string;
  description: string;
  supportedQuestionTypes: string[];
  defaultConfig: BaseEngineConfig;
}

export const GAME_ENGINE_REGISTRY: Record<EngineType, EngineTemplateDefinition> = {
  guess_game: {
    id: 'guess_game',
    legacyGameType: 'multiple_choice',
    name: 'Guess Game',
    tagline: 'Choose the correct answer from picture or text cards',
    description: 'Interactive multiple choice and picture selection challenge for young learners.',
    supportedQuestionTypes: ['multiple_choice', 'image_selection', 'audio_recognition'],
    defaultConfig: {
      question_count: 5,
      difficulty: 'beginner',
      min_age: 3,
      max_age: 6,
      shuffle_questions: true,
      shuffle_answers: true,
      hints_enabled: true,
      audio_narration: true,
      retry_limit: 3,
      feedback_behavior: 'instant',
    },
  },
  matching_fun: {
    id: 'matching_fun',
    legacyGameType: 'matching',
    name: 'Matching Fun',
    tagline: 'Connect related pictures, letters, sounds, or words',
    description: 'Develops cognitive association by pairing matching learning cards.',
    supportedQuestionTypes: ['matching'],
    defaultConfig: {
      question_count: 4,
      difficulty: 'beginner',
      min_age: 3,
      max_age: 7,
      shuffle_questions: true,
      shuffle_answers: true,
      hints_enabled: true,
      audio_narration: true,
      retry_limit: 3,
      feedback_behavior: 'instant',
    },
  },
  spelling_bee: {
    id: 'spelling_bee',
    legacyGameType: 'spelling',
    name: 'Spelling Bee',
    tagline: 'Construct words using letter tiles or missing letter tiles',
    description: 'Phonics and early spelling builder with visual and audio prompts.',
    supportedQuestionTypes: ['spelling', 'missing_letters'],
    defaultConfig: {
      question_count: 5,
      difficulty: 'intermediate',
      min_age: 5,
      max_age: 8,
      shuffle_questions: true,
      shuffle_answers: false,
      hints_enabled: true,
      audio_narration: true,
      retry_limit: 3,
      feedback_behavior: 'instant',
    },
  },
  garden_quiz: {
    id: 'garden_quiz',
    legacyGameType: 'true_false',
    name: 'Garden Quiz',
    tagline: 'True / False and quiz questions in Sproutelle’s garden environment',
    description: 'Engaging quiz format encouraging kids through positive reinforcement.',
    supportedQuestionTypes: ['true_false', 'quiz'],
    defaultConfig: {
      question_count: 5,
      difficulty: 'beginner',
      min_age: 4,
      max_age: 8,
      shuffle_questions: true,
      shuffle_answers: false,
      hints_enabled: true,
      audio_narration: true,
      retry_limit: 2,
      feedback_behavior: 'instant',
    },
  },
  memory_flip: {
    id: 'memory_flip',
    legacyGameType: 'memory',
    name: 'Memory Flip',
    tagline: 'Flip cards and discover hidden matching pairs',
    description: 'Boosts visual memory, attention span, and recognition.',
    supportedQuestionTypes: ['memory_pairs'],
    defaultConfig: {
      question_count: 6,
      difficulty: 'intermediate',
      min_age: 4,
      max_age: 8,
      shuffle_questions: true,
      shuffle_answers: true,
      hints_enabled: false,
      audio_narration: true,
      retry_limit: 5,
      feedback_behavior: 'instant',
    },
  },
};

export function getDefaultEngineConfig(engineType: EngineType): Record<string, unknown> {
  const engine = GAME_ENGINE_REGISTRY[engineType] || GAME_ENGINE_REGISTRY.guess_game;
  return { ...engine.defaultConfig };
}

export function validateEngineConfig(
  _engineType: EngineType,
  config: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const questionCount = Number(config.question_count ?? 5);
  if (isNaN(questionCount) || questionCount < 1 || questionCount > 20) {
    errors.push('Question count per session must be between 1 and 20.');
  }

  const minAge = Number(config.min_age ?? 3);
  const maxAge = Number(config.max_age ?? 8);
  if (isNaN(minAge) || minAge < 3 || minAge > 12) {
    errors.push('Minimum age must be between 3 and 12.');
  }
  if (isNaN(maxAge) || maxAge < minAge || maxAge > 12) {
    errors.push('Maximum age must be greater than or equal to minimum age.');
  }

  const difficulty = String(config.difficulty || 'beginner');
  if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    errors.push('Difficulty must be beginner, intermediate, or advanced.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
