import React from 'react';
import { Key, Database, Globe, Shield } from 'lucide-react';

export const DocsPage: React.FC = () => {
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)' }}>Setup Guide & Schema Documentation</h2>
          <p className="page-subtitle">
            Complete instructions for connecting Supabase Auth, GitHub OAuth, database tables, and automated deployment.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Step 1 */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Key color="var(--color-primary)" size={22} />
              <h3 style={{ fontSize: '1.125rem' }}>1. Environment Setup</h3>
            </div>
          </div>
          <p style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
            Copy <code>.env.example</code> to <code>.env.local</code> in the project root and provide your Supabase project keys:
          </p>
          <pre style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}>
{`VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
VITE_BASE_PATH=/sproutelle-admin/`}
          </pre>
        </div>

        {/* Step 2 */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Database color="var(--color-primary)" size={22} />
              <h3 style={{ fontSize: '1.125rem' }}>2. Executing Database Migration Script</h3>
            </div>
          </div>
          <p style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
            Run the SQL migration script located at <code>supabase/migrations/20260330000000_initial_schema.sql</code> in the Supabase SQL Editor to create all 8 core tables, write-time constraints, RLS policies, and the <code>game-assets</code> Storage bucket.
          </p>
        </div>

        {/* Step 3 */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Shield color="var(--color-primary)" size={22} />
              <h3 style={{ fontSize: '1.125rem' }}>3. GitHub OAuth & Admin Bootstrap</h3>
            </div>
          </div>
          <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.6, fontSize: '0.875rem' }}>
            <li>Go to GitHub Developer Settings → OAuth Applications → Register a new application.</li>
            <li>Set Authorization callback URL to your Supabase Auth callback URL (e.g. <code>https://&lt;your-project-ref&gt;.supabase.co/auth/v1/callback</code>).</li>
            <li>In Supabase Auth settings → Providers → GitHub, enable GitHub and enter Client ID and Client Secret.</li>
            <li>Sign in once with your GitHub account, then execute the admin bootstrap query in the Supabase SQL Editor:</li>
          </ol>
          <pre style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
{`INSERT INTO public.admin_users (id, email, is_admin)
SELECT id, email, TRUE
FROM auth.users
WHERE id = 'REPLACE-WITH-AUTH-USER-UUID'::uuid
  AND email = 'REPLACE-WITH-VERIFIED-EMAIL'
ON CONFLICT (id)
DO UPDATE SET email = EXCLUDED.email, is_admin = TRUE;`}
          </pre>
        </div>

        {/* Step 4 */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Globe color="var(--color-primary)" size={22} />
              <h3 style={{ fontSize: '1.125rem' }}>4. GitHub Pages Deployment</h3>
            </div>
          </div>
          <p style={{ lineHeight: 1.5 }}>
            The included <code>.github/workflows/deploy.yml</code> workflow automatically builds and deploys the site to GitHub Pages on every push to the <code>main</code> branch.
          </p>
        </div>
      </div>
    </div>
  );
};
