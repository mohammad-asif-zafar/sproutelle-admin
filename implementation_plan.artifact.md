# Sproutelle Admin — Implementation Plan

This document outlines the design and implementation strategy for building the **Sproutelle Admin Content Studio**, a web application for managing educational assets, categories, games, levels, and questions for Sproutelle.

---

## User Review Required

> [!IMPORTANT]
> **Environment & Setup Notes:**
> 1. **Supabase Credentials**: The app will use public environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If credentials are not supplied during local execution, the UI will display a helpful, interactive "Supabase Setup State" explaining how to configure them and test the layout safely without failing.
> 2. **GitHub Pages Base Path**: `vite.config.ts` will be configured with `base: process.env.VITE_BASE_PATH || '/sproutelle-admin/'` to support hosting at `https://<user>.github.io/sproutelle-admin/` while maintaining dev server compatibility.
> 3. **Routing**: `HashRouter` will be used (or `BrowserRouter` with a fallback `404.html`) to prevent page reload 404 errors on GitHub Pages static hosting.

---

## Proposed Changes

### 1. Dependencies & Styling Setup

#### [MODIFY] [package.json](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/package.json)
- Add `@supabase/supabase-js` for Supabase API client.
- Add `react-router-dom` for application routing.
- Add `lucide-react` for clean icon set.

#### [MODIFY] [vite.config.ts](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/vite.config.ts)
- Configure base URL for GitHub Pages deployment (`/sproutelle-admin/`).

#### [NEW] [.env.example](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/.env.example)
- Provide template environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE_PATH`).

---

### 2. Styling & Theme System

#### [MODIFY] [src/index.css](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/index.css)
- Implement Sproutelle visual identity:
  - Background: Warm Ivory (`#FDFBF7`)
  - Primary Green: Deep Forest (`#1E4D3B`) & Emerald (`#2D6A4F`)
  - Accent / Gold: Warm Honey (`#E9A825`)
  - Soft Neutral Borders (`#E5E0D8`) & Surface Card colors (`#FFFFFF`, `#F7F4EF`)
  - Custom scrollbars, rounded input fields, badge styles, buttons, and animations.

---

### 3. Database Schema & Migrations

#### [NEW] [supabase/migrations/20260330000000_initial_schema.sql](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/supabase/migrations/20260330000000_initial_schema.sql)
- SQL migration script creating:
  - `admin_users` table & `is_admin()` helper function.
  - `media_assets` table for tracking uploaded files.
  - `game_categories` table.
  - `games` table.
  - `game_levels` table.
  - `questions` table.
  - `question_options` table.
  - `activity_media` relation table.
  - `game_versions` table.
  - Row Level Security (RLS) policies enforcing administrator-only write privileges across all tables.
  - Storage bucket `game-assets` creation and RLS policies for file upload/update/delete.

---

### 4. Application Architecture & Supabase Client

#### [NEW] [src/types/database.ts](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/types/database.ts)
- TypeScript interface definitions for database tables, records, forms, and Supabase client types.

#### [NEW] [src/lib/supabase.ts](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/lib/supabase.ts)
- Singleton Supabase client initialization.
- Auth helper functions (GitHub OAuth sign-in, sign-out, session listener, admin privileges verification).
- Storage helper functions (file uploads, deletion, public URL resolution).

#### [NEW] [src/context/AuthContext.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/context/AuthContext.tsx)
- React Context providing user session state, admin status check, sign-in, and sign-out actions.

---

### 5. Components & Layout

#### [NEW] [src/components/Layout/AppLayout.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/components/Layout/AppLayout.tsx)
- Top bar and navigation sidebar with Sproutelle Content Studio branding, status pill, user avatar, and sign-out control.

#### [NEW] [src/components/Common/SetupBanner.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/components/Common/SetupBanner.tsx)
- Banner displayed when Supabase credentials or admin permissions need configuration, offering guidance.

#### [NEW] [src/components/Common/Modal.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/components/Common/Modal.tsx)
- Reusable modal component for file details, edit forms, and confirmation dialogs.

#### [NEW] [src/components/Media/MediaSelectorModal.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/components/Media/MediaSelectorModal.tsx)
- Modal allowing users to search, filter, preview, and select existing uploaded media assets when linking to questions, options, or categories.

---

### 6. Main Feature Pages

#### [NEW] [src/pages/LoginPage.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/LoginPage.tsx)
- Premium branded login screen with "Continue with GitHub" OAuth button, error handling, and setup instructions if environment variables are unconfigured.

#### [NEW] [src/pages/DashboardPage.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/DashboardPage.tsx)
- Statistics cards (Total Media Assets, Categories, Games, Questions, Game Versions).
- Recent activity log and system health check status.

#### [NEW] [src/pages/UploadFilesPage.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/UploadFilesPage.tsx)
- Drag-and-drop zone supporting images, audio, and asset files.
- Multi-file queue with progress indicators, mime/size validation.
- Interactive Media Library grid & list view with search, type filter, copy path/asset ID buttons, and audio preview player.

#### [NEW] [src/pages/AddQuestionPage.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/AddQuestionPage.tsx)
- Form to compose questions linked to Game Categories, Games, and Levels.
- Interactive Answer Option manager (add/remove options, mark correct answer).
- Reusable image and audio media asset selector modal.
- Support for multiple question types (Multiple Choice, Image Selection, Matching, Audio Recognition).
- Draft vs. Published status toggle.

#### [NEW] [src/pages/ViewTablesPage.tsx](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/src/pages/ViewTablesPage.tsx)
- Universal Data Table browser for 8 key tables: `media_assets`, `game_categories`, `games`, `game_levels`, `questions`, `question_options`, `activity_media`, `game_versions`.
- Search filter, field sorting, pagination, add new record modal, edit modal, and safe delete confirmation.

---

### 7. Deployment & Documentation

#### [NEW] [.github/workflows/deploy.yml](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/.github/workflows/deploy.yml)
- GitHub Actions workflow to build Vite site and publish to GitHub Pages on push to `main`.

#### [NEW] [public/404.html](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/public/404.html)
- SPA routing fallback page for GitHub Pages static hosting.

#### [MODIFY] [README.md](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/README.md)
- Complete documentation detailing project setup, Supabase setup, GitHub OAuth creation, database migration steps, RLS policies, and deployment instructions.

---

## Verification Plan

### Automated Build & Code Quality
1. Dependency Installation: Run `npm install` to ensure clean installation.
2. Type Checking & Build: Run `npm run build` (`tsc -b && vite build`) to confirm zero compilation or bundling errors.
3. Linting: Run `npm run lint` to confirm clean ESLint compliance.

### Functional UI Verification
1. Test Sproutelle branding, login screen, and empty/unconfigured credential states.
2. Verify responsive layout, navigation menu, and theme consistency.
3. Verify file uploader drag-and-drop validation (file size limits, accepted file types).
4. Verify question editor logic (adding answer choices, toggling correct answers, selecting media).
5. Verify data table search, sorting, filtering, and tab navigation across all 8 tables.
