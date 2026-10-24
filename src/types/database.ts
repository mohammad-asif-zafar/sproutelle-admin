export interface AdminUser {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  bucket_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256?: string | null;
  created_by?: string | null;
  created_at: string;
  // Computed / expanded helper
  public_url?: string;
}

export interface GameCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_asset_id?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined media
  icon_asset?: MediaAsset | null;
}

export interface Game {
  id: string;
  category_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  game_type: 'multiple_choice' | 'matching' | 'image_selection' | 'audio_recognition' | string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined category
  category?: GameCategory | null;
}

export interface GameLevel {
  id: string;
  game_id: string;
  level_number: number;
  title?: string | null;
  description?: string | null;
  pass_score: number;
  sort_order: number;
  created_at: string;
  // Joined game
  game?: Game | null;
}

export interface Question {
  id: string;
  game_id: string;
  level_id?: string | null;
  question_text: string;
  question_type: string;
  instructions?: string | null;
  sort_order: number;
  is_draft: boolean;
  config?: Record<string, unknown> | null;
  image_asset_id?: string | null;
  audio_asset_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined media / level / game
  image_asset?: MediaAsset | null;
  audio_asset?: MediaAsset | null;
  options?: QuestionOption[];
  game?: Game | null;
  level?: GameLevel | null;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text?: string | null;
  is_correct: boolean;
  sort_order: number;
  media_asset_id?: string | null;
  created_at: string;
  // Joined media
  media_asset?: MediaAsset | null;
}

/**
 * Public view interface for mobile clients consuming options (omits answer key `is_correct`)
 */
export interface PublishedQuestionOption {
  id: string;
  question_id: string;
  option_text?: string | null;
  sort_order: number;
  media_asset_id?: string | null;
  created_at: string;
}

export interface ActivityMedia {
  id: string;
  media_id: string;
  target_type: string;
  target_id: string;
  usage_role: 'question_image' | 'answer_image' | 'instruction_audio' | 'background_image' | 'character_animation' | string;
  created_at: string;
  media?: MediaAsset | null;
}

export interface GameVersion {
  id: string;
  version_number: string;
  release_notes?: string | null;
  min_app_version?: string | null;
  is_active: boolean;
  published_at?: string | null;
  created_at: string;
}

export type TableName =
  | 'media_assets'
  | 'game_categories'
  | 'games'
  | 'game_levels'
  | 'questions'
  | 'question_options'
  | 'activity_media'
  | 'game_versions'
  | 'admin_users';

export interface DashboardMetrics {
  totalMediaAssets: number;
  totalCategories: number;
  totalGames: number;
  totalQuestions: number;
  totalGameVersions: number;
  recentChanges: Array<{
    id: string;
    type: string;
    title: string;
    timestamp: string;
  }>;
}
