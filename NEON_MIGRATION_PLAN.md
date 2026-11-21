# Sproutelle Migration — Neon Development Schema & Security Architecture Plan (Phase 2K.25 Correctness & Completeness Audit)

**Target Infrastructure:**
- **Database Engine:** Neon PostgreSQL (`development` branch for dev/staging, `production` branch for prod)
- **Media Storage:** Cloudflare R2 (`sproutelle-game-assets`)
- **Backend API & Publishing Engine:** Cloudflare Workers (Hono REST API / TS Worker)
- **Authentication & Identity:** Better Auth
- **Frontend App:** Sproutelle Admin Portal React SPA (`sproutelle-admin`)

---

## 1. DDL Dependency Ordering & Schema Topology

To guarantee error-free execution in PostgreSQL, DDL statements follow strict dependency ordering across separate migration scripts:

1. **Bootstrap Procedure (`01_neon_bootstrap.sql`):** Executed by initial Neon connection role `neondb_owner` to create roles and transfer `public` schema ownership to `sproutelle_db_owner`.
2. **Independent Content Schema Migration (`02_neon_schema_migration.sql`):** Executed by `sproutelle_db_owner`. Contains **zero dependencies on Better Auth tables**. Creates:
   - Sproutelle Content Tables & Idempotency Table: `admin_users`, `media_assets`, `game_categories`, `homescreen_explorer`, `homescreen_explorer_subcategories`, `games`, `subcategory_games`, `game_levels`, `questions`, `question_options`, `activity_media`, `game_versions`, `game_releases`, `idempotency_keys`.
   - Unique & Partial Indexes: `idx_game_releases_game_version`, `idx_game_releases_single_active`, `idx_idempotency_keys_expiry`.
   - Helper Functions & Triggers: `is_admin`, `validate_game_level_update`, `validate_question_level_game`, **`is_published_media_asset`** *(Must be created BEFORE dependent views!)*.
   - Sanitized Public Views: `public_published_games`, `public_published_categories`, `public_active_explorers`, `public_active_subcategories`, `public_active_subcategory_games`, `public_published_game_levels`, **`public_published_media_assets`**, `published_question_options`.
   - Publishing & Management RPC Functions: `get_published_content_pack`, `publish_game_release`, `toggle_question_draft_status`, `save_subcategory_games`, `save_subcategory_with_games`, `create_game_question`, `update_game_question`.
   - Column-Level Grants, Revokes & Default Privileges for `sproutelle_public_role` and `sproutelle_admin_role`.
3. **Provisional Better Auth DDL (`03_provisional_better_auth.sql`):** Kept separate and marked **[PROVISIONAL]** pending Phase 4 adapter selection. Contains Better Auth tables (`user`, `session`, `account`, `verification`) and `sproutelle_auth_role` grants.
4. **Post-Reconciliation Identity Foreign Keys (`04_post_reconciliation_identity_fks.sql`):** Executed in Phase 4 after Better Auth user import, account import, and identity reconciliation. Adds deferred FK constraints (`admin_users.id` $\rightarrow$ `user(id)`, `media_assets.created_by` $\rightarrow$ `user(id)`).

---

## 2. Separate Migration Bootstrap & Ownership Process (`[PROPOSED NEON SECURITY DESIGN]`)

### A. Bootstrap Procedure (`01_neon_bootstrap.sql`)
Executed once by initial administrative connection role (`neondb_owner`) via Neon Console SQL Editor during branch setup. Role passwords must be provisioned out-of-band via Neon Console UI / Neon CLI / Environment Secrets Manager:

```sql
-- Sproutelle Neon Bootstrap Script (01_neon_bootstrap.sql)
-- Executed by initial administrative connection role (neondb_owner)

BEGIN;

-- 1. Create Database Owner & Runtime Connection Roles
-- Note: Passwords must be provisioned out-of-band via Neon Console / Environment Secrets Manager.
CREATE ROLE sproutelle_db_owner WITH LOGIN;
CREATE ROLE sproutelle_public_role WITH LOGIN;
CREATE ROLE sproutelle_admin_role WITH LOGIN;
CREATE ROLE sproutelle_auth_role WITH LOGIN;

-- 2. Transfer public schema ownership to sproutelle_db_owner
ALTER SCHEMA public OWNER TO sproutelle_db_owner;
GRANT ALL ON SCHEMA public TO sproutelle_db_owner;

COMMIT;
```

---

### B. Identity Foreign-Key Strategy (Deferred to Phase 4)

- In `02_neon_schema_migration.sql`, columns `admin_users.id` and `media_assets.created_by` are defined as `TEXT PRIMARY KEY` and `TEXT` respectively **without foreign key references to `public.user(id)`**.
- Identity foreign keys are moved out of `03_provisional_better_auth.sql` into a dedicated script **`04_post_reconciliation_identity_fks.sql`**, executed ONLY AFTER Better Auth schema deployment, user import, account import, and stable identity reconciliation:
  ```sql
  -- Post-Reconciliation Identity Foreign Keys Script (04_post_reconciliation_identity_fks.sql)
  -- Executed by Database Owner Role: sproutelle_db_owner

  BEGIN;

  ALTER TABLE public.admin_users
      ADD CONSTRAINT fk_admin_users_user FOREIGN KEY (id) REFERENCES public.user(id) ON DELETE CASCADE;

  ALTER TABLE public.media_assets
      ADD CONSTRAINT fk_media_assets_created_by FOREIGN KEY (created_by) REFERENCES public.user(id) ON DELETE SET NULL;

  COMMIT;
  ```

---

## 3. Public Catalog Visibility Rules & Content Hierarchy

To accurately represent content visibility, 5 conditions determine full playable game visibility on an Explorer card:

1. **`games.is_published = TRUE`**: Game definition is published.
2. **`subcategory_games.is_active = TRUE`**: Game assignment to the subcategory is active.
3. **`homescreen_explorer_subcategories.is_active = TRUE`**: Subcategory card is active.
4. **`homescreen_explorer.is_active = TRUE`**: Parent explorer card is active.
5. **`game_releases.is_active = TRUE`**: Game has an active release snapshot in `game_releases` (Required by `get_published_content_pack()` for playable questions).

```
┌─────────────────────────────────────────────────────────────┐
│  1. Parent Explorer (homescreen_explorer.is_active = TRUE)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Subcategory (subcategories.is_active = TRUE)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Assignment (subcategory_games.is_active = TRUE)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Game (games.is_published = TRUE)                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Active Release (game_releases.is_active = TRUE)         │
└──────────────────────────────┬──────────────────────────────┘
```

- Enforced at database layer by view `public_active_subcategory_games` (`[SQL PRESENT IN PROPOSED DDL]`).
- *Note: Android REST API requirements calling direct endpoints are marked **[UNVERIFIED]** pending a separate audit of the `sproutelle-android` repository.*

---

## 4. Operation Permission Mechanisms & RPC Validation Architecture (`[VERIFIED AGAINST SUPABASE SQL]`)

### A. Permission Mechanism & Protected Column Matrix

| Target Table / Operation | Enforcement Mechanism | Security & Protected Column Guarantees |
|---|---|---|
| **`games.is_published` Column** | Restricted RPC `publish_game_release()` & Column-Level Grants | `is_published` is **EXCLUDED from direct INSERT and UPDATE grants for `sproutelle_admin_role`**. Column defaults to `FALSE` on INSERT. `games.is_published` can ONLY be set to `TRUE` by `publish_game_release()` RPC running as `SECURITY DEFINER` owned by `sproutelle_db_owner`. |
| **`questions.is_draft` & `game_id` Columns** | Restricted RPCs `create_game_question()`, `update_game_question()`, `toggle_question_draft_status()` & Column-Level Grants | `is_draft` and `game_id` are **EXCLUDED from direct INSERT and UPDATE grants for `sproutelle_admin_role`**. New questions receive default draft state (`TRUE`) on INSERT. Changing `questions.is_draft` MUST execute `toggle_question_draft_status()` RPC. *(Note: `publish_game_release()` verifies published question existence, but does NOT modify `questions.is_draft`).* |
| **Question Options (`question_options`)** | Restricted RPCs `create_game_question()` & `update_game_question()` | Direct `INSERT, UPDATE, DELETE` on `question_options` is **STRICTLY REVOKED from `sproutelle_admin_role`** to prevent bypass of correct-answer rules and sort-order duplicate validation. Option creation/replacement MUST execute through controlled RPCs. |
| **Game Release Snapshots** | Restricted RPC `publish_game_release()` | Direct `INSERT/UPDATE/DELETE` on `game_releases` is **STRICTLY REVOKED from `sproutelle_admin_role`**. Enforces `is_admin(p_user_id)`, `SELECT ... FOR UPDATE` locking, draft question validation (`is_draft = FALSE`), version idempotency, and partial index `idx_game_releases_single_active`. |
| **Subcategory Assignments** | Restricted RPCs `save_subcategory_with_games()` & `save_subcategory_games()` | Direct `INSERT/UPDATE/DELETE` on `subcategory_games` is **STRICTLY REVOKED from `sproutelle_admin_role`**. Both RPCs enforce subcategory `FOR UPDATE` row locking, explorer ID ownership verification, strict JSON type validation, UUID regex checks, duplicate assignment checks (`v_game_id = ANY(v_seen_game_ids)`), game existence checks, and engine pattern allowlists. |
| **Admin Users Management** | Admin Provisioning Pipeline | Direct `INSERT, UPDATE, DELETE` on `admin_users` is **STRICTLY REVOKED from `sproutelle_admin_role`**. Content admins cannot promote users or alter `is_admin` status. |
| **Sanitized Content Delivery** | Public RPC `get_published_content_pack()` & Sanitized Public Views | Direct SELECT on `question_options`, `game_releases`, `admin_users` is **STRICTLY REVOKED from `sproutelle_public_role`**. Strips `'is_correct'` key from option arrays. |

---

### B. Comprehensive 15 Question-Type Validation Matrix (`[VERIFIED FROM SOURCE]`)

Audit of `src/lib/validation/questionValidator.ts` (lines 15–185), `src/pages/GameQuestionsPage.tsx` (lines 474–500), and `src/types/engine.ts` (lines 10–120) establishes the complete validation behavior:

| Question Engine Type (`question_type`) | Min / Max Options | Correct Answer Rule | Question-Level Media | Option-Level Media | Config JSON Requirements | UI Validation (Client-Side) | Proposed Database RPC Enforcement | Source Reference |
|---|---|---|---|---|---|---|---|---|
| `multiple_choice` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional image/audio | Optional | `config` defaults to `{}` | Prompt text & $\ge 2$ options required | Enforces $\ge 1$ correct option in RPC | [questionValidator.ts:L70-120](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L70-L120) |
| `image_selection` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional image/audio | **Mandatory** image asset per option | `config` defaults to `{}` | Option text optional if image asset attached | Verifies $\ge 1$ correct option; validates media UUIDs | [questionValidator.ts:L146-155](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L146-L155) |
| `find_correct_picture` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional image/audio | **Mandatory** image asset per option | `config` defaults to `{}` | Image asset mandatory for all option items | Verifies $\ge 1$ correct option; validates media UUIDs | [GameQuestionsPage.tsx:L488-493](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L488-L493) |
| `find_different_picture` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional image/audio | **Mandatory** image asset per option | `config` defaults to `{}` | Image asset mandatory for all option items | Verifies $\ge 1$ correct option; validates media UUIDs | [GameQuestionsPage.tsx:L488-493](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L488-L493) |
| `identify_object` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | **Mandatory** main `image_asset_id` | Optional | `config` defaults to `{}` | Main illustration asset required | Verifies `p_image_asset_id IS NOT NULL` & $\ge 1$ correct option | [GameQuestionsPage.tsx:L495-498](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L495-L498) |
| `match_picture_word` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | **Mandatory** main `image_asset_id` | Optional | `config` defaults to `{}` | Main illustration asset required | Verifies `p_image_asset_id IS NOT NULL` & $\ge 1$ correct option | [GameQuestionsPage.tsx:L495-498](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L495-L498) |
| `audio_recognition` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | **Mandatory** main `audio_asset_id` `[UNVERIFIED in UI]` | Optional | `config` defaults to `{}` | Audio asset attached to prompt | Verifies $\ge 1$ correct option | [questionValidator.ts:L166-180](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L166-L180) |
| `true_false` | **Exactly 2** (`True`, `False`) | **Exactly 1** option with `is_correct = true` | Optional | Optional | `config` defaults to `{}` | Must have exactly 2 options & 1 correct | Enforces options count = 2 & exactly 1 correct | [questionValidator.ts:L132-144](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L132-L144) |
| `quiz` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional | Optional | `config` defaults to `{}` | Option text required & unique | Verifies $\ge 1$ correct option in RPC | [questionValidator.ts:L120-130](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L120-L130) |
| `spelling` | $\ge 1$ allowed (excl. from $\ge 2$ rule) | $\ge 1$ option with `is_correct = true` | Optional | Optional | `[UNVERIFIED runtime requirements]` | Target word solution stored in option text | Accepts $\ge 1$ correct option | [questionValidator.ts:L139-164](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L139-L164) |
| `missing_letters` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` (L139) | Optional | Optional | `[UNVERIFIED config structure]` | Validates target word text | Verifies $\ge 1$ correct option in RPC | [questionValidator.ts:L157-164](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L157-L164) |
| `matching` | $\ge 2$ (Odd count warns) | No `is_correct` flag required | Optional | Optional | `[UNVERIFIED runtime requirements]` | Options represent matching pairs | Odd count is a **WARNING**, NOT blocking | [questionValidator.ts:L166-173](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L166-L173) |
| `memory_pairs` | $\ge 2$ (Odd count warns) | No `is_correct` flag required | Optional | Optional | `[UNVERIFIED runtime requirements]` | Option text can duplicate for pair matching | Odd count is a **WARNING**, NOT blocking | [questionValidator.ts:L166-173](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L166-L173) |
| `category_identification` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional | Optional | `[UNVERIFIED]` | Options mapped to category tags (Semantics `[UNVERIFIED]`) | Verifies $\ge 1$ correct option in RPC | [questionValidator.ts:L15-30](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L15-L30) |
| `sequencing` | $\ge 2$ / Uncapped | $\ge 1$ option with `is_correct = true` | Optional | Optional | `[UNVERIFIED]` | Sort order represents step sequence | Validates unique option sort_order values | [questionValidator.ts:L15-30](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/validation/questionValidator.ts#L15-L30) |

### C. Function Inventory & Grants

| Function Name | Signature & Return Type | Security Mode & `search_path` | Validation & Authorization Checks | Transaction / Locking | Grants & PUBLIC Revokes | Source File Reference |
|---|---|---|---|---|---|---|
| `public.is_admin(p_user_id TEXT)` | `(p_user_id TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Checks `WHERE id = p_user_id AND is_admin = TRUE` in `admin_users`. | None | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | `20260330000000_initial_schema.sql:47` |
| `public.validate_game_level_update()` | `() RETURNS TRIGGER` | `SECURITY DEFINER`<br>`SET search_path = ''` | Prevents modifying `game_id` if questions are attached to level. | Locks questions `FOR UPDATE`. | `REVOKE ALL FROM PUBLIC;`<br>*(Executed by system trigger `trg_validate_game_level_update`)* | `20260330000000_initial_schema.sql:136` |
| `public.validate_question_level_game()` | `() RETURNS TRIGGER` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `NEW.level_id` belongs to `NEW.game_id`. | Locks level `FOR KEY SHARE`. | `REVOKE ALL FROM PUBLIC;`<br>*(Executed by system trigger `trg_validate_question_level_game`)* | `20260330000000_initial_schema.sql:178` |
| `public.is_published_media_asset()` | `(p_file_path TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''`<br>`STABLE` | Checks if file path in `sproutelle-game-assets` belongs to published content. | None | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_public_role, sproutelle_admin_role;` | `20260330000000...:300`<br>`20260330000200...:36` |
| `public.publish_game_release()` | `(p_game_id UUID, p_version_number TEXT, p_pack_data JSONB, p_user_id TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin(p_user_id)` and checks $\ge 1$ published question exists. | Locks `games` row `FOR UPDATE`. Atomic transaction. Idempotent retry. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | `20260330000800_final_harden_publish.sql:84` |
| `public.toggle_question_draft_status()` | `(p_question_id UUID, p_game_id UUID, p_is_draft BOOLEAN, p_user_id TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin(p_user_id)`, locks game `FOR UPDATE` first, locks question `FOR UPDATE` second, verifies question belongs to game, blocks toggling draft status if parent game is published (`is_published = TRUE`). | Locks game `FOR UPDATE`, locks question `FOR UPDATE`. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | New RPC |
| `public.create_game_question()` | `(p_game_id UUID, p_subcategory_id UUID, p_level_id UUID, p_question_text TEXT, p_question_type TEXT, p_instructions TEXT, p_sort_order INT, p_config JSONB, p_image_asset_id UUID, p_audio_asset_id UUID, p_options JSONB, p_idempotency_key VARCHAR(100), p_user_id TEXT) RETURNS UUID` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `is_admin(p_user_id)`, validates idempotency key, validates engine type & inputs, locks explorer, subcategory, game, level. Always sets `is_draft = TRUE`. Atomic option insert. | Locks explorer, subcategory, game, level, idempotency row. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | Proposed RPC |
| `public.update_game_question()` | `(p_question_id UUID, p_game_id UUID, p_subcategory_id UUID, p_level_id UUID, p_question_text TEXT, p_question_type TEXT, p_instructions TEXT, p_sort_order INT, p_config JSONB, p_image_asset_id UUID, p_audio_asset_id UUID, p_options JSONB, p_idempotency_key VARCHAR(100), p_user_id TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `is_admin(p_user_id)`, validates idempotency key, locks explorer, subcategory, game, question. Blocks edits if game is published. Replaces options atomically. | Locks explorer, subcategory, game, level, question, idempotency row. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | Proposed RPC |
| `public.get_published_content_pack()` | `(p_game_id UUID) RETURNS JSONB` | `SECURITY DEFINER`<br>`SET search_path = ''`<br>`STABLE` | Verifies `games.is_published = TRUE`. | None | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_public_role, sproutelle_admin_role;` | `20260330000800_final_harden_publish.sql:19` |
| `public.save_subcategory_games()` | `(p_subcategory_id UUID, p_assignments JSONB, p_user_id TEXT) RETURNS BOOLEAN` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin(p_user_id)` and subcategory existence under `FOR UPDATE` lock. Stage A validates game_type; Stage B validates patterns against engine allowlist. | Locks subcategory row `FOR UPDATE`. Atomic replacement. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | `20260330001000_atomic_subcategory_games.sql:12` |
| `public.save_subcategory_with_games()` | `(p_subcategory_id UUID, p_explorer_id UUID, p_name TEXT, p_image_asset_id UUID, p_background_color TEXT, p_category_id UUID, p_sort_order INT, p_is_active BOOLEAN, p_assignments JSONB, p_user_id TEXT) RETURNS UUID` | `SECURITY DEFINER`<br>`SET search_path = ''` | Verifies `public.is_admin(p_user_id)`, name non-empty, explorer ownership under `FOR UPDATE` lock. Stage A validates game_type; Stage B validates patterns against engine allowlist. | Locks explorer & subcategory rows `FOR UPDATE`. Atomic replacement. | `REVOKE ALL FROM PUBLIC;`<br>`GRANT EXECUTE TO sproutelle_admin_role;` | `20260330001100_atomic_create_sub_with_games.sql:12` |

- **User Parameter Trust:** Parameter `p_user_id` is passed by Cloudflare Worker API middleware after deriving `session.user.id` from a cryptographically verified Better Auth session token. PostgreSQL does not independently authenticate `p_user_id`; it trusts the secure Worker connection (`sproutelle_admin_role`).


### D. Secure Question Creation & Editing Architecture (`[PROPOSED — NOT IMPLEMENTED OR TESTED]`)

#### 1. Source Code Question Workflow Callsite Inventory
Audit of `sproutelle-admin` React SPA source files identifies 5 distinct question callsites across 2 pages:

1. **New Question Creation (Standalone Page):** `[VERIFIED CURRENT SOURCE]` [AddQuestionPage.tsx:L180-210](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/AddQuestionPage.tsx#L180-L210) — Direct `supabase.from('questions').insert(newQuestionPayload)` specifying `game_id`.
2. **New Question Creation (Modal Single Save):** `[VERIFIED CURRENT SOURCE]` [GameQuestionsPage.tsx:L560-575](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L560-L575) — Direct `supabase.from('questions').insert(questionPayload)` specifying `game_id`.
3. **Save and Add Another Question:** `[VERIFIED CURRENT SOURCE]` [GameQuestionsPage.tsx:L645-665](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L645-L665) — Direct `supabase.from('questions').insert(questionPayload)` specifying `game_id`.
4. **Question Duplication / Cloning:** `[VERIFIED CURRENT SOURCE]` [GameQuestionsPage.tsx:L405-430](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L405-L430) — Client-side read followed by direct `supabase.from('questions').insert(clonedPayload)` specifying `game_id`.
5. **Question Editing (Updates):** `[VERIFIED CURRENT SOURCE]` [GameQuestionsPage.tsx:L540-560](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/GameQuestionsPage.tsx#L540-L560) — Direct `supabase.from('questions').update(questionPayload).eq('id', qId)`.

Because direct `INSERT` on `questions.game_id` and direct `UPDATE` on `questions.game_id` / `questions.is_draft` are **STRICTLY REVOKED** for `sproutelle_admin_role`, direct table inserts/updates specifying `game_id` will fail with a PostgreSQL permission error.

---

#### 2. Target API Architecture & Worker Endpoint Contracts (`[PROPOSED FUTURE API INTEGRATION]`)
- **Architecture:** Admin Portal SPA $\rightarrow$ Cloudflare Worker API (Hono REST Endpoints) $\rightarrow$ Better Auth Session Validation Middleware (`checkIsAdminUser`) $\rightarrow$ Neon PostgreSQL (`sproutelle_admin_role`).
- **Authentication Boundary:** Worker middleware authenticates `Authorization: Bearer <token>`, derives `user_id = session.user.id`, and verifies `is_admin(user_id)`. The Worker passes the verified `user_id` as parameter `p_user_id` to PostgreSQL RPCs. It **never** accepts or trusts a client-supplied user ID in request payloads.

##### Canonical Worker REST Endpoints:
- **`POST /api/v1/games/:gameId/questions`** — Creates a new question via `public.create_game_question(...)`. Handles Standalone and Save & Add Another workflows. Accepts `X-Idempotency-Key` header.
- **`PUT /api/v1/games/:gameId/questions/:questionId`** — Edits an existing question via `public.update_game_question(...)`. Accepts `X-Idempotency-Key` header. Option replacement follows full replacement semantics: omitted `options` preserves existing, explicit JSON array atomically replaces.
- **`POST /api/v1/games/:gameId/questions/:questionId/clone`** — Server-side cloning endpoint: reads source question & options server-side and invokes `create_game_question(...)` with `question_text = "${text} (Copy)"`. Generates its own idempotency key.
- **`DELETE /api/v1/games/:gameId/questions/:questionId`** — Deletes an unpublished question via direct DELETE query under `sproutelle_admin_role`.

---

#### 3. Database-Backed Idempotency Design Strategy
To guarantee strict transactional idempotency across retries, timeouts, and network failures:
- **Table Definition:** `public.idempotency_keys` table in PostgreSQL.
- **Scope & PK:** Unique across `(user_id, operation_name, idempotency_key)` to prevent cross-user collisions. `idempotency_key` is client-supplied (`VARCHAR(100)`).
- **Request Hash:** A deterministic SHA-256 hash (`v_req_hash`) computed over all semantically relevant input parameters encoded canonically as a JSONB object, then cast to TEXT and hashed via `encode(digest(payload::text, 'sha256'), 'hex')`. This prevents delimiter injection/ambiguity.
- **Transactional Atomicity:** Key reservation, request execution, and status updates participate in the **SAME database transaction**.
- **Execution Flow in RPCs:**
  1. Calculate `v_req_hash`.
  2. Attempt `INSERT INTO public.idempotency_keys ... VALUES(..., 'in_flight')`.
  3. **Concurrent Processing (Wait/Replay):** In PostgreSQL, if two requests use the same key, the second request blocks at the `INSERT` due to the unique constraint. It waits for the first transaction to complete. It does not observe `in_flight`.
  4. If the first transaction commits, the second transaction raises a `unique_violation`. It catches this, selects the committed record, and compares the `request_hash`.
     - **Identical Hash:** Returns `response_payload` immediately (Idempotent replay).
     - **Different Hash:** Raises `'Idempotency key payload mismatch'`.
  5. If the first transaction rolls back (e.g. Worker timeout), the unique lock is released. The second transaction's `INSERT` succeeds and processes the request.
- **Cache Retention:** Idempotency keys expire automatically (`expires_at = NOW() + INTERVAL '24 hours'`).

---

#### 4. Lock Order & Concurrency Matrix
To prevent deadlocks across concurrent database writer operations, a global lock hierarchy is enforced.

| Operation | Lock Acquisition Order | Lock Mode | Inversion Risk Mitigation | Status |
|---|---|---|---|---|
| `create_game_question` | 1. `homescreen_explorer`<br>2. `homescreen_explorer_subcategories`<br>3. `games`<br>4. `game_levels` | 1. `FOR UPDATE`<br>2. `FOR UPDATE`<br>3. `FOR UPDATE`<br>4. `FOR KEY SHARE` | Top-down hierarchy ensures Explorer $\rightarrow$ Subcategory $\rightarrow$ Game order matching assignment RPCs. | Verified via SQL |
| `update_game_question` | 1. `homescreen_explorer`<br>2. `homescreen_explorer_subcategories`<br>3. `games`<br>4. `game_levels`<br>5. `questions` | 1. `FOR UPDATE`<br>2. `FOR UPDATE`<br>3. `FOR UPDATE`<br>4. `FOR KEY SHARE`<br>5. `FOR UPDATE` | Locks up to Explorer level to prevent inversion with assignments. | Verified via SQL |
| `toggle_question_draft_status` | 1. `games`<br>2. `questions` | 1. `FOR UPDATE`<br>2. `FOR UPDATE` | Locks Game BEFORE Question. | Verified via SQL |
| `publish_game_release` | 1. `games`<br>2. `game_releases` | 1. `FOR UPDATE`<br>2. `FOR UPDATE` | Locks Game BEFORE Release. | Verified via SQL |
| `save_subcategory_games` | 1. `homescreen_explorer_subcategories`<br>2. `games` | 1. `FOR UPDATE`<br>2. `FOR KEY SHARE` | Subcategory locked FIRST; checks game existence with `FOR KEY SHARE`. | Verified via SQL |
| `save_subcategory_with_games` | 1. `homescreen_explorer`<br>2. `homescreen_explorer_subcategories`<br>3. `games` | 1. `FOR UPDATE`<br>2. `FOR UPDATE`<br>3. `FOR KEY SHARE` | Hierarchy order (`explorer` $\rightarrow$ `subcategory` $\rightarrow$ `games`) enforced. | Verified via SQL |
| `Question/Game Deletions` | `[UNVERIFIED]` | `[UNVERIFIED]` | Cascade paths and deletion workflows must be reviewed in a future phase. | `[UNVERIFIED]` |

*(Note: Without verifying the deletion workflows, a global lock hierarchy deadlock prevention cannot be fully guaranteed. Marked `[UNVERIFIED]`).*

---

#### 5. Hardened Question Creation & Editing RPC Design Details

- **Creation RPC (`create_game_question`):**
  - Uses `pgcrypto` for SHA-256 idempotency request hash with Canonical JSONB encoding.
  - Follows strict lock order: Explorer $\rightarrow$ Subcategory $\rightarrow$ Game $\rightarrow$ Level.
  - Validates `p_question_type` against the allowlist.
  - Rejects `p_options` if not a JSON array. Never silently skips invalid JSON objects.
  - Applies engine-specific validation rules enforcing `is_correct = true` exactly when required by the Section 4B matrix.
  - Enforces `is_draft = TRUE` unconditionally.
- **Update RPC (`update_game_question`):**
  - Uses `pgcrypto` for SHA-256 idempotency request hash with Canonical JSONB encoding.
  - Follows explicit full-replacement PUT semantics.
  - If `p_options IS NULL`, existing options are explicitly preserved. If `p_options` is a JSON array, existing options are deleted and replaced atomically.
  - Never uses ambiguous `COALESCE` for non-optional text fields (requires explicit explicit `length(trim(...)) > 0` checking).
  - Validates against all creation rules and prevents updates if `games.is_published = TRUE`.

*(Note: Full executable DDL for these proposed RPCs is located in Section 5 below).*

---

#### 6. Options Permission Strategy Recommendation
- **Recommendation B (Controlled RPC Only):** Direct `INSERT, UPDATE, DELETE` on `question_options` for `sproutelle_admin_role` is **STRICTLY REVOKED** in DDL Section 5.
- **Reasoning:** Direct table mutation on `question_options` permits bypassing correct-answer checks (`is_correct = true`), sort-order uniqueness, and option-asset referential integrity, which risks corrupting playable release snapshots. Option creation and replacement MUST execute through `create_game_question` and `update_game_question` RPCs.

---

## 5. Content Schema Migration DDL Script (`02_neon_schema_migration.sql`)

```sql
-- Sproutelle Neon PostgreSQL Schema Migration Script (02_neon_schema_migration.sql)
-- Executed by Database Owner Role: sproutelle_db_owner
-- Target Branch: development
-- Note: Zero dependency on Better Auth tables. Independent execution supported.

BEGIN;

-- Note: gen_random_uuid() is built-in natively in PostgreSQL 13+.
-- Extension uuid-ossp omitted for clean native execution.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- 1. SPROUTELLE CONTENT TABLES & IDEMPOTENCY TABLE
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    bucket_name TEXT NOT NULL DEFAULT 'sproutelle-game-assets',
    file_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_assets OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.game_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_categories OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.homescreen_explorer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_name TEXT NOT NULL,
    title_image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    background_color TEXT NOT NULL DEFAULT '#FFF0F3',
    category_id UUID REFERENCES public.game_categories(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.homescreen_explorer OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.homescreen_explorer_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    explorer_id UUID NOT NULL REFERENCES public.homescreen_explorer(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    background_color TEXT NOT NULL DEFAULT '#FFF0F3',
    category_id UUID REFERENCES public.game_categories(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.homescreen_explorer_subcategories OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.game_categories(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES public.homescreen_explorer_subcategories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    game_type TEXT NOT NULL DEFAULT 'multiple_choice',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_published BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.games OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.subcategory_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subcategory_id UUID NOT NULL REFERENCES public.homescreen_explorer_subcategories(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    enabled_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subcategory_games_unique_assignment UNIQUE (subcategory_id, game_id)
);

ALTER TABLE public.subcategory_games OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.game_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    level_number INT NOT NULL,
    title TEXT,
    description TEXT,
    pass_score INT DEFAULT 100,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT game_levels_id_game_id_key UNIQUE (id, game_id)
);

ALTER TABLE public.game_levels OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES public.homescreen_explorer_subcategories(id) ON DELETE CASCADE,
    level_id UUID REFERENCES public.game_levels(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice',
    instructions TEXT,
    sort_order INT DEFAULT 0,
    is_draft BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    image_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    audio_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_questions_level_game FOREIGN KEY (level_id, game_id)
        REFERENCES public.game_levels(id, game_id) ON UPDATE CASCADE
);

ALTER TABLE public.questions OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.question_options OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.activity_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID REFERENCES public.media_assets(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    usage_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_media OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.game_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number TEXT NOT NULL UNIQUE,
    release_notes TEXT,
    min_app_version TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_versions OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.game_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    version_number TEXT NOT NULL,
    pack_data JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.game_releases OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    user_id TEXT NOT NULL,
    operation_name TEXT NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_flight', 'completed', 'failed')),
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    PRIMARY KEY (user_id, operation_name, idempotency_key)
);

ALTER TABLE public.idempotency_keys OWNER TO sproutelle_db_owner;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_releases_game_version
    ON public.game_releases(game_id, version_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_releases_single_active
    ON public.game_releases(game_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expiry
    ON public.idempotency_keys(expires_at);

--------------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS (CREATED BEFORE DEPENDENT VIEWS)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE id = p_user_id AND is_admin = TRUE
    );
END;
$;

ALTER FUNCTION public.is_admin(TEXT) OWNER TO sproutelle_db_owner;

CREATE OR REPLACE FUNCTION public.validate_game_level_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
BEGIN
    IF OLD.game_id IS DISTINCT FROM NEW.game_id THEN
        IF EXISTS (
            SELECT 1 FROM public.questions
            WHERE level_id = OLD.id
            FOR UPDATE
        ) THEN
            RAISE EXCEPTION 'Cannot change game_id for level %: questions are attached to this level', OLD.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$;

ALTER FUNCTION public.validate_game_level_update() OWNER TO sproutelle_db_owner;

DROP TRIGGER IF EXISTS trg_validate_game_level_update ON public.game_levels;
CREATE TRIGGER trg_validate_game_level_update
    BEFORE UPDATE ON public.game_levels
    FOR EACH ROW EXECUTE FUNCTION public.validate_game_level_update();

CREATE OR REPLACE FUNCTION public.validate_question_level_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_level_game_id UUID;
BEGIN
    IF NEW.level_id IS NOT NULL THEN
        SELECT game_id INTO v_level_game_id
        FROM public.game_levels
        WHERE id = NEW.level_id
        FOR KEY SHARE;

        IF v_level_game_id IS NULL THEN
            RAISE EXCEPTION 'Level % does not exist', NEW.level_id;
        ELSIF v_level_game_id IS DISTINCT FROM NEW.game_id THEN
            RAISE EXCEPTION 'Level % belongs to Game %, but Question specifies Game %', NEW.level_id, v_level_game_id, NEW.game_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$;

ALTER FUNCTION public.validate_question_level_game() OWNER TO sproutelle_db_owner;

DROP TRIGGER IF EXISTS trg_validate_question_level_game ON public.questions;
CREATE TRIGGER trg_validate_question_level_game
    BEFORE INSERT OR UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.validate_question_level_game();

-- Note: is_published_media_asset MUST be created before public_published_media_assets view!
CREATE OR REPLACE FUNCTION public.is_published_media_asset(p_file_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.questions q ON (q.image_asset_id = ma.id OR q.audio_asset_id = ma.id)
        JOIN public.games g ON q.game_id = g.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'sproutelle-game-assets'
          AND q.is_draft = FALSE AND g.is_published = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.question_options qo ON qo.media_asset_id = ma.id
        JOIN public.questions q ON qo.question_id = q.id
        JOIN public.games g ON q.game_id = g.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'sproutelle-game-assets'
          AND q.is_draft = FALSE AND g.is_published = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.game_categories gc ON gc.icon_asset_id = ma.id
        JOIN public.games g ON g.category_id = gc.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'sproutelle-game-assets'
          AND g.is_published = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.homescreen_explorer he ON he.title_image_asset_id = ma.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'sproutelle-game-assets'
          AND he.is_active = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.media_assets ma
        JOIN public.homescreen_explorer_subcategories sub ON sub.image_asset_id = ma.id
        JOIN public.homescreen_explorer he ON sub.explorer_id = he.id
        WHERE ma.file_path = p_file_path
          AND ma.bucket_name = 'sproutelle-game-assets'
          AND sub.is_active = TRUE AND he.is_active = TRUE
    );
END;
$;

ALTER FUNCTION public.is_published_media_asset(TEXT) OWNER TO sproutelle_db_owner;

--------------------------------------------------------------------------------
-- 3. SANITIZED PUBLIC VIEWS & ADMIN HELPER VIEWS
--------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_published_games AS
SELECT id, category_id, subcategory_id, name, slug, description, game_type, config, sort_order, created_at, updated_at
FROM public.games
WHERE is_published = TRUE;

ALTER VIEW public.public_published_games OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.public_published_categories AS
SELECT gc.id, gc.name, slug, description, icon_asset_id, sort_order, created_at, updated_at
FROM public.game_categories gc
WHERE EXISTS (
    SELECT 1 FROM public.games g
    WHERE g.category_id = gc.id AND g.is_published = TRUE
);

ALTER VIEW public.public_published_categories OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.public_active_explorers AS
SELECT id, title_name, title_image_asset_id, background_color, category_id, sort_order, created_at, updated_at
FROM public.homescreen_explorer
WHERE is_active = TRUE;

ALTER VIEW public.public_active_explorers OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.public_active_subcategories AS
SELECT sub.id, sub.explorer_id, sub.name, sub.image_asset_id, sub.background_color, sub.category_id, sub.sort_order, sub.created_at, sub.updated_at
FROM public.homescreen_explorer_subcategories sub
JOIN public.homescreen_explorer he ON sub.explorer_id = he.id
WHERE sub.is_active = TRUE AND he.is_active = TRUE;

ALTER VIEW public.public_active_subcategories OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.public_active_subcategory_games AS
SELECT sg.id, sg.subcategory_id, sg.game_id, sg.enabled_patterns, sg.sort_order, sg.created_at, sg.updated_at
FROM public.subcategory_games sg
JOIN public.homescreen_explorer_subcategories sub ON sub.id = sg.subcategory_id
JOIN public.homescreen_explorer he ON he.id = sub.explorer_id
JOIN public.games g ON g.id = sg.game_id
WHERE sg.is_active = TRUE
  AND sub.is_active = TRUE
  AND he.is_active = TRUE
  AND g.is_published = TRUE
  AND EXISTS (
      SELECT 1 FROM public.game_releases gr
      WHERE gr.game_id = g.id AND gr.is_active = TRUE
  );

ALTER VIEW public.public_active_subcategory_games OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.public_published_game_levels AS
SELECT gl.id, gl.game_id, gl.level_number, gl.title, gl.description, gl.pass_score, gl.sort_order, gl.created_at
FROM public.game_levels gl
JOIN public.games g ON g.id = gl.game_id
WHERE g.is_published = TRUE;

ALTER VIEW public.public_published_game_levels OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.public_published_media_assets AS
SELECT ma.id, ma.name, ma.bucket_name, ma.file_path, ma.mime_type, ma.size_bytes, ma.created_at
FROM public.media_assets ma
WHERE public.is_published_media_asset(ma.file_path);

ALTER VIEW public.public_published_media_assets OWNER TO sproutelle_db_owner;

CREATE OR REPLACE VIEW public.published_question_options AS
SELECT
    qo.id,
    qo.question_id,
    qo.option_text,
    qo.sort_order,
    qo.media_asset_id,
    qo.created_at
FROM public.question_options qo
JOIN public.questions q ON qo.question_id = q.id
JOIN public.games g ON q.game_id = g.id
WHERE q.is_draft = FALSE AND g.is_published = TRUE;

ALTER VIEW public.published_question_options OWNER TO sproutelle_db_owner;

--------------------------------------------------------------------------------
-- 4. PUBLISHING & MANAGEMENT RPCs
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_published_content_pack(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_pack JSONB;
    v_is_published BOOLEAN;
    v_sanitized JSONB;
BEGIN
    SELECT is_published INTO v_is_published
    FROM public.games
    WHERE id = p_game_id;

    IF v_is_published IS NOT TRUE THEN
        RETURN NULL;
    END IF;

    SELECT pack_data INTO v_pack
    FROM public.game_releases
    WHERE game_id = p_game_id AND is_active = TRUE;

    IF v_pack IS NULL THEN
        RETURN NULL;
    END IF;

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

    RETURN v_sanitized;
END;
$;

ALTER FUNCTION public.get_published_content_pack(UUID) OWNER TO sproutelle_db_owner;

CREATE OR REPLACE FUNCTION public.publish_game_release(
    p_game_id UUID,
    p_version_number TEXT,
    p_pack_data JSONB,
    p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_locked_game_id UUID;
    v_has_published_questions BOOLEAN;
    v_existing_pack JSONB;
BEGIN
    IF NOT public.is_admin(p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can publish game releases.';
    END IF;

    SELECT id INTO v_locked_game_id
    FROM public.games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game with ID % does not exist.', p_game_id;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.game_id = p_game_id AND q.is_draft = FALSE
    ) INTO v_has_published_questions;

    IF NOT v_has_published_questions THEN
        RAISE EXCEPTION 'Cannot publish game: game has no published questions.';
    END IF;

    SELECT pack_data INTO v_existing_pack
    FROM public.game_releases
    WHERE game_id = p_game_id
      AND version_number = p_version_number;

    IF FOUND THEN
        IF v_existing_pack = p_pack_data THEN
            UPDATE public.game_releases
            SET is_active = FALSE
            WHERE game_id = p_game_id
              AND is_active = TRUE
              AND version_number <> p_version_number;

            UPDATE public.game_releases
            SET is_active = TRUE
            WHERE game_id = p_game_id
              AND version_number = p_version_number;

            UPDATE public.games
            SET is_published = TRUE, updated_at = NOW()
            WHERE id = p_game_id;

            RETURN TRUE;
        ELSE
            RAISE EXCEPTION 'Version number % already exists for this game with a different content payload.', p_version_number;
        END IF;
    END IF;

    UPDATE public.game_releases
    SET is_active = FALSE
    WHERE game_id = p_game_id
      AND is_active = TRUE;

    INSERT INTO public.game_releases (game_id, version_number, pack_data, is_active)
    VALUES (p_game_id, p_version_number, p_pack_data, TRUE);

    UPDATE public.games
    SET is_published = TRUE, updated_at = NOW()
    WHERE id = p_game_id;

    RETURN TRUE;
END;
$;

ALTER FUNCTION public.publish_game_release(UUID, TEXT, JSONB, TEXT) OWNER TO sproutelle_db_owner;

CREATE OR REPLACE FUNCTION public.toggle_question_draft_status(
    p_question_id UUID,
    p_game_id UUID,
    p_is_draft BOOLEAN,
    p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_locked_game_id UUID;
    v_game_is_published BOOLEAN;
    v_locked_question_id UUID;
    v_question_game_id UUID;
BEGIN
    IF NOT public.is_admin(p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can change question draft status.';
    END IF;

    -- Lock parent game row FIRST to ensure consistent locking order
    SELECT id, is_published INTO v_locked_game_id, v_game_is_published
    FROM public.games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game with ID % does not exist.', p_game_id;
    END IF;

    -- Lock question row SECOND
    SELECT id, game_id INTO v_locked_question_id, v_question_game_id
    FROM public.questions
    WHERE id = p_question_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Question with ID % does not exist.', p_question_id;
    END IF;

    IF v_question_game_id IS DISTINCT FROM p_game_id THEN
        RAISE EXCEPTION 'Question % belongs to Game %, but specified Game %.', p_question_id, v_question_game_id, p_game_id;
    END IF;

    -- Prevent modifying draft status if parent game is already published
    IF v_game_is_published IS TRUE THEN
        RAISE EXCEPTION 'Cannot toggle question draft status: parent Game % is already published. Published content changes MUST publish a new release snapshot via publish_game_release().', p_game_id;
    END IF;

    UPDATE public.questions
    SET is_draft = p_is_draft, updated_at = NOW()
    WHERE id = p_question_id;

    RETURN TRUE;
END;
$;

ALTER FUNCTION public.toggle_question_draft_status(UUID, UUID, BOOLEAN, TEXT) OWNER TO sproutelle_db_owner;

CREATE OR REPLACE FUNCTION public.create_game_question(
    p_game_id UUID,
    p_subcategory_id UUID,
    p_level_id UUID,
    p_question_text TEXT,
    p_question_type TEXT,
    p_instructions TEXT,
    p_sort_order INT,
    p_config JSONB,
    p_image_asset_id UUID,
    p_audio_asset_id UUID,
    p_options JSONB,
    p_idempotency_key VARCHAR(100),
    p_user_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_locked_explorer_id UUID;
    v_locked_sub_id UUID;
    v_locked_game_id UUID;
    v_game_is_published BOOLEAN;
    v_level_game_id UUID;
    v_new_question_id UUID;
    v_req_hash TEXT;
    v_idemp_status TEXT;
    v_stored_payload JSONB;
    v_stored_hash TEXT;
    v_opt JSONB;
    v_opt_text TEXT;
    v_opt_is_correct BOOLEAN;
    v_opt_media_id UUID;
    v_opt_sort INT;
    v_has_correct_option BOOLEAN := FALSE;
    v_idx INT := 0;
BEGIN
    -- 1. Authorization Check via Worker Trust Boundary
    IF NOT public.is_admin(p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can create game questions.';
    END IF;

    -- 2. Validate Question Engine Type Allowlist FIRST
    IF p_question_type IS NULL OR trim(p_question_type) NOT IN (
        'find_correct_picture', 'identify_object', 'match_picture_word',
        'find_different_picture', 'category_identification', 'multiple_choice',
        'image_selection', 'audio_recognition', 'matching', 'spelling',
        'missing_letters', 'true_false', 'quiz', 'memory_pairs', 'sequencing'
    ) THEN
        RAISE EXCEPTION 'Unsupported or missing question engine type "%".', p_question_type;
    END IF;

    -- 3. Validate Input Strings & Sort Order
    IF p_question_text IS NULL OR length(trim(p_question_text)) = 0 THEN
        RAISE EXCEPTION 'Question text cannot be empty.';
    END IF;

    IF p_sort_order IS NOT NULL AND (p_sort_order < 0 OR p_sort_order > 10000) THEN
        RAISE EXCEPTION 'sort_order must be an integer between 0 and 10000.';
    END IF;

    -- 4. Idempotency Check (if key provided) using deterministic SHA-256 hash
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        v_req_hash := encode(digest(
            p_game_id::text || '|' ||
            COALESCE(p_subcategory_id::text, '') || '|' ||
            COALESCE(p_level_id::text, '') || '|' ||
            trim(p_question_text) || '|' ||
            trim(p_question_type) || '|' ||
            COALESCE(trim(p_instructions), '') || '|' ||
            COALESCE(p_sort_order::text, '') || '|' ||
            COALESCE(p_config::text, '{}') || '|' ||
            COALESCE(p_image_asset_id::text, '') || '|' ||
            COALESCE(p_audio_asset_id::text, '') || '|' ||
            COALESCE(p_options::text, '[]'),
            'sha256'
        ), 'hex');

        BEGIN
            INSERT INTO public.idempotency_keys (user_id, operation_name, idempotency_key, request_hash, status)
            VALUES (p_user_id, 'create_game_question', trim(p_idempotency_key), v_req_hash, 'in_flight');
        EXCEPTION WHEN unique_violation THEN
            SELECT status, request_hash, response_payload INTO v_idemp_status, v_stored_hash, v_stored_payload
            FROM public.idempotency_keys
            WHERE user_id = p_user_id AND operation_name = 'create_game_question' AND idempotency_key = trim(p_idempotency_key);

            IF v_stored_hash <> v_req_hash THEN
                RAISE EXCEPTION 'Idempotency key payload mismatch.';
            END IF;

            IF v_idemp_status = 'completed' THEN
                RETURN (v_stored_payload->>'question_id')::UUID;
            ELSE
                RAISE EXCEPTION 'Request with idempotency key is currently processing or failed.';
            END IF;
        END;
    END IF;

    -- 5. HIERARCHICAL TOP-DOWN ROW LOCKING
    -- A. Lock Explorer
    IF p_subcategory_id IS NULL THEN
        RAISE EXCEPTION 'Subcategory ID is required.';
    END IF;
    SELECT explorer_id INTO v_locked_explorer_id FROM public.homescreen_explorer_subcategories WHERE id = p_subcategory_id;
    PERFORM id FROM public.homescreen_explorer WHERE id = v_locked_explorer_id FOR UPDATE;

    -- B. Lock Subcategory
    SELECT id INTO v_locked_sub_id FROM public.homescreen_explorer_subcategories WHERE id = p_subcategory_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subcategory with ID % does not exist.', p_subcategory_id; END IF;

    -- C. Lock Game
    SELECT id, is_published INTO v_locked_game_id, v_game_is_published
    FROM public.games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game with ID % does not exist.', p_game_id;
    END IF;

    IF v_game_is_published IS TRUE THEN
        RAISE EXCEPTION 'Cannot create questions directly in a published game. Create questions before publishing or publish a new release snapshot via publish_game_release().';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.subcategory_games
        WHERE subcategory_id = p_subcategory_id AND game_id = p_game_id
    ) THEN
        RAISE EXCEPTION 'Game % is not assigned to subcategory %.', p_game_id, p_subcategory_id;
    END IF;

    -- D. Lock Level
    IF p_level_id IS NOT NULL THEN
        SELECT game_id INTO v_level_game_id
        FROM public.game_levels
        WHERE id = p_level_id
        FOR KEY SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Level with ID % does not exist.', p_level_id;
        ELSIF v_level_game_id IS DISTINCT FROM p_game_id THEN
            RAISE EXCEPTION 'Level % belongs to Game %, but Question specifies Game %.', p_level_id, v_level_game_id, p_game_id;
        END IF;
    END IF;

    -- 6. Validate Option Array & Correct-Answer Rules
    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' AND jsonb_array_length(p_options) > 0 THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(p_options)
        LOOP
            IF jsonb_typeof(v_opt) <> 'object' THEN
                RAISE EXCEPTION 'Malformed option item: expected JSON object.';
            END IF;
            IF COALESCE((v_opt->>'is_correct')::BOOLEAN, FALSE) IS TRUE THEN
                v_has_correct_option := TRUE;
            END IF;
        END LOOP;

        IF p_question_type IN ('multiple_choice', 'image_selection', 'audio_recognition', 'quiz', 'true_false', 'find_correct_picture', 'find_different_picture', 'identify_object', 'match_picture_word', 'category_identification', 'spelling', 'missing_letters')
           AND NOT v_has_correct_option THEN
            RAISE EXCEPTION 'Question type "%" requires at least one correct option (is_correct = true).', p_question_type;
        END IF;
    END IF;

    -- 7. Insert question with is_draft = TRUE ALWAYS
    INSERT INTO public.questions (
        game_id,
        subcategory_id,
        level_id,
        question_text,
        question_type,
        instructions,
        sort_order,
        is_draft,
        config,
        image_asset_id,
        audio_asset_id
    )
    VALUES (
        p_game_id,
        p_subcategory_id,
        p_level_id,
        trim(p_question_text),
        trim(p_question_type),
        trim(p_instructions),
        COALESCE(p_sort_order, 0),
        TRUE, -- ALWAYS TRUE (callers cannot override)
        COALESCE(p_config, '{}'::jsonb),
        p_image_asset_id,
        p_audio_asset_id
    )
    RETURNING id INTO v_new_question_id;

    -- 8. Insert options atomically in the same transaction
    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' AND jsonb_array_length(p_options) > 0 THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(p_options)
        LOOP
            v_idx := v_idx + 1;
            v_opt_text := v_opt->>'option_text';
            v_opt_is_correct := COALESCE((v_opt->>'is_correct')::BOOLEAN, FALSE);
            v_opt_media_id := (v_opt->>'media_asset_id')::UUID;
            v_opt_sort := COALESCE((v_opt->>'sort_order')::INT, v_idx);

            INSERT INTO public.question_options (
                question_id,
                option_text,
                is_correct,
                sort_order,
                media_asset_id
            )
            VALUES (
                v_new_question_id,
                v_opt_text,
                v_opt_is_correct,
                v_opt_sort,
                v_opt_media_id
            );
        END LOOP;
    END IF;

    -- 9. Complete Idempotency record if key was provided
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.idempotency_keys
        SET status = 'completed',
            response_payload = jsonb_build_object('question_id', v_new_question_id)
        WHERE user_id = p_user_id AND operation_name = 'create_game_question' AND idempotency_key = trim(p_idempotency_key);
    END IF;

    RETURN v_new_question_id;
END;
$;

ALTER FUNCTION public.create_game_question(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, UUID, UUID, JSONB, VARCHAR(100), TEXT) OWNER TO sproutelle_db_owner;

CREATE OR REPLACE FUNCTION public.update_game_question(
    p_question_id UUID,
    p_game_id UUID,
    p_subcategory_id UUID,
    p_level_id UUID,
    p_question_text TEXT,
    p_question_type TEXT,
    p_instructions TEXT,
    p_sort_order INT,
    p_config JSONB,
    p_image_asset_id UUID,
    p_audio_asset_id UUID,
    p_options JSONB,
    p_idempotency_key VARCHAR(100),
    p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
    v_locked_explorer_id UUID;
    v_locked_sub_id UUID;
    v_locked_game_id UUID;
    v_game_is_published BOOLEAN;
    v_locked_question_id UUID;
    v_question_game_id UUID;
    v_level_game_id UUID;
    v_req_hash TEXT;
    v_idemp_status TEXT;
    v_stored_hash TEXT;
    v_stored_payload JSONB;
    v_opt JSONB;
    v_opt_text TEXT;
    v_opt_is_correct BOOLEAN;
    v_opt_media_id UUID;
    v_opt_sort INT;
    v_has_correct_option BOOLEAN := FALSE;
    v_idx INT := 0;
BEGIN
    -- 1. Authorization Check via Worker Trust Boundary
    IF NOT public.is_admin(p_user_id) THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can edit game questions.';
    END IF;

    -- 2. Idempotency Check (if key provided) using deterministic SHA-256 hash
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        v_req_hash := encode(digest(
            p_question_id::text || '|' ||
            p_game_id::text || '|' ||
            COALESCE(p_subcategory_id::text, '') || '|' ||
            COALESCE(p_level_id::text, '') || '|' ||
            trim(p_question_text) || '|' ||
            trim(p_question_type) || '|' ||
            COALESCE(trim(p_instructions), '') || '|' ||
            COALESCE(p_sort_order::text, '') || '|' ||
            COALESCE(p_config::text, '{}') || '|' ||
            COALESCE(p_image_asset_id::text, '') || '|' ||
            COALESCE(p_audio_asset_id::text, '') || '|' ||
            COALESCE(p_options::text, '[]'),
            'sha256'
        ), 'hex');

        BEGIN
            INSERT INTO public.idempotency_keys (user_id, operation_name, idempotency_key, request_hash, status)
            VALUES (p_user_id, 'update_game_question', trim(p_idempotency_key), v_req_hash, 'in_flight');
        EXCEPTION WHEN unique_violation THEN
            SELECT status, request_hash, response_payload INTO v_idemp_status, v_stored_hash, v_stored_payload
            FROM public.idempotency_keys
            WHERE user_id = p_user_id AND operation_name = 'update_game_question' AND idempotency_key = trim(p_idempotency_key);

            IF v_stored_hash <> v_req_hash THEN
                RAISE EXCEPTION 'Idempotency key payload mismatch.';
            END IF;

            IF v_idemp_status = 'completed' THEN
                RETURN TRUE;
            ELSE
                RAISE EXCEPTION 'Request with idempotency key is currently processing or failed.';
            END IF;
        END;
    END IF;

    -- 3. Validate Input Strings & Sort Order
    IF p_question_type IS NULL OR trim(p_question_type) NOT IN (
        'find_correct_picture', 'identify_object', 'match_picture_word',
        'find_different_picture', 'category_identification', 'multiple_choice',
        'image_selection', 'audio_recognition', 'matching', 'spelling',
        'missing_letters', 'true_false', 'quiz', 'memory_pairs', 'sequencing'
    ) THEN
        RAISE EXCEPTION 'Unsupported or missing question engine type "%".', p_question_type;
    END IF;

    IF p_question_text IS NULL OR length(trim(p_question_text)) = 0 THEN
        RAISE EXCEPTION 'Question text cannot be empty.';
    END IF;

    IF p_sort_order IS NOT NULL AND (p_sort_order < 0 OR p_sort_order > 10000) THEN
        RAISE EXCEPTION 'sort_order must be an integer between 0 and 10000.';
    END IF;

    -- 4. HIERARCHICAL TOP-DOWN ROW LOCKING
    -- A. Lock Explorer
    IF p_subcategory_id IS NULL THEN
        RAISE EXCEPTION 'Subcategory ID is required.';
    END IF;
    SELECT explorer_id INTO v_locked_explorer_id FROM public.homescreen_explorer_subcategories WHERE id = p_subcategory_id;
    PERFORM id FROM public.homescreen_explorer WHERE id = v_locked_explorer_id FOR UPDATE;

    -- B. Lock Subcategory
    SELECT id INTO v_locked_sub_id FROM public.homescreen_explorer_subcategories WHERE id = p_subcategory_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subcategory with ID % does not exist.', p_subcategory_id; END IF;

    -- C. Lock Game
    SELECT id, is_published INTO v_locked_game_id, v_game_is_published
    FROM public.games
    WHERE id = p_game_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Game with ID % does not exist.', p_game_id;
    END IF;

    IF v_game_is_published IS TRUE THEN
        RAISE EXCEPTION 'Cannot edit questions directly in a published game. Published content changes MUST publish a new release snapshot via publish_game_release().';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.subcategory_games
        WHERE subcategory_id = p_subcategory_id AND game_id = p_game_id
    ) THEN
        RAISE EXCEPTION 'Game % is not assigned to subcategory %.', p_game_id, p_subcategory_id;
    END IF;

    -- D. Lock Level
    IF p_level_id IS NOT NULL THEN
        SELECT game_id INTO v_level_game_id
        FROM public.game_levels
        WHERE id = p_level_id
        FOR KEY SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Level with ID % does not exist.', p_level_id;
        ELSIF v_level_game_id IS DISTINCT FROM p_game_id THEN
            RAISE EXCEPTION 'Level % belongs to Game %, but Question specifies Game %.', p_level_id, v_level_game_id, p_game_id;
        END IF;
    END IF;

    -- E. Lock Question
    SELECT id, game_id INTO v_locked_question_id, v_question_game_id
    FROM public.questions
    WHERE id = p_question_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Question with ID % does not exist.', p_question_id;
    END IF;

    IF v_question_game_id IS DISTINCT FROM p_game_id THEN
        RAISE EXCEPTION 'Question % belongs to Game %, but specified Game %.', p_question_id, v_question_game_id, p_game_id;
    END IF;

    -- 5. Validate Option Array & Correct-Answer Rules (if explicitly supplied)
    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' AND jsonb_array_length(p_options) > 0 THEN
        FOR v_opt IN SELECT * FROM jsonb_array_elements(p_options)
        LOOP
            IF jsonb_typeof(v_opt) <> 'object' THEN
                RAISE EXCEPTION 'Malformed option item: expected JSON object.';
            END IF;

            IF COALESCE((v_opt->>'is_correct')::BOOLEAN, FALSE) IS TRUE THEN
                v_has_correct_option := TRUE;
            END IF;
        END LOOP;

        IF p_question_type IN ('multiple_choice', 'image_selection', 'audio_recognition', 'quiz', 'true_false', 'find_correct_picture', 'find_different_picture', 'identify_object', 'match_picture_word', 'category_identification', 'spelling', 'missing_letters')
           AND NOT v_has_correct_option THEN
            RAISE EXCEPTION 'Question type "%" requires at least one correct option (is_correct = true).', p_question_type;
        END IF;
    END IF;

    -- 6. Update Question record fields using explicit presence semantics
    -- We assume the client provides all non-optional fields or explicit NULLs
    UPDATE public.questions
    SET subcategory_id = p_subcategory_id,
        level_id = p_level_id,
        question_text = trim(p_question_text),
        question_type = trim(p_question_type),
        instructions = CASE WHEN p_instructions IS NOT NULL AND length(trim(p_instructions)) > 0 THEN trim(p_instructions) ELSE NULL END,
        sort_order = COALESCE(p_sort_order, 0),
        config = COALESCE(p_config, '{}'::jsonb),
        image_asset_id = p_image_asset_id,
        audio_asset_id = p_audio_asset_id,
        updated_at = NOW()
    WHERE id = p_question_id;

    -- 7. Atomic Option Replacement (Only if p_options is explicitly supplied as a JSON array)
    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' THEN
        DELETE FROM public.question_options WHERE question_id = p_question_id;

        IF jsonb_array_length(p_options) > 0 THEN
            FOR v_opt IN SELECT * FROM jsonb_array_elements(p_options)
            LOOP
                v_idx := v_idx + 1;
                v_opt_text := v_opt->>'option_text';
                v_opt_is_correct := COALESCE((v_opt->>'is_correct')::BOOLEAN, FALSE);
                v_opt_media_id := (v_opt->>'media_asset_id')::UUID;
                v_opt_sort := COALESCE((v_opt->>'sort_order')::INT, v_idx);

                INSERT INTO public.question_options (
                    question_id,
                    option_text,
                    is_correct,
                    sort_order,
                    media_asset_id
                )
                VALUES (
                    p_question_id,
                    v_opt_text,
                    v_opt_is_correct,
                    v_opt_sort,
                    v_opt_media_id
                );
            END LOOP;
        END IF;
    END IF;

    -- 8. Complete Idempotency record if key was provided
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        UPDATE public.idempotency_keys
        SET status = 'completed',
            response_payload = '{"success":true}'::jsonb
        WHERE user_id = p_user_id AND operation_name = 'update_game_question' AND idempotency_key = trim(p_idempotency_key);
    END IF;

    RETURN TRUE;
END;
$;

ALTER FUNCTION public.update_game_question(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, UUID, UUID, JSONB, VARCHAR, TEXT) OWNER TO sproutelle_db_owner;

--------------------------------------------------------------------------------
-- 5. LEAST-PRIVILEGE GRANTS & DEFAULT PRIVILEGES FOR SEPARATE NEON ROLES
--------------------------------------------------------------------------------

-- Revoke default PUBLIC privileges on schema and future objects
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE sproutelle_db_owner IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE sproutelle_db_owner IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- A. Better Auth Role Grants (sproutelle_auth_role)
GRANT USAGE ON SCHEMA public TO sproutelle_auth_role;

-- B. Public Role Grants (sproutelle_public_role)
-- Direct SELECT on ALL base content tables, question_options, game_releases, admin_users, and auth tables is STRICTLY REVOKED.
GRANT USAGE ON SCHEMA public TO sproutelle_public_role;
REVOKE ALL ON TABLE
    public.games,
    public.game_categories,
    public.homescreen_explorer,
    public.homescreen_explorer_subcategories,
    public.subcategory_games,
    public.game_levels,
    public.questions,
    public.question_options,
    public.game_releases,
    public.admin_users,
    public.media_assets,
    public.idempotency_keys,
    public.published_question_options
FROM sproutelle_public_role, PUBLIC;

-- Public Role can ONLY SELECT from sanitized public views
GRANT SELECT ON TABLE
    public.public_published_games,
    public.public_published_categories,
    public.public_active_explorers,
    public.public_active_subcategories,
    public.public_active_subcategory_games,
    public.public_published_game_levels,
    public.public_published_media_assets
TO sproutelle_public_role;

-- C. Admin Role Grants (sproutelle_admin_role)
-- Used exclusively after Worker API validates Better Auth session and verifies admin authorization.
GRANT USAGE ON SCHEMA public TO sproutelle_admin_role;
GRANT SELECT ON TABLE public.admin_users TO sproutelle_admin_role;

GRANT SELECT, DELETE ON TABLE
    public.media_assets,
    public.game_categories,
    public.homescreen_explorer,
    public.homescreen_explorer_subcategories,
    public.games,
    public.game_levels,
    public.questions,
    public.activity_media,
    public.game_versions
TO sproutelle_admin_role;

GRANT SELECT ON TABLE public.game_releases, public.subcategory_games, public.question_options, public.idempotency_keys, public.published_question_options TO sproutelle_admin_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.game_releases FROM sproutelle_admin_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subcategory_games FROM sproutelle_admin_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.question_options FROM sproutelle_admin_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.admin_users FROM sproutelle_admin_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.idempotency_keys FROM sproutelle_admin_role;

-- Column-Level INSERT & UPDATE grants for Admin Studio editing
GRANT INSERT (id, category_id, subcategory_id, name, slug, description, game_type, config, sort_order)
    ON TABLE public.games TO sproutelle_admin_role;

GRANT UPDATE (category_id, subcategory_id, name, slug, description, game_type, config, sort_order, updated_at)
    ON TABLE public.games TO sproutelle_admin_role;

GRANT INSERT (id, subcategory_id, level_id, question_text, question_type, instructions, sort_order, config, image_asset_id, audio_asset_id)
    ON TABLE public.questions TO sproutelle_admin_role;

GRANT UPDATE (subcategory_id, level_id, question_text, question_type, instructions, sort_order, config, image_asset_id, audio_asset_id, updated_at)
    ON TABLE public.questions TO sproutelle_admin_role;

GRANT INSERT, UPDATE (name, slug, description, icon_asset_id, sort_order, updated_at)
    ON TABLE public.game_categories TO sproutelle_admin_role;

GRANT INSERT, UPDATE (title_name, title_image_asset_id, background_color, category_id, sort_order, is_active, updated_at)
    ON TABLE public.homescreen_explorer TO sproutelle_admin_role;

GRANT INSERT, UPDATE (name, image_asset_id, background_color, category_id, sort_order, is_active, updated_at)
    ON TABLE public.homescreen_explorer_subcategories TO sproutelle_admin_role;

GRANT INSERT, UPDATE (level_number, title, description, pass_score, sort_order)
    ON TABLE public.game_levels TO sproutelle_admin_role;

GRANT INSERT, UPDATE (name, bucket_name, file_path, mime_type, size_bytes, checksum_sha256, created_by)
    ON TABLE public.media_assets TO sproutelle_admin_role;

-- D. EXPLICIT RPC EXECUTE GRANTS
REVOKE ALL ON FUNCTION public.is_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_published_media_asset(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_published_content_pack(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_game_release(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_question_draft_status(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_game_question(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, UUID, UUID, JSONB, VARCHAR(100), TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_game_question(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, UUID, UUID, JSONB, VARCHAR(100), TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_subcategory_games(UUID, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_subcategory_with_games(UUID, UUID, TEXT, UUID, TEXT, UUID, INT, BOOLEAN, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_game_level_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_question_level_game() FROM PUBLIC;

-- Public RPC Grants (Callable by sproutelle_public_role and sproutelle_admin_role)
GRANT EXECUTE ON FUNCTION public.is_published_media_asset(TEXT) TO sproutelle_public_role, sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.get_published_content_pack(UUID) TO sproutelle_public_role, sproutelle_admin_role;

-- Admin RPC Grants (Callable ONLY by sproutelle_admin_role)
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.publish_game_release(UUID, TEXT, JSONB, TEXT) TO sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.toggle_question_draft_status(UUID, UUID, BOOLEAN, TEXT) TO sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.create_game_question(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, UUID, UUID, JSONB, VARCHAR(100), TEXT) TO sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.update_game_question(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, JSONB, UUID, UUID, JSONB, VARCHAR(100), TEXT) TO sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.save_subcategory_games(UUID, JSONB, TEXT) TO sproutelle_admin_role;
GRANT EXECUTE ON FUNCTION public.save_subcategory_with_games(UUID, UUID, TEXT, UUID, TEXT, UUID, INT, BOOLEAN, JSONB, TEXT) TO sproutelle_admin_role;

COMMIT;
```


---

## 6. Provisional Better Auth Schema DDL (`03_provisional_better_auth.sql`)

*Note: Kept in a separate migration file and marked **[PROVISIONAL]** pending Phase 4 selection of the specific Better Auth version and ORM adapter.*

```sql
-- Provisional Better Auth DDL Script (03_provisional_better_auth.sql)
-- Executed by Database Owner Role: sproutelle_db_owner
-- Status: [PROVISIONAL]

BEGIN;

CREATE TABLE IF NOT EXISTS public.user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.session (
    id TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES public.user(id) ON DELETE CASCADE
);

ALTER TABLE public.session OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account OWNER TO sproutelle_db_owner;

CREATE TABLE IF NOT EXISTS public.verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.verification OWNER TO sproutelle_db_owner;

-- Grants for sproutelle_auth_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.user,
    public.session,
    public.account,
    public.verification
TO sproutelle_auth_role;

COMMIT;
```

---

## 7. Operational Data Import & Migration Sequencing (`[PROPOSED NEON SECURITY DESIGN]`)

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Bootstrap Neon Roles & Schema                      │
│  - Execute 01_neon_bootstrap.sql as neondb_owner            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Content-Only DDL Execution                         │
│  - Execute 02_neon_schema_migration.sql as sproutelle_db_owner│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Content Database Data Import                       │
│  - Import content tables into Neon without identity FKs     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Verify Better Auth Version & Adapter               │
│  - Confirm Better Auth version & ORM adapter schema         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Install Verified Better Auth Schema                │
│  - Execute 03_provisional_better_auth.sql as sproutelle_db_owner│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Import User Records                                │
│  - Import user records into public.user                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Import Account Records                             │
│  - Import account records into public.account               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 8: Reconcile Identities & Resolve Conflicts           │
│  - Match Supabase auth.users UUIDs to Better Auth user.id   │
│  - Resolve ambiguous or duplicate email accounts            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 9: Add Deferred Identity Foreign Keys                 │
│  - Execute 04_post_reconciliation_identity_fks.sql          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 10: Process Session & Verification Records            │
│  - Invalidate active session tokens; discard stale tokens   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 11: Validate Referential Integrity & Migration Counts │
│  - Verify row counts, foreign keys, and application queries │
└─────────────────────────────────────────────────────────────┘
```

1. **Step 1: Bootstrap Neon Roles & Schema:** Execute `01_neon_bootstrap.sql` as `neondb_owner` to create roles and assign `public` schema ownership.
2. **Step 2: Content-Only DDL Execution:** Execute `02_neon_schema_migration.sql` as `sproutelle_db_owner`.
3. **Step 3: Content Data Import:** Import data into 13 content tables without identity FK constraints.
4. **Step 4: Verify Better Auth Version & Adapter:** Confirm exact Better Auth version and ORM adapter schema in Phase 4.
5. **Step 5: Install Verified Better Auth Schema:** Deploy `03_provisional_better_auth.sql` as `sproutelle_db_owner`.
6. **Step 6: Import User Records:** Import user records into `public.user`.
7. **Step 7: Import Account Records:** Import account records into `public.account`.
8. **Step 8: Reconcile Identities & Resolve Conflicts:** Match Supabase `auth.users` UUIDs to Better Auth `user.id` using primary keys and verified emails; flag ambiguous identities for manual resolution.
9. **Step 9: Add Deferred Identity Foreign Keys:** Deploy `04_post_reconciliation_identity_fks.sql` to add FK constraints on `admin_users.id` and `media_assets.created_by`.
10. **Step 10: Process Session & Verification Records (Migration Policy):**
    - **Supabase Session Records:** Active Supabase sessions (GoTrue JWT format) are **incompatible** with Better Auth session schema. All active Supabase session records will be **discarded / invalidated** during migration `[DECISION REQUIRED BEFORE MIGRATION]`.
    - **Better Auth Session Records:** Session records created on Neon during testing/dual-run phase are **invalidated** during rollback `[DECISION REQUIRED BEFORE MIGRATION]`.
    - **Supabase Verification Records:** Stale Supabase verification tokens are **discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
    - **Better Auth Verification Records:** Expired verification records created on Neon are **discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
    *(Note: Step 10 cannot be approved for live production migration until every session and verification record policy is explicitly confirmed prior to cutover `[DECISION REQUIRED BEFORE MIGRATION]`)*.
11. **Step 11: Validate Referential Integrity & Migration Counts:** Run automated verification suite to confirm 100% referential integrity across all tables.

---

## 8. Operational Rollback Plan & Full-Snapshot Reconciliation (`[UNTESTED — REHEARSAL REQUIRED]`)

### A. Pre-Cutover Rollback (Zero Data Risk)
- **Trigger:** DDL execution error, initial API connectivity error, or validation error during read-only testing before live DNS cutover.
- **Procedure:** Revert Cloudflare Worker API database connection URL or Admin Portal environment setting `VITE_SUPABASE_URL` back to Supabase. Supabase remained the active write authority throughout; zero data loss occurs.

### B. Post-Cutover Operational Rollback (Neon Accepted Production Writes)
- **Trigger:** Production API crash, corrupted release pack generation, R2 media delivery failure, or data loss after live traffic cutover to Neon.
- **Reconciliation Limitation Note:** Timestamp-based filtering (`WHERE updated_at > T_cutover`) is **insufficient** because hard-deleted rows or row overwrites leave no timestamp trace in standard PostgreSQL. A **full-snapshot comparison reconciliation approach** is defined:

  1. **Phase A (Immediate Write Freeze & Maintenance Window):** Enable maintenance mode on Cloudflare Worker API to block all incoming POST/PUT/DELETE mutations on Neon across all client routes (Admin Studio UI, mobile app, background tasks). Record cutover boundary timestamp `T_cutover`.
  2. **Phase B (Neon Full-Database Snapshot Dump):** Execute full database dump on Neon across all 13 content tables (`media_assets`, `game_categories`, `homescreen_explorer`, `homescreen_explorer_subcategories`, `games`, `subcategory_games`, `game_levels`, `questions`, `question_options`, `activity_media`, `game_versions`, `game_releases`, `admin_users`) and 4 Better Auth tables (`user`, `session`, `account`, `verification`).
  3. **Phase C (Full-Snapshot Comparison & Diff Analysis):** Run data reconciliation utility comparing pre-cutover Supabase baseline dump against final Neon snapshot:
     - **Inserts:** Rows in Neon snapshot not present in Supabase baseline $\rightarrow$ Inserted into Supabase in foreign-key dependency order (`admin_users` $\rightarrow$ `media_assets` $\rightarrow$ `game_categories` $\rightarrow$ `homescreen_explorer` $\rightarrow$ `homescreen_explorer_subcategories` $\rightarrow$ `games` $\rightarrow$ `subcategory_games` $\rightarrow$ `game_levels` $\rightarrow$ `questions` $\rightarrow$ `question_options` $\rightarrow$ `activity_media` $\rightarrow$ `game_versions` $\rightarrow$ `game_releases`).
     - **Updates:** Rows in both databases where column values differ $\rightarrow$ Updated in Supabase to match final Neon state.
     - **Deletions:** Rows present in Supabase baseline missing from Neon snapshot $\rightarrow$ Deleted from Supabase (after verifying deletion was authorized).
  4. **Phase D (R2 Media Object Reconciliation):** Reconcile Cloudflare R2 bucket (`sproutelle-game-assets`) with Supabase Storage `game-assets`:
     - **New Objects in R2:** Downloaded from R2 and uploaded to Supabase Storage bucket.
     - **Replaced / Overwritten Objects:** Verified via SHA-256 checksum & byte size; overwritten in Supabase Storage with updated metadata.
     - **Deleted Objects:** Removed from Supabase Storage bucket.
     - **Dry-Run:** A dry-run reconciliation report is generated and reviewed before performing destructive deletions in Supabase Storage.
  5. **Phase E (Better Auth Identity & Session Reconciliation):**
     - User identity records (`public.user`) mapped by email & primary key UUIDs to restore admin accounts.
     - Session and verification records reconciled strictly according to the four-category lifecycle matrix:
       1. **Supabase Session Records (GoTrue JWT):**
          - *Active / Unexpired:* **Invalidated / Discarded** (Users/admins log in on Supabase to issue a new GoTrue JWT session token) `[DECISION REQUIRED BEFORE MIGRATION]`.
          - *Expired:* **Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
          - *Invalid / Revoked:* **Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
       2. **Better Auth Session Records:**
          - *Active / Unexpired:* **Invalidated / Discarded** (Neon Better Auth sessions are not imported into Supabase GoTrue auth) `[DECISION REQUIRED BEFORE MIGRATION]`.
          - *Expired:* **Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
          - *Invalid / Revoked:* **Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
       3. **Supabase Verification Records (GoTrue OTP/Tokens):**
          - *Active / Unexpired:* **Invalidated / Discarded** (Users request a new verification token on Supabase) `[DECISION REQUIRED BEFORE MIGRATION]`.
          - *Expired:* **Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
       4. **Better Auth Verification Records:**
          - *Active / Unexpired:* **Invalidated / Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
          - *Expired:* **Discarded** `[DECISION REQUIRED BEFORE MIGRATION]`.
  6. **Phase F (Validation Gate & Supabase Reopening):** Run automated test suite (`npm test`) and data integrity queries against Supabase to verify 100% row, foreign-key, and release pack fidelity before reopening writes on Supabase.
  7. **Phase G (Traffic Shift):** Revert API base URL to point back to Supabase and disable maintenance mode.

---

## 9. Summary of Evidence Status & Phase 3 Readiness Decision

### Evidence Status Matrix
- **[VERIFIED AGAINST SUPABASE SQL]:** Table DDLs, foreign key cascades, triggers, indexes, views, RPC functions (`publish_game_release`, `get_published_content_pack`, `save_subcategory_games`, `save_subcategory_with_games`, `is_published_media_asset`) with exact `SECURITY DEFINER`, `SET search_path = ''`, `OWNER TO sproutelle_db_owner`, `REVOKE ALL FROM PUBLIC`, and explicit `GRANT EXECUTE TO sproutelle_admin_role / sproutelle_public_role` statements, storage call sites, and auth error handling paths.
- **[PROPOSED NEON SECURITY DESIGN]:** Role separation (`sproutelle_db_owner`, `sproutelle_public_role`, `sproutelle_admin_role`, `sproutelle_auth_role`), distinct connection strings in Worker Secrets, sanitized public views (`public_published_games`, `public_published_categories`, `public_active_explorers`, `public_active_subcategories`, `public_active_subcategory_games`, `public_published_game_levels`, `public_published_media_assets`), revocation of admin mutation privileges on `admin_users`, revocation of direct mutation privileges on `game_releases`, revocation of direct mutation privileges on `subcategory_games`, revocation of direct mutation privileges on `question_options`, column-level INSERT/UPDATE grants on `games` excluding `is_published`, column-level INSERT/UPDATE grants on `questions` excluding `is_draft` and `game_id`, and operation-specific SQL grants.
- **[SQL PRESENT IN PROPOSED DDL]:** DDL statements present in Section 5 script (`02_neon_schema_migration.sql`).
- **[UNVERIFIED]:**
  1. **Supabase Password Hashes:** Direct access to `auth.users.encrypted_password` in managed Supabase system schemas is **[UNVERIFIED]** without database backup dumps. If password hash exports are unavailable during migration, administrators will require an initial password reset upon migrating.
  2. **Cloudflare R2 Object Delivery:** Object migration from Supabase Storage `game-assets` to R2 bucket (`sproutelle-game-assets`) and pre-signed URL delivery via Worker (3,600s expiration) are **[PROPOSED DESIGN]** until Phase 3 execution.
  3. **Android API Compatibility:** Android client behavior is **[UNVERIFIED]** pending a separate audit of the `sproutelle-android` repository.
  4. **Better Auth DDL Schema:** The proposed Better Auth DDLs (`user`, `session`, `account`, `verification`) are marked **[PROVISIONAL]** pending selection of the specific Better Auth version and ORM adapter in Phase 4.

### Separate Readiness Decisions (`[DECISION REQUIRED]`)
- **Documentation Preparation:** **APPROVED**.
- **Content DDL Static Syntax Review & Preparation (APPROVED):** The content DDL schema (`02_neon_schema_migration.sql`), having zero dependencies on Better Auth tables, is **APPROVED FOR SYNTAX PREPARATION AND VERIFICATION ON THE NEON `development` BRANCH**.
- **Content DDL Execution on Neon `development`:** **CONDITIONS REQUIRED** (`[NEON CONFIRMATION REQUIRED]` for initial `neondb_owner` role privileges).
- **Better Auth Schema Installation:** **BLOCKED** until Phase 4 version & adapter selection.
- **Data Migration:** **BLOCKED** until Phase 3 (R2 media sync) and Phase 4 (Better Auth schema confirmation) are complete.
- **Production Cutover:** **BLOCKED** until full rehearsal tests succeed.

### Compliance Confirmation
- Prepared updated migration plan document `NEON_MIGRATION_PLAN.md`.
- No application source code modified, no database connections established, no remote Supabase operations performed, no commits or pushes executed.
