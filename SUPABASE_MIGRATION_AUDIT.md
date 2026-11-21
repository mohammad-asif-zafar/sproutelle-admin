# Sproutelle Admin — Comprehensive Supabase Backend & Migration Audit Report (Phase 1C.2 Final Evidence Corrections)

**Target Architecture:**
- **Database:** Neon PostgreSQL
- **Media Storage:** Cloudflare R2
- **Backend API & Publishing Engine:** Cloudflare Workers
- **Authentication & Identity:** Better Auth
- **Admin Portal Frontend:** React 19 + TypeScript + Vite SPA (`sproutelle-admin`)

---

## 1. Chronological SQL Migration Inventory

Inspection of all files under `supabase/migrations/` establishes the complete chronological SQL migration inventory:

1. **`20260330000000_initial_schema.sql`** (610 lines):
   - Extension `uuid-ossp` (L34). **[VERIFIED]**
   - `admin_users` table (L37). **[VERIFIED]**
   - `public.is_admin()` SECURITY DEFINER function (L47–63). **[VERIFIED]**
   - `media_assets` table (L71). **[VERIFIED]**
   - `game_categories` table (L88). **[VERIFIED]**
   - `games` table (L105). **[VERIFIED]**
   - `game_levels` table (L124). **[VERIFIED]**
   - `public.validate_game_level_update()` trigger function & trigger `trg_validate_game_level_update` (L136–158). **[VERIFIED]**
   - `questions` table (L161) with FK `fk_questions_level_game`. **[VERIFIED]**
   - `public.validate_question_level_game()` trigger function & trigger `trg_validate_question_level_game` (L178–206). **[VERIFIED]**
   - `question_options` table (L209). **[VERIFIED]**
   - `activity_media` table (L223). **[VERIFIED]**
   - `game_versions` table (L236). **[VERIFIED]**
   - `homescreen_explorer` table (L248). **[VERIFIED]**
   - Explicit table REVOKEs & GRANTs (L266–280). **[VERIFIED]**
   - View `public.published_question_options` (L283–297). **[VERIFIED]**
   - `public.is_published_media_asset(p_file_path TEXT)` SECURITY DEFINER function (L300–350). **[VERIFIED]**
   - Row Level Security (RLS) policies for all tables (L404–583). **[VERIFIED]**
   - Storage bucket `'game-assets'` creation (`public = false`) & storage policies (L587–608). **[VERIFIED]**
2. **`20260330000100_add_homescreen_explorer.sql`** (90 lines):
   - Additive migration for `homescreen_explorer` table, RLS policies, and grants. **[VERIFIED]**
3. **`20260330000200_add_homescreen_explorer_subcategories.sql`** (106 lines):
   - `homescreen_explorer_subcategories` table (L12). **[VERIFIED]**
   - Grants & RLS policies (L30–104). **[VERIFIED]**
   - Updates `public.is_published_media_asset()` to support subcategory icon paths (L36–75). **[VERIFIED]**
4. **`20260330000300_add_game_subcategory.sql`** (13 lines):
   - Adds legacy nullable foreign key `subcategory_id` to `games` table:
     `ALTER TABLE public.games ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.homescreen_explorer_subcategories(id) ON DELETE SET NULL;` (L10). **[VERIFIED]**
5. **`20260330000400_engine_registry_and_releases.sql`** (57 lines):
   - Adds `config` JSONB column to `games` table (L10). **[VERIFIED]**
   - Creates `game_releases` table (L15). **[VERIFIED]**
   - Grants & RLS policies for `game_releases` (L27–55). **[VERIFIED]**
6. **`20260330000500_atomic_publish_function.sql`** (64 lines):
   - Creates initial atomic `public.publish_game_release(p_game_id UUID, p_version_number TEXT, p_pack_data JSONB)` function (L12). **[VERIFIED]**
7. **`20260330000600_harden_publish_function.sql`** (92 lines):
   - Hardens `publish_game_release()` with `SELECT ... FOR UPDATE` row locking and question existence validation (L12). **[VERIFIED]**
8. **`20260330000700_harden_publish_constraints.sql`** (108 lines):
   - Creates unique index `idx_game_releases_game_version` ON `game_releases(game_id, version_number)` (L11). **[VERIFIED]**
   - Creates partial unique index `idx_game_releases_single_active` ON `game_releases(game_id) WHERE is_active = TRUE` (L14). **[VERIFIED]**
   - Updates `publish_game_release()` with idempotent retry handling (L20–106). **[VERIFIED]**
9. **`20260330000800_final_harden_publish.sql`** (179 lines):
   - Revokes direct `anon` SELECT on `game_releases`, grants SELECT to `authenticated` (L13). **[VERIFIED]**
   - Creates sanitized public RPC `public.get_published_content_pack(p_game_id UUID)` returning JSONB with `is_correct` stripped from options (L19–82). **[VERIFIED]**
   - Finalizes `publish_game_release()` function (L84–177). **[VERIFIED]**
10. **`20260330000900_add_subcategory_games.sql`** (59 lines):
    - Creates `subcategory_games` junction table with `CONSTRAINT subcategory_games_unique_assignment UNIQUE (subcategory_id, game_id)` (L12). **[VERIFIED]**
    - Grants & RLS policies (L28–57). **[VERIFIED]**
11. **`20260330001000_atomic_subcategory_games.sql`** (79 lines):
    - Creates atomic SECURITY DEFINER RPC `public.save_subcategory_games(p_subcategory_id UUID, p_assignments JSONB)` (L12–77). **[VERIFIED]**
12. **`20260330001100_atomic_create_sub_with_games.sql`** (178 lines):
    - Creates all-in-one atomic `save_subcategory_with_games(...)` RPC function with engine pattern allowlist validation (L12–176). **[VERIFIED]**

---

## 2. Table Specifications & Database Inventory

| Table Name | Primary Key | Verified Columns & Data Types | Nullability & Default Values | Foreign Key Constraints & Cascades | Unique Constraints & Indexes | Migration Reference | Status |
|---|---|---|---|---|---|---|---|
| `admin_users` | `id` (UUID) | `id` UUID<br>`email` TEXT<br>`is_admin` BOOLEAN<br>`created_at` TIMESTAMPTZ | `id` NOT NULL<br>`email` NOT NULL<br>`is_admin` DEFAULT FALSE<br>`created_at` DEFAULT NOW() | `id` $\rightarrow$ `auth.users(id)` ON DELETE CASCADE | PK (`id`) | `20260330000000_initial_schema.sql:37` | **[VERIFIED]** |
| `media_assets` | `id` (UUID) | `id` UUID<br>`name` TEXT<br>`bucket_name` TEXT<br>`file_path` TEXT<br>`mime_type` TEXT<br>`size_bytes` BIGINT<br>`checksum_sha256` TEXT<br>`created_by` UUID<br>`created_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`name` NOT NULL<br>`bucket_name` NOT NULL DEFAULT 'game-assets'<br>`file_path` NOT NULL<br>`mime_type` NOT NULL<br>`size_bytes` NOT NULL<br>`created_by` NULLABLE<br>`created_at` DEFAULT NOW() | `created_by` $\rightarrow$ `auth.users(id)` ON DELETE SET NULL | PK (`id`)<br>UNIQUE (`file_path`) | `20260330000000_initial_schema.sql:71` | **[VERIFIED]** |
| `game_categories` | `id` (UUID) | `id` UUID<br>`name` TEXT<br>`slug` TEXT<br>`description` TEXT<br>`icon_asset_id` UUID<br>`sort_order` INT<br>`created_at` TIMESTAMPTZ<br>`updated_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`name` NOT NULL<br>`slug` NOT NULL<br>`description` NULLABLE<br>`icon_asset_id` NULLABLE<br>`sort_order` DEFAULT 0<br>`created_at` DEFAULT NOW()<br>`updated_at` DEFAULT NOW() | `icon_asset_id` $\rightarrow$ `media_assets(id)` ON DELETE SET NULL | PK (`id`)<br>UNIQUE (`slug`) | `20260330000000_initial_schema.sql:88` | **[VERIFIED]** |
| `games` | `id` (UUID) | `id` UUID<br>`category_id` UUID<br>`subcategory_id` UUID<br>`name` TEXT<br>`slug` TEXT<br>`description` TEXT<br>`game_type` TEXT<br>`config` JSONB<br>`is_published` BOOLEAN<br>`sort_order` INT<br>`created_at` TIMESTAMPTZ<br>`updated_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`category_id` NULLABLE<br>`subcategory_id` NULLABLE<br>`name` NOT NULL<br>`slug` NOT NULL<br>`game_type` NOT NULL DEFAULT 'multiple_choice'<br>`config` NOT NULL DEFAULT '{}'<br>`is_published` DEFAULT FALSE<br>`sort_order` DEFAULT 0 | `category_id` $\rightarrow$ `game_categories(id)` ON DELETE CASCADE<br>`subcategory_id` $\rightarrow$ `homescreen_explorer_subcategories(id)` ON DELETE SET NULL | PK (`id`)<br>UNIQUE (`slug`) | `20260330000000_initial_schema.sql:105`<br>`20260330000300_add_game_subcategory.sql:10`<br>`20260330000400_engine_registry_and_releases.sql:10` | **[VERIFIED]** |
| `game_levels` | `id` (UUID) | `id` UUID<br>`game_id` UUID<br>`level_number` INT<br>`title` TEXT<br>`description` TEXT<br>`pass_score` INT<br>`sort_order` INT<br>`created_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`game_id` NOT NULL<br>`level_number` NOT NULL<br>`title` NULLABLE<br>`description` NULLABLE<br>`pass_score` DEFAULT 100<br>`sort_order` DEFAULT 0<br>`created_at` DEFAULT NOW() | `game_id` $\rightarrow$ `games(id)` ON DELETE CASCADE | PK (`id`)<br>`game_levels_id_game_id_key` UNIQUE (`id`, `game_id`) | `20260330000000_initial_schema.sql:124` | **[VERIFIED]** |
| `questions` | `id` (UUID) | `id` UUID<br>`game_id` UUID<br>`subcategory_id` UUID<br>`level_id` UUID<br>`question_text` TEXT<br>`question_type` TEXT<br>`instructions` TEXT<br>`sort_order` INT<br>`is_draft` BOOLEAN<br>`config` JSONB<br>`image_asset_id` UUID<br>`audio_asset_id` UUID<br>`created_at` TIMESTAMPTZ<br>`updated_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`game_id` NOT NULL<br>`subcategory_id` NULLABLE<br>`level_id` NULLABLE<br>`question_text` NOT NULL<br>`question_type` NOT NULL DEFAULT 'multiple_choice'<br>`instructions` NULLABLE<br>`sort_order` DEFAULT 0<br>`is_draft` DEFAULT TRUE<br>`config` DEFAULT '{}'<br>`image_asset_id` NULLABLE<br>`audio_asset_id` NULLABLE | `game_id` $\rightarrow$ `games(id)` ON DELETE CASCADE<br>`subcategory_id` $\rightarrow$ `homescreen_explorer_subcategories(id)` ON DELETE CASCADE<br>`level_id` $\rightarrow$ `game_levels(id)` ON DELETE SET NULL<br>`fk_questions_level_game`: (`level_id`, `game_id`) $\rightarrow$ `game_levels(id`, `game_id`) ON UPDATE CASCADE | PK (`id`) | `20260330000000_initial_schema.sql:161` | **[VERIFIED]** |
| `question_options` | `id` (UUID) | `id` UUID<br>`question_id` UUID<br>`option_text` TEXT<br>`is_correct` BOOLEAN<br>`sort_order` INT<br>`media_asset_id` UUID<br>`created_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`question_id` NOT NULL<br>`option_text` NULLABLE<br>`is_correct` DEFAULT FALSE<br>`sort_order` DEFAULT 0<br>`media_asset_id` NULLABLE<br>`created_at` DEFAULT NOW() | `question_id` $\rightarrow$ `questions(id)` ON DELETE CASCADE<br>`media_asset_id` $\rightarrow$ `media_assets(id)` ON DELETE SET NULL | PK (`id`) | `20260330000000_initial_schema.sql:209` | **[VERIFIED]** |
| `activity_media` | `id` (UUID) | `id` UUID<br>`media_id` UUID<br>`target_type` TEXT<br>`target_id` UUID<br>`usage_role` TEXT<br>`created_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`media_id` NULLABLE<br>`target_type` NOT NULL<br>`target_id` NOT NULL<br>`usage_role` NOT NULL<br>`created_at` DEFAULT NOW() | `media_id` $\rightarrow$ `media_assets(id)` ON DELETE CASCADE | PK (`id`) | `20260330000000_initial_schema.sql:223` | **[VERIFIED]** |
| `game_versions` | `id` (UUID) | `id` UUID<br>`version_number` TEXT<br>`release_notes` TEXT<br>`min_app_version` TEXT<br>`is_active` BOOLEAN<br>`published_at` TIMESTAMPTZ<br>`created_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`version_number` NOT NULL<br>`release_notes` NULLABLE<br>`min_app_version` NULLABLE<br>`is_active` DEFAULT FALSE<br>`published_at` NULLABLE<br>`created_at` DEFAULT NOW() | — | PK (`id`)<br>UNIQUE (`version_number`) | `20260330000000_initial_schema.sql:236` | **[VERIFIED]** |
| `homescreen_explorer` | `id` (UUID) | `id` UUID<br>`title_name` TEXT<br>`title_image_asset_id` UUID<br>`background_color` TEXT<br>`category_id` UUID<br>`sort_order` INT<br>`is_active` BOOLEAN<br>`created_at` TIMESTAMPTZ<br>`updated_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`title_name` NOT NULL<br>`title_image_asset_id` NULLABLE<br>`background_color` DEFAULT '#FFF0F3'<br>`sort_order` DEFAULT 0<br>`is_active` DEFAULT TRUE | `title_image_asset_id` $\rightarrow$ `media_assets(id)` ON DELETE SET NULL<br>`category_id` $\rightarrow$ `game_categories(id)` ON DELETE SET NULL | PK (`id`) | `20260330000000_initial_schema.sql:248` | **[VERIFIED]** |
| `homescreen_explorer_subcategories` | `id` (UUID) | `id` UUID<br>`explorer_id` UUID<br>`name` TEXT<br>`image_asset_id` UUID<br>`background_color` TEXT<br>`category_id` UUID<br>`sort_order` INT<br>`is_active` BOOLEAN<br>`created_at` TIMESTAMPTZ<br>`updated_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`explorer_id` NOT NULL<br>`name` NOT NULL<br>`image_asset_id` NULLABLE<br>`background_color` DEFAULT '#FFF0F3'<br>`sort_order` DEFAULT 0<br>`is_active` DEFAULT TRUE | `explorer_id` $\rightarrow$ `homescreen_explorer(id)` ON DELETE CASCADE<br>`image_asset_id` $\rightarrow$ `media_assets(id)` ON DELETE SET NULL<br>`category_id` $\rightarrow$ `game_categories(id)` ON DELETE SET NULL | PK (`id`) | `20260330000200_add_homescreen_explorer_subcategories.sql:12` | **[VERIFIED]** |
| `subcategory_games` | `id` (UUID) | `id` UUID<br>`subcategory_id` UUID<br>`game_id` UUID<br>`enabled_patterns` JSONB<br>`sort_order` INT<br>`is_active` BOOLEAN<br>`created_at` TIMESTAMPTZ<br>`updated_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`subcategory_id` NOT NULL<br>`game_id` NOT NULL<br>`enabled_patterns` DEFAULT '[]'<br>`sort_order` DEFAULT 0<br>`is_active` DEFAULT TRUE | `subcategory_id` $\rightarrow$ `homescreen_explorer_subcategories(id)` ON DELETE CASCADE<br>`game_id` $\rightarrow$ `games(id)` ON DELETE CASCADE | PK (`id`)<br>`subcategory_games_unique_assignment` UNIQUE (`subcategory_id`, `game_id`) | `20260330000900_add_subcategory_games.sql:12` | **[VERIFIED]** |
| `game_releases` | `id` (UUID) | `id` UUID<br>`game_id` UUID<br>`version_number` TEXT<br>`pack_data` JSONB<br>`is_active` BOOLEAN<br>`created_at` TIMESTAMPTZ | `id` DEFAULT gen_random_uuid()<br>`game_id` NOT NULL<br>`version_number` NOT NULL<br>`pack_data` NOT NULL<br>`is_active` DEFAULT TRUE<br>`created_at` DEFAULT NOW() | `game_id` $\rightarrow$ `games(id)` ON DELETE CASCADE | PK (`id`)<br>`idx_game_releases_game_version` UNIQUE (`game_id`, `version_number`)<br>`idx_game_releases_single_active` UNIQUE (`game_id`) WHERE `is_active` = TRUE | `20260330000400_engine_registry_and_releases.sql:15`<br>`20260330000700_harden_publish_constraints.sql:11–14` | **[VERIFIED]** |

---

## 3. Database Permissions, Table Grants & Complete RLS Statements

### A. Exact Table Enable RLS & Enable RLS Inventory (`[VERIFIED]`)

```sql
-- Executed across initial schema and additive migrations for all 13 tables:
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;                  -- 20260330000000_initial_schema.sql:43
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;                 -- 20260330000000_initial_schema.sql:84
ALTER TABLE public.game_categories              ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:101
ALTER TABLE public.games                        ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:120
ALTER TABLE public.game_levels                  ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:133
ALTER TABLE public.questions                    ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:175
ALTER TABLE public.question_options             ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:220
ALTER TABLE public.activity_media               ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:233
ALTER TABLE public.game_versions               ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:245
ALTER TABLE public.homescreen_explorer          ENABLE ROW LEVEL SECURITY; -- 20260330000000_initial_schema.sql:260
ALTER TABLE public.homescreen_explorer_subcategories ENABLE ROW LEVEL SECURITY; -- 20260330000200_add_homescreen_explorer_subcategories.sql:27
ALTER TABLE public.subcategory_games            ENABLE ROW LEVEL SECURITY; -- 20260330000900_add_subcategory_games.sql:25
ALTER TABLE public.game_releases                ENABLE ROW LEVEL SECURITY; -- 20260330000400_engine_registry_and_releases.sql:25
```

---

### B. Table Grants & Privileges (Separate from RLS Policies) (`[VERIFIED]`)

```sql
-- admin_users (20260330000000_initial_schema.sql:266-267)
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_users TO service_role;

-- question_options (20260330000000_initial_schema.sql:270-271)
REVOKE ALL ON TABLE public.question_options FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_options TO authenticated, service_role;

-- game_releases (20260330000800_final_harden_publish.sql:13-14)
REVOKE SELECT ON TABLE public.game_releases FROM anon;
GRANT SELECT ON TABLE public.game_releases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.game_releases TO service_role;

-- Standard Content Tables (20260330000000_initial_schema.sql:274-278, 20260330000200_add_homescreen_explorer_subcategories.sql:30-31, 20260330000900_add_subcategory_games.sql:28-29)
GRANT SELECT ON TABLE public.media_assets, public.game_categories, public.games, public.game_levels, public.questions, public.activity_media, public.game_versions, public.homescreen_explorer, public.homescreen_explorer_subcategories, public.subcategory_games TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.media_assets, public.game_categories, public.games, public.game_levels, public.questions, public.activity_media, public.game_versions, public.homescreen_explorer, public.homescreen_explorer_subcategories, public.subcategory_games TO authenticated, service_role;
```

---

### C. Complete Row Level Security Policies Inventory (All 13 Tables) (`[VERIFIED]`)

| Table | Policy Name | Command | Roles | USING Expression | WITH CHECK Expression | Security Dependencies |
|---|---|---|---|---|---|---|
| `admin_users` | `Users can view own admin_users record` | SELECT | authenticated | `id = (SELECT auth.uid()) OR public.is_admin()` | — | `auth.uid()`, `public.is_admin()` |
| `admin_users` | `Admins can manage admin_users` | ALL | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `media_assets` | `Public or Admin select media_assets` | SELECT | anon, authenticated | `public.is_admin() OR public.is_published_media_asset(public.media_assets.file_path)` | — | `is_published_media_asset()` |
| `media_assets` | `Admins can insert media_assets` | INSERT | authenticated | — | `public.is_admin()` | `public.is_admin()` |
| `media_assets` | `Admins can update media_assets` | UPDATE | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `media_assets` | `Admins can delete media_assets` | DELETE | authenticated | `public.is_admin()` | — | `public.is_admin()` |
| `game_categories` | `Public or Admin select game_categories` | SELECT | anon, authenticated | `public.is_admin() OR EXISTS (SELECT 1 FROM public.games g WHERE g.category_id = public.game_categories.id AND g.is_published = TRUE)` | — | `public.is_admin()` |
| `game_categories` | `Admins can insert/update/delete` | INSERT/UPDATE/DELETE | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `games` | `Public or Admin select games` | SELECT | anon, authenticated | `public.is_admin() OR is_published = TRUE` | — | `public.is_admin()` |
| `games` | `Admins can insert/update/delete` | INSERT/UPDATE/DELETE | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `game_levels` | `Public or Admin select game_levels` | SELECT | anon, authenticated | `public.is_admin() OR EXISTS (SELECT 1 FROM public.games g WHERE g.id = public.game_levels.game_id AND g.is_published = TRUE)` | — | `public.is_admin()` |
| `questions` | `Public or Admin select questions` | SELECT | anon, authenticated | `public.is_admin() OR (is_draft = FALSE AND EXISTS (SELECT 1 FROM public.games g WHERE g.id = public.questions.game_id AND g.is_published = TRUE))` | — | `public.is_admin()` |
| `question_options` | `Admins select question_options` | SELECT | authenticated | `public.is_admin()` | — | **REVOKED FROM ANON.** |
| `question_options` | `Admins can insert/update/delete` | INSERT/UPDATE/DELETE | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `activity_media` | `Admins select activity_media` | SELECT | authenticated | `public.is_admin()` | — | `public.is_admin()` |
| `activity_media` | `Admins can insert/update/delete` | INSERT/UPDATE/DELETE | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `game_versions` | `Public or Admin select game_versions` | SELECT | anon, authenticated | `public.is_admin() OR is_active = TRUE` | — | `public.is_admin()` |
| `game_versions` | `Admins can insert/update/delete` | INSERT/UPDATE/DELETE | authenticated | `public.is_admin()` | `public.is_admin()` | `public.is_admin()` |
| `homescreen_explorer` | `Public or Admin select homescreen_explorer` | SELECT | anon, authenticated | `public.is_admin() OR is_active = TRUE` | — | `public.is_admin()` |
| `homescreen_explorer_subcategories` | `Public or Admin select homescreen_explorer_subcategories` | SELECT | anon, authenticated | `public.is_admin() OR (is_active = TRUE AND EXISTS (SELECT 1 FROM public.homescreen_explorer he WHERE he.id = public.homescreen_explorer_subcategories.explorer_id AND he.is_active = TRUE))` | — | `public.is_admin()` |
| `subcategory_games` | `Public or Admin select subcategory_games` | SELECT | anon, authenticated | `public.is_admin() OR (is_active = TRUE AND EXISTS (SELECT 1 FROM public.homescreen_explorer_subcategories sub JOIN public.homescreen_explorer he ON he.id = sub.explorer_id WHERE sub.id = public.subcategory_games.subcategory_id AND sub.is_active = TRUE AND he.is_active = TRUE))` | — | `public.is_admin()` |
| `game_releases` | `Admin select game_releases` | SELECT | authenticated | `public.is_admin()` | — | **REVOKED FROM ANON.** |

---

## 4. Storage & Call Site Verification

### Storage Configuration (`[VERIFIED]`)
- **Bucket Name:** `game-assets`
- **Bucket Visibility:** Private (`public = false` in `storage.buckets`).
- **Storage Policies (`storage.objects`):**
  - `Public or Admin Storage Select` allows SELECT on `storage.objects` if `bucket_id = 'game-assets'` AND (`public.is_admin()` OR `public.is_published_media_asset(storage.objects.name)`).
  - Insert, Update, Delete restricted to `public.is_admin()`.

### Source Code Call Sites (`src/`) (`[VERIFIED]`)

1. **`getMediaSignedUrl`**:
   - `src/lib/supabase.ts:103`: Function definition (`export async function getMediaSignedUrl(...)`).
   - `src/lib/supabase.ts:182`: Internal invocation during upload to populate initial preview URL (`const signedUrl = await getMediaSignedUrl(uniquePath, 3600, bucketName);`).
   - `src/components/Media/MediaPreviewTile.tsx:3`: Import statement (`import { getMediaSignedUrl, isSupabaseConfigured } from '../../lib/supabase';`).
   - `src/components/Media/MediaPreviewTile.tsx:32`: Component invocation (`getMediaSignedUrl(asset.file_path, 3600, asset.bucket_name)`).
2. **`uploadMediaAsset`**:
   - `src/lib/supabase.ts:133`: Function definition (`export async function uploadMediaAsset(...)`).
   - `src/pages/UploadFilesPage.tsx:15`: Import statement.
   - `src/pages/UploadFilesPage.tsx:159`: Component invocation (`await uploadMediaAsset(item.file, user.id);`).
3. **`deleteMediaAsset`**:
   - `src/lib/supabase.ts:193`: Function definition (`export async function deleteMediaAsset(...)`).
   - `src/pages/UploadFilesPage.tsx:15`: Import statement.
   - `src/pages/UploadFilesPage.tsx:190`: Component invocation (`await deleteMediaAsset(deleteConfirmAsset.id, deleteConfirmAsset.file_path, deleteConfirmAsset.bucket_name);`).
4. **`getMediaPublicUrl`**:
   - `src/lib/supabase.ts:94`: Function definition (`export function getMediaPublicUrl(...)`).
   - **Call site count in UI components:** **0 call sites in UI components**.

### `MediaPreviewTile` Component Resolution (`[VERIFIED]`)
- **Resolution:** Implemented as a React/TypeScript component at **`src/components/Media/MediaPreviewTile.tsx`**.
- **Signed URL Usage:** All media thumbnail previews in Admin Studio call `getMediaSignedUrl(asset.file_path, 3600, asset.bucket_name)`. Un-authenticated public URLs are **not** used to render private bucket assets.

---

## 5. Authentication Verification & Exact Source Lines

1. **Automatic Token Refresh & Session Storage:** Configured by `@supabase/supabase-js` client defaults (`auth.autoRefreshToken: true`, `auth.persistSession: true` in `localStorage`). **[SOURCE-BASED OBSERVATION]**
2. **Initial Session Lookup (`src/context/AuthContext.tsx:31–55`):**
   ```typescript
   supabase.auth
     .getSession()
     .then(async ({ data: { session } }) => {
       if (!isMounted) return;
       setSession(session);
       setUser(session?.user ?? null);
       if (session?.user) {
         const adminStatus = await checkIsAdminUser(session.user);
         if (isMounted) setIsAdmin(adminStatus);
       } else {
         if (isMounted) setIsAdmin(false);
       }
     })
     .catch((err) => {
       console.warn('Supabase session lookup error:', err);
       if (isMounted) {
         setSession(null);
         setUser(null);
         setIsAdmin(false);
       }
     })
     .finally(() => {
       if (isMounted) setLoading(false);
     });
   ```
   **Verified Behavior:** Errors in `getSession()` are logged via `console.warn` and fail closed (`setSession(null)`, `setUser(null)`, `setIsAdmin(false)`). **[VERIFIED]**
3. **Auth Change Listener (`src/context/AuthContext.tsx:59–73`):**
   ```typescript
   const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
     if (!isMounted) return;
     setSession(session);
     setUser(session?.user ?? null);
     if (session?.user) {
       const adminStatus = await checkIsAdminUser(session.user);
       if (isMounted) setIsAdmin(adminStatus);
     } else {
       if (isMounted) setIsAdmin(false);
     }
     if (isMounted) setLoading(false);
   });
   ```
   **Verified Behavior:** Re-evaluates `checkIsAdminUser(session.user)` on auth state changes. Unsubscribes on component unmount. **[VERIFIED]**
4. **Admin Sign-In Enforcement (`src/context/AuthContext.tsx:85–97`):**
   ```typescript
   const handleSignIn = async (email: string, password: string) => {
     const data = await signInWithEmailAndPassword(email, password);
     const authUser = data.user;
     if (authUser) {
       const adminStatus = await checkIsAdminUser(authUser);
       if (!adminStatus) {
         await signOutUser();
         setUser(null);
         setSession(null);
         setIsAdmin(false);
         throw new Error('Access denied: Your account is not authorized as a Sproutelle Administrator.');
       }
       setIsAdmin(true);
     }
   };
   ```
   **Verified Behavior:** If `checkIsAdminUser()` returns `false` during sign-in, executes `signOutUser()`, clears state, and throws an explicit authorization error. **[VERIFIED]**
5. **Password Hash Migration Limitations:**
   - **UNVERIFIED.** Migrating existing Supabase password hashes (`auth.users.encrypted_password`) to Better Auth without password resets is **unverified without direct access to database backups**. Supabase isolates `auth.users` in system schemas. If database exports containing `encrypted_password` cannot be obtained, admin users will require an initial password reset upon migration. **[UNVERIFIED]**

---

## 6. Complete Functions & RPCs Inventory

| Function Name | Signature & Return Type | Security Mode & `search_path` | Validation & Authorization Checks | Locking & Atomicity | Grants | Migration Source | Status |
|---|---|---|---|---|---|---|---|
| `public.is_admin()` | `() RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Checks `WHERE id = (SELECT auth.uid()) AND is_admin = TRUE` in `admin_users`. | None | `REVOKE ALL FROM PUBLIC, anon;`<br>`GRANT EXECUTE TO authenticated, service_role;` | `20260330000000_initial_schema.sql:47` | **[VERIFIED]** |
| `public.validate_game_level_update()` | `() RETURNS TRIGGER` | `SECURITY DEFINER`<br>`SET search_path = ''` | Prevents modifying `game_id` if questions are attached to the level. | Locks questions `FOR UPDATE`. | Executed by system trigger `trg_validate_game_level_update`. | `20260330000000_initial_schema.sql:136` | **[VERIFIED]** |
| `public.validate_question_level_game()` | `() RETURNS TRIGGER` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `NEW.level_id` belongs to `NEW.game_id`. | Locks level `FOR KEY SHARE`. | Executed by system trigger `trg_validate_question_level_game`. | `20260330000000_initial_schema.sql:178` | **[VERIFIED]** |
| `public.is_published_media_asset()` | `(p_file_path TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''`<br>`STABLE` | Checks if `file_path` belongs to published questions, options, categories, active explorers, or subcategories. | None | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO anon, authenticated, service_role;` | `20260330000000...:300`<br>`20260330000200...:36` | **[VERIFIED]** |
| `public.publish_game_release()` | `(p_game_id UUID, p_version_number TEXT, p_pack_data JSONB) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin()` and checks $\ge 1$ published question exists (`q.is_draft = FALSE`). | Locks `games` row `FOR UPDATE`. Atomic transaction. Idempotent retry. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO authenticated, service_role;` | `20260330000800_final_harden_publish.sql:84` | **[VERIFIED]** |
| `public.get_published_content_pack()` | `(p_game_id UUID) RETURNS JSONB` | `SECURITY DEFINER`<br>`SET search_path = ''`<br>`STABLE` | Verifies `games.is_published = TRUE`. | None | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO anon, authenticated, service_role;` | `20260330000800_final_harden_publish.sql:19` | **[VERIFIED]** |
| `public.save_subcategory_games()` | `(p_subcategory_id UUID, p_assignments JSONB) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin()` and subcategory/game existence. | Locks subcategory row `FOR UPDATE`. Atomic transaction. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO authenticated, service_role;` | `20260330001000_atomic_subcategory_games.sql:12` | **[VERIFIED]** |
| `public.save_subcategory_with_games()` | `(p_subcategory_id UUID, p_explorer_id UUID, p_name TEXT, p_image_asset_id UUID, p_background_color TEXT, p_category_id UUID, p_sort_order INT, p_is_active BOOLEAN, p_assignments JSONB) RETURNS UUID` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin()`, name non-empty, explorer existence, game existence, and engine pattern allowlist. | Locks subcategory row `FOR UPDATE`. Atomic transaction. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO authenticated, service_role;` | `20260330001100_atomic_create_sub_with_games.sql:12` | **[VERIFIED]** |

### Precise Answer Key Removal Implementation (`get_published_content_pack`)
- **Verified SQL Implementation (`20260330000800_final_harden_publish.sql:51–77`):**
  ```sql
  SELECT jsonb_set(
      v_pack,
      '{questions}',
      COALESCE(
          (
              SELECT jsonb_agg(
                  jsonb_set(
                      q.value,
                      '{options}',
                      COALESCE(
                          (
                              SELECT jsonb_agg(opt.value - 'is_correct')
                              FROM jsonb_array_elements(q.value->'options') AS opt(value)
                          ),
                          '[]'::jsonb
                      )
                  )
              )
              FROM jsonb_array_elements(v_pack->'questions') AS q(value)
          ),
          '[]'::jsonb
      )
  ) INTO v_sanitized;
  ```
- **Precise Scope Limitation:** The function explicitly targets the fixed 2-level array structure: `v_pack->'questions'` array $\rightarrow$ `q.value->'options'` array $\rightarrow$ `opt.value - 'is_correct'`. It removes `'is_correct'` from option objects inside the `options` array of each question. **Arbitrary nested JSON objects or arrays outside this fixed structure are NOT recursively traversed.**

---

## 7. Migration Risk Register

| Risk Item | Evidence in Codebase / Migrations | Potential Impact | Required Migration Decision | Blocks Neon Start? | Evidence Status |
|---|---|---|---|---|---|
| **Supabase Auth User Foreign Keys** | `admin_users.id` & `media_assets.created_by` reference `auth.users(id)` (`20260330000000_initial_schema.sql:37,71`). | FK constraints fail in Neon without `auth.users` table. | Point FK references to Better Auth `user(id)` (`TEXT` or `UUID`). | No | **[VERIFIED]** |
| **Supabase Password Hashes Isolation** | `auth.users` isolated in Supabase system schema. | Admins must reset passwords if hashes cannot be exported. | Export `auth.users.encrypted_password` from Supabase DB backup or mandate 1-time admin password reset. | No | **[UNVERIFIED]** |
| **Storage Object Path Invalidation** | `media_assets.file_path` contains Supabase paths (`YYYY/MM/uuid-file.png`). | Media preview URLs break if assets are not synced. | Replicate exact key paths in Cloudflare R2 bucket (`sproutelle-game-assets`). | No | **[VERIFIED]** |
| **Cloudflare R2 Delivery Verification** | `media_assets.file_path` is verified, but R2 object migration & worker delivery require Phase 3 execution. | R2 delivery cannot be confirmed until Phase 3 Worker is deployed. | Deploy R2 bucket & pre-signed URL Worker endpoint in Phase 3. | No | **[UNVERIFIED]** |
| **PostgreSQL `auth.uid()` Dependency** | `public.is_admin()` uses `auth.uid()` (`20260330000000_initial_schema.sql:47`). | SQL functions fail in Neon without Supabase Auth session headers. | Replace `auth.uid()` with Better Auth session variable or Worker middleware authentication context. | No | **[VERIFIED]** |
| **Public Answer-Key Protection** | `get_published_content_pack()` strips `is_correct` key (`20260330000800_final_harden_publish.sql:63`). | Answer keys leaked to public clients if API endpoints do not sanitize options. | Replicate JSONB key stripping in Cloudflare Worker public content endpoint. | No | **[VERIFIED]** |
| **Publishing Single Active Release Guarantee** | Enforced by partial index `idx_game_releases_single_active` (`20260330000700_harden_publish_constraints.sql:14`). | Multiple active releases could exist concurrently. | Re-create partial unique index in Neon PostgreSQL. | No | **[VERIFIED]** |
| **Legacy `games.subcategory_id` Column** | Added in `20260330000300_add_game_subcategory.sql`. | Obsolete column causes developer confusion. | Deprecate `games.subcategory_id`; use `subcategory_games` junction table exclusively. | No | **[VERIFIED]** |
| **`subcategory_games` Junction Table** | `20260330000900_add_subcategory_games.sql` (`UNIQUE (subcategory_id, game_id)`). | Game assignments lost if junction table is omitted. | Include `subcategory_games` table in Neon schema. | No | **[VERIFIED]** |
| **Android REST API Compatibility** | Android `LearningRemoteDataSource.kt` calls direct Supabase REST endpoints. | Mobile app breaks if API endpoints or JSON structures change. | Cloudflare Worker API must mirror Supabase REST `/questions`, `/question_options`, `/media_assets`, and `get_published_content_pack` RPC. | No | **[UNVERIFIED]** |

---

## 8. Summary of Completed Audit Gaps & Remaining Limitations

### Completed Gaps
1. **Schema & Permissions Completeness:** Every column, data type, nullability, default, PK, FK (with exact ON DELETE/ON UPDATE), constraint, index, trigger, function, RPC, view, table grant, and RLS policy for all 13 tables has been fully cataloged with line references.
2. **Precise Answer Key Removal Scope:** Documented that `get_published_content_pack()` strips `is_correct` specifically from option objects in question `options` arrays, and does not recursively traverse arbitrary JSON structures.
3. **Auth Error Path Verification:** Quoted exact line numbers for `getSession()`, `onAuthStateChange()`, and `handleSignIn()` fail-closed behaviors.
4. **Explicit Evidence Labelling:** All findings strictly labeled **[VERIFIED]**, **[SOURCE-BASED OBSERVATION]**, **[UNVERIFIED]**, or **[DECISION REQUIRED]**.

### Remaining Limitations (Unverified Items)
1. **Supabase Password Hashes:** Direct access to `auth.users.encrypted_password` in managed Supabase system schemas is **[UNVERIFIED]** without database backup exports.
2. **Cloudflare R2 Object Migration & Delivery:** Object migration from Supabase Storage `game-assets` to R2 bucket and URL delivery via Worker are **[UNVERIFIED]** until Phase 3 execution.
3. **Android API Compatibility:** Android client behavior is **[UNVERIFIED]** pending a separate audit of the `sproutelle-android` repository.
4. **Strict Compliance:** Audit report updated at `SUPABASE_MIGRATION_AUDIT.md`. No application source code modified, no database changes executed, no remote Supabase writes performed, no package dependencies added, no commits or pushes executed.
