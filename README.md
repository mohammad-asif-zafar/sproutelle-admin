# Sproutelle Content Studio (Admin Panel)

![Sproutelle Banner](https://img.shields.io/badge/Sproutelle-Content_Studio-1E4D3B?style=for-the-badge)
![React](https://img.shields.io/badge/React_19-TypeScript-blue?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite_6-Bundler-646CFF?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-Auth_%26_Storage-3ECF8E?style=for-the-badge)

The official web administration panel for **Sproutelle**, an ad-free educational games app for children aged 3–8.

---

## 🌟 Key Features & Security Architecture

- 🔐 **Secure GitHub OAuth & RLS Authorization**: Server-enforced PostgreSQL Row Level Security (RLS) policies guaranteeing that only explicitly enrolled administrator accounts in `admin_users` can insert, update, or delete content and media.
- 🎯 **Answer Key Protection**: Direct `question_options` reads containing answer keys (`is_correct`) are restricted to admins via table GRANTs and RLS. Unauthenticated/mobile clients consume choices through the sanitized `published_question_options` database view (evaluated with owner permissions, omitting `is_correct`).
- 📁 **Media Assets Studio**: Drag-and-drop file uploader supporting images, audio recordings, character animations, and background assets with direct Supabase Storage integration (`game-assets` bucket). Client validates file extensions (blocks `.exe`, `.sh`, etc.) and limits file size to 50MB before upload.
- 🧩 **Question Composer Studio**: Form to build educational questions, link reusable media assets, manage multiple answer options, mark correct answers, and toggle draft/published status.
- 📊 **Database Table Browser**: Universal data browser with search, column sorting, pagination, record creation, editing, and safe deletion confirmation across all 8 relational tables.
- 🚀 **GitHub Pages Deployment**: Automated continuous deployment workflow with single-page app (SPA) route fallback handling.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Routing**: React Router (`HashRouter`)
- **Icons**: Lucide Icons
- **Backend & Security**: Supabase Auth (GitHub OAuth), Supabase PostgreSQL with `SECURITY DEFINER` functions & Row Level Security, Supabase Storage (`game-assets` bucket)
- **Hosting**: GitHub Pages via GitHub Actions

---

## ⚙️ Step-by-Step Supabase Setup & Installation Guide

### 1. Prerequisites
- Node.js `v20+` (verified with `v26.12.1`)
- npm `v10+` (verified with `11.20.0`)
- A new, empty Supabase Project created on [Supabase.com](https://supabase.com)

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Provide your Supabase URL and Publishable Anon Key from **Supabase Dashboard -> Project Settings -> API**:
```ini
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-publishable-key>
VITE_BASE_PATH=/sproutelle-admin/
```

### 3. Database Migration Execution
Open your new `sproutelle-admin` Supabase Project Dashboard and navigate to the **SQL Editor**. Copy and execute the contents of [`supabase/migrations/20260330000000_initial_schema.sql`](file:///Volumes/DevelopmentSSD/workspace/sproutelle-admin/supabase/migrations/20260330000000_initial_schema.sql).

This transactional, idempotent script will:
- Enable the `uuid-ossp` extension.
- Create the `admin_users` table with default `is_admin = FALSE`.
- Define the hardened `is_admin()` helper function with `SECURITY DEFINER`, `postgres` ownership, and `SET search_path = ''`.
- Create all 8 relational tables (`media_assets`, `game_categories`, `games`, `game_levels`, `questions`, `question_options`, `activity_media`, `game_versions`) with write-time level/game validation constraints (`fk_questions_level_game`).
- Create the `published_question_options` view for safe mobile option delivery.
- Apply strict table grants and RLS policies across all tables.
- Provision the private `game-assets` storage bucket and set Storage RLS select/write policies.

### 4. GitHub OAuth Provider Setup
1. Go to [GitHub Developer Settings -> OAuth Applications](https://github.com/settings/developers) and click **Register a new application**.
2. **Application Name**: `Sproutelle Admin`
3. **Homepage URL**: `https://<github-username>.github.io/sproutelle-admin/` (or `http://localhost:5173/` for dev)
4. **Authorization Callback URL**: Copy your Supabase OAuth Callback URL from **Supabase Dashboard -> Authentication -> Providers -> GitHub** (looks like `https://<your-project-id>.supabase.co/auth/v1/callback`).
5. In Supabase Dashboard (**Authentication -> Providers -> GitHub**):
   - Toggle **Enable GitHub**.
   - Enter your GitHub OAuth **Client ID** and **Client Secret**.
6. In Supabase Dashboard (**Authentication -> URL Configuration**):
   - Add your local dev URL (`http://localhost:5173/`) and production URL (`https://<github-username>.github.io/sproutelle-admin/`) to **Redirect URLs**.

### 5. Secure First-Admin Enrollment (Bootstrap Procedure)
Ordinary GitHub OAuth sign-ins start with `is_admin = FALSE` and cannot grant themselves administrator privileges.

To authorize the first administrator account:
1. Open your local Sproutelle Admin panel (`npm run dev`) or production site and click **Continue with GitHub**.
2. After being redirected back, open your **Supabase Dashboard -> Authentication -> Users** and copy your User UUID and verified email.
3. Open **Supabase SQL Editor** and execute:
   ```sql
   INSERT INTO public.admin_users (id, email, is_admin)
   SELECT id, email, TRUE
   FROM auth.users
   WHERE id = 'REPLACE-WITH-AUTH-USER-UUID'::uuid
     AND email = 'REPLACE-WITH-VERIFIED-EMAIL'
   ON CONFLICT (id)
   DO UPDATE SET email = EXCLUDED.email, is_admin = TRUE;
   ```
4. Sign out and sign in again on the Sproutelle Admin panel. You will now have verified `Sproutelle Admin` status and complete write access!

---

## 🚀 Deployment to GitHub Pages

1. Push your code to the `main` branch of your GitHub repository.
2. In GitHub repository **Settings -> Pages**:
   - Source: **GitHub Actions**
3. In GitHub repository **Settings -> Secrets and variables -> Actions**:
   - Secret `VITE_SUPABASE_URL`: Your Supabase URL
   - Secret `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish the website to `https://<your-username>.github.io/sproutelle-admin/`.

---

## 🧪 Verification & Health Checks

To verify code quality and production build integrity:
```bash
# Run ESLint check
npm run lint

# Run TypeScript compilation and Vite build
npm run build
```
