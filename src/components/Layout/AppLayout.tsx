import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  FileQuestion,
  Database,
  LogOut,
  Sparkles,
  BookOpen,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SetupBanner } from '../Common/SetupBanner';

export const AppLayout: React.FC = () => {
  const { user, isAdmin, signOut, isConfigured } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/upload', label: 'Upload Files & Media', icon: UploadCloud },
    { to: '/questions/new', label: 'Add Question', icon: FileQuestion },
    { to: '/tables', label: 'View Database Tables', icon: Database },
    { to: '/docs', label: 'Setup Guide & Schema', icon: BookOpen },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', color: 'var(--color-primary-dark)', margin: 0 }}>
                Sproutelle
              </h1>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Content Studio
              </span>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Every child grows through play
          </p>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '1rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-body)',
                  backgroundColor: isActive ? 'var(--color-primary-soft)' : 'transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer User Info */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-surface-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrator'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.125rem' }}>
                  <UserCheck size={12} color={isAdmin ? 'var(--color-success)' : 'var(--color-warning)'} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {isAdmin ? 'Sproutelle Admin' : 'User'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="btn btn-secondary btn-sm"
                title="Sign Out"
                style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {isConfigured ? 'Not signed in' : 'Standalone Mode'}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header */}
        <header
          style={{
            height: '64px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              className="badge badge-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <Sparkles size={12} /> Version 1.0.0
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontSize: '0.8125rem',
                color: isConfigured ? 'var(--color-success)' : 'var(--color-warning)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isConfigured ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
              {isConfigured ? 'Supabase Connected' : 'Setup Required'}
            </span>
          </div>
        </header>

        {/* Page Container */}
        <div className="page-container">
          <SetupBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
};
