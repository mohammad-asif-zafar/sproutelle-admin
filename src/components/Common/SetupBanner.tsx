import React from 'react';
import { Database, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SetupBanner: React.FC = () => {
  const { isConfigured, user, isAdmin } = useAuth();

  if (!isConfigured) {
    return (
      <div style={{
        backgroundColor: 'var(--color-warning-soft)',
        border: '1px solid var(--color-warning)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        color: '#7B341E'
      }}>
        <Database size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-warning)' }} />
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9375rem', fontWeight: 700 }}>
            Supabase Connection Required
          </h4>
          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.4 }}>
            The Sproutelle Admin Content Studio is running in standalone preview mode. To connect live database storage and authentication, set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file.
          </p>
        </div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return (
      <div style={{
        backgroundColor: 'var(--color-danger-soft)',
        border: '1px solid var(--color-danger)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        color: '#7F1D1D'
      }}>
        <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-danger)' }} />
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9375rem', fontWeight: 700 }}>
            Administrator Privileges Pending
          </h4>
          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.4 }}>
            Your account ({user.email}) is signed in, but has not yet been granted administrator privileges in the <code>admin_users</code> table. Please run the Supabase migration script to authorize your user ID: <code>{user.id}</code>.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
