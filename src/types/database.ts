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
  subcategory_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  game_type: 'multiple_choice' | 'matching' | 'image_selection' | 'audio_recognition' | 'true_false' | string;
  config?: Record<string, unknown> | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined relations
  category?: GameCategory | null;
  subcategory?: HomescreenExplorerSubcategory | null;
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

export interface HomescreenExplorer {
  id: string;
  title_name: string;
  title_image_asset_id?: string | null;
  background_color: string;
  category_id?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  title_image_asset?: MediaAsset | null;
  category?: GameCategory | null;
}

export interface HomescreenExplorerSubcategory {
  id: string;
  explorer_id: string;
  name: string;
  image_asset_id?: string | null;
  background_color: string;
  category_id?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  image_asset?: MediaAsset | null;
  category?: GameCategory | null;
  explorer?: HomescreenExplorer | null;
}

export interface GameRelease {
  id: string;
  game_id: string;
  version_number: string;
  pack_data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface SubcategoryGameAssignment {
  id: string;
  subcategory_id: string;
  game_id: string;
  enabled_patterns: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  game?: Game | null;
  subcategory?: HomescreenExplorerSubcategory | null;
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
  | 'homescreen_explorer'
  | 'homescreen_explorer_subcategories'
  | 'subcategory_games'
  | 'game_releases'
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
