import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { signIn, isConfigured, user, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  React.useEffect(() => {
    if (user && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, navigate, from]);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setAuthError('Please enter both your email address and password.');
      return;
    }

    try {
      setAuthError(null);
      setIsSigningIn(true);
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      console.error('Email/password sign in error:', err);
      const message = err instanceof Error ? err.message : 'Invalid credentials or unauthorized account.';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleContinueDemo = () => {
    navigate('/');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '2.5rem 2rem',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <Sparkles size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--color-primary-dark)', marginBottom: '0.25rem' }}>
            Sproutelle
          </h1>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Content Studio
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', marginTop: '0.5rem', fontStyle: 'italic' }}>
            Every child grows through play
          </p>
        </div>

        {authError && (
          <div
            style={{
              backgroundColor: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              padding: '0.875rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{authError}</span>
          </div>
        )}

        {/* Email / Password Form */}
        <form onSubmit={handleEmailPasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text)' }}>
              Administrator Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sproutelle.com"
                className="form-control"
                style={{ paddingLeft: '2.75rem', width: '100%' }}
                disabled={isSigningIn || loading}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="form-control"
                style={{ paddingLeft: '2.75rem', width: '100%' }}
                disabled={isSigningIn || loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSigningIn || loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isSigningIn ? 'Authenticating...' : 'Sign In to Content Studio'}
          </button>

          {!isConfigured && (
            <button
              type="button"
              onClick={handleContinueDemo}
              className="btn btn-secondary btn-lg"
              style={{ width: '100%' }}
            >
              <span>Explore Demo Studio</span>
              <ArrowRight size={18} />
            </button>
          )}
        </form>

        {/* Setup info callout */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--color-border-subtle)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          <h4 style={{ fontSize: '0.875rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            Security & Authorization Policy
          </h4>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <li>Authentication uses secure Supabase Email & Password.</li>
            <li>Only registered accounts with verified admin status in <code>admin_users</code> can access the dashboard.</li>
            <li>Unauthenticated or unauthorized sign-in attempts are automatically rejected.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
