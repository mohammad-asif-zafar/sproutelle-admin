import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Image,
  FolderTree,
  Gamepad2,
  HelpCircle,
  Layers,
  Upload,
  PlusCircle,
  Database,
  ArrowRight,
  Activity,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DashboardMetrics } from '../types/database';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMediaAssets: 0,
    totalCategories: 0,
    totalGames: 0,
    totalQuestions: 0,
    totalGameVersions: 0,
    recentChanges: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!isSupabaseConfigured) {
        // Sample demo data when database is unconfigured
        setMetrics({
          totalMediaAssets: 12,
          totalCategories: 4,
          totalGames: 8,
          totalQuestions: 36,
          totalGameVersions: 2,
          recentChanges: [
            { id: '1', type: 'media', title: 'Uploaded hero_banner.png', timestamp: '10 mins ago' },
            { id: '2', type: 'question', title: 'Added "Identify the Farm Animals"', timestamp: '1 hour ago' },
            { id: '3', type: 'category', title: 'Created category "Early Mathematics"', timestamp: '2 hours ago' },
          ],
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [
          { count: mediaCount },
          { count: catCount },
          { count: gamesCount },
          { count: questionsCount },
          { count: versionsCount },
          { data: recentQuestions },
        ] = await Promise.all([
          supabase.from('media_assets').select('*', { count: 'exact', head: true }),
          supabase.from('game_categories').select('*', { count: 'exact', head: true }),
          supabase.from('games').select('*', { count: 'exact', head: true }),
          supabase.from('questions').select('*', { count: 'exact', head: true }),
          supabase.from('game_versions').select('*', { count: 'exact', head: true }),
          supabase.from('questions').select('id, question_text, created_at').order('created_at', { ascending: false }).limit(5),
        ]);

        const recent = (recentQuestions || []).map((q) => ({
          id: q.id,
          type: 'question',
          title: `Question: "${q.question_text.substring(0, 35)}${q.question_text.length > 35 ? '...' : ''}"`,
          timestamp: new Date(q.created_at).toLocaleString(),
        }));

        setMetrics({
          totalMediaAssets: mediaCount || 0,
          totalCategories: catCount || 0,
          totalGames: gamesCount || 0,
          totalQuestions: questionsCount || 0,
          totalGameVersions: versionsCount || 0,
          recentChanges: recent,
        });
      } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const metricCards = [
    { title: 'Total Media Assets', count: metrics.totalMediaAssets, icon: Image, color: '#2D6A4F', link: '/upload' },
    { title: 'Game Categories', count: metrics.totalCategories, icon: FolderTree, color: '#1E4D3B', link: '/tables?table=game_categories' },
    { title: 'Registered Games', count: metrics.totalGames, icon: Gamepad2, color: '#2B6CB0', link: '/tables?table=games' },
    { title: 'Learning Questions', count: metrics.totalQuestions, icon: HelpCircle, color: '#D69E2E', link: '/questions/new' },
    { title: 'Game Versions', count: metrics.totalGameVersions, icon: Layers, color: '#805AD5', link: '/tables?table=game_versions' },
  ];

  return (
    <div>
      {/* Header Title */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)' }}>Content Studio Overview</h2>
          <p className="page-subtitle">
            Manage educational media assets, games, and learning questions for Sproutelle.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/upload" className="btn btn-secondary btn-sm">
            <Upload size={16} /> Upload Media
          </Link>
          <Link to="/questions/new" className="btn btn-primary btn-sm">
            <PlusCircle size={16} /> New Question
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="card"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: `${card.color}15`,
                  color: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.125rem' }}>
                  {loading ? '...' : card.count}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Two Column Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Recent Activity Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1.125rem' }}>Recent Studio Activity</h3>
            </div>
            <Link to="/tables" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
              View All
            </Link>
          </div>

          {metrics.recentChanges.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Clock size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>No recent activity records found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {metrics.recentChanges.map((change) => (
                <div
                  key={change.id}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-surface-muted)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {change.title}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
                    {change.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions & System Info Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.125rem' }}>Quick Actions</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <Link
                to="/upload"
                style={{
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Upload size={18} color="var(--color-primary)" />
                  <span>Upload & Catalog Game Assets</span>
                </div>
                <ArrowRight size={16} />
              </Link>

              <Link
                to="/questions/new"
                style={{
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <PlusCircle size={18} color="var(--color-primary)" />
                  <span>Compose New Question & Answers</span>
                </div>
                <ArrowRight size={16} />
              </Link>

              <Link
                to="/tables"
                style={{
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Database size={18} color="var(--color-primary)" />
                  <span>Browse Raw Database Records</span>
                </div>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'var(--color-primary-soft)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <CheckCircle size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary-dark)' }}>
              <strong>Production Ready:</strong> Assets & questions configured here are immediately deliverable to Kotlin Compose Multiplatform mobile clients.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
