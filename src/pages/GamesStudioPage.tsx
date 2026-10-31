import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Plus,
  Search,
  Trash2,
  Edit2,
  Copy,
  Eye,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Game, GameCategory, Question, MediaAsset } from '../types/database';
import { GAME_ENGINE_REGISTRY, type EngineType } from '../types/engine';
import { validateActivityForPublication, type ValidationReport } from '../lib/publisher';
import { Modal } from '../components/Common/Modal';

export const GamesStudioPage: React.FC = () => {
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [gameQuestionCountMap, setGameQuestionCountMap] = useState<Map<string, number>>(new Map());
  const [gameQuestionCountError, setGameQuestionCountError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [pageError, setPageError] = useState<string | null>(
    !isSupabaseConfigured
      ? 'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file to load production games.'
      : null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals & Form State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [deleteConfirmGame, setDeleteConfirmGame] = useState<Game | null>(null);
  const [previewGame, setPreviewGame] = useState<Game | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // Publishing State
  const [publishingToSupabase, setPublishingToSupabase] = useState<boolean>(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);
  const [publishErrorMsg, setPublishErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [gameName, setGameName] = useState<string>('');
  const [gameSlug, setGameSlug] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [gameType, setGameType] = useState<string>('multiple_choice');
  const [description, setDescription] = useState<string>('');
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<number>(1);

  // Engine Config Fields
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [minAge, setMinAge] = useState<number>(3);
  const [maxAge, setMaxAge] = useState<number>(8);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true);
  const [audioNarration, setAudioNarration] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setPageError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file to load production games.');
      setLoading(false);
      return;
    }

    try {
      setPageError(null);

      const [gamesRes, catRes, mediaRes, qRes] = await Promise.all([
        supabase
          .from('games')
          .select('*, category:game_categories(*)')
          .order('sort_order', { ascending: true }),
        supabase.from('game_categories').select('*').order('sort_order'),
        supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
        supabase.from('questions').select('game_id'),
      ]);

      if (gamesRes.error) throw gamesRes.error;
      if (catRes.error) throw catRes.error;
      if (mediaRes.error) throw mediaRes.error;

      if (qRes.error) {
        setGameQuestionCountError(qRes.error.message);
        setGameQuestionCountMap(new Map());
      } else {
        setGameQuestionCountError(null);
        const qMap = new Map<string, number>();
        ((qRes.data as Array<{ game_id: string }>) || []).forEach((q) => {
          if (q.game_id) {
            qMap.set(q.game_id, (qMap.get(q.game_id) || 0) + 1);
          }
        });
        setGameQuestionCountMap(qMap);
      }

      setGamesList((gamesRes.data as Game[]) || []);
      if (catRes.data) setCategories(catRes.data as GameCategory[]);
      if (mediaRes.data) setMediaAssets(mediaRes.data as MediaAsset[]);
    } catch (err) {
      console.error('Failed loading games data:', err);
      const msg = err instanceof Error ? err.message : 'Database query failed.';
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;

    async function init() {
      try {
        const [gamesRes, catRes, mediaRes, qRes] = await Promise.all([
          supabase
            .from('games')
            .select('*, category:game_categories(*)')
            .order('sort_order', { ascending: true }),
          supabase.from('game_categories').select('*').order('sort_order'),
          supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
          supabase.from('questions').select('game_id'),
        ]);

        if (!isMounted) return;

        if (gamesRes.error) throw gamesRes.error;
        if (catRes.error) throw catRes.error;
        if (mediaRes.error) throw mediaRes.error;

        if (qRes.error) {
          setGameQuestionCountError(qRes.error.message);
          setGameQuestionCountMap(new Map());
        } else {
          setGameQuestionCountError(null);
          const qMap = new Map<string, number>();
          ((qRes.data as Array<{ game_id: string }>) || []).forEach((q) => {
            if (q.game_id) {
              qMap.set(q.game_id, (qMap.get(q.game_id) || 0) + 1);
            }
          });
          setGameQuestionCountMap(qMap);
        }

        if (!isMounted) return;
        setGamesList((gamesRes.data as Game[]) || []);
        if (catRes.data) setCategories(catRes.data as GameCategory[]);
        if (mediaRes.data) setMediaAssets(mediaRes.data as MediaAsset[]);
      } catch (err) {
        console.error('Failed loading games data:', err);
        const msg = err instanceof Error ? err.message : 'Database query failed.';
        if (isMounted) setPageError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const openCreateModal = () => {
    setEditingGame(null);
    setGameName('');
    setGameSlug('');
    setCategoryId(categories[0]?.id || '');
    setGameType('multiple_choice');
    setQuestionCount(5);
    setDifficulty('beginner');
    setMinAge(3);
    setMaxAge(8);
    setHintsEnabled(true);
    setAudioNarration(true);
    setDescription('');
    setIsPublished(false);
    setSortOrder(gamesList.length + 1);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGame(game);
    setGameName(game.name);
    setGameSlug(game.slug);
    setCategoryId(game.category_id || '');
    setGameType(game.game_type || 'multiple_choice');

    const cfg = game.config || {};
    setQuestionCount(Number(cfg.question_count || 5));
    setDifficulty((cfg.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner');
    setMinAge(Number(cfg.min_age || 3));
    setMaxAge(Number(cfg.max_age || 8));
    setHintsEnabled(cfg.hints_enabled !== false);
    setAudioNarration(cfg.audio_narration !== false);

    setDescription(game.description || '');
    setIsPublished(game.is_published ?? false);
    setSortOrder(game.sort_order || 1);
    setFormError(null);
    setModalOpen(true);
  };

  const handleNameChange = (name: string) => {
    setGameName(name);
    if (!editingGame || !gameSlug) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setGameSlug(generatedSlug);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!gameName.trim()) {
      setFormError('Game name is required.');
      return;
    }

    if (!gameSlug.trim()) {
      setFormError('URL slug is required.');
      return;
    }

    const configPayload = {
      question_count: questionCount,
      difficulty,
      min_age: minAge,
      max_age: maxAge,
      hints_enabled: hintsEnabled,
      audio_narration: audioNarration,
    };

    const payload = {
      name: gameName.trim(),
      slug: gameSlug.trim(),
      category_id: categoryId || null,
      game_type: gameType,
      config: configPayload,
      description: description.trim() || null,
      is_published: isPublished,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      setFormError('Supabase is not configured. Cannot save game.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingGame) {
        const { error } = await supabase.from('games').update(payload).eq('id', editingGame.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('games').insert(payload);
        if (error) throw error;
      }

      await loadData();
      setModalOpen(false);
    } catch (err) {
      console.error('Failed saving game definition:', err);
      const msg = err instanceof Error ? err.message : 'Database save failed.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (game: Game) => {
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured.');
      return;
    }

    const clonedPayload = {
      name: `${game.name} (Copy)`,
      slug: `${game.slug}-copy-${Date.now().toString().slice(-4)}`,
      category_id: game.category_id,
      game_type: game.game_type,
      config: game.config || {},
      description: game.description,
      is_published: false,
      sort_order: gamesList.length + 1,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('games').insert(clonedPayload);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Failed duplicating game definition:', err);
      alert('Failed to duplicate game definition.');
    }
  };

  const openPreviewAndPublicationValidator = async (game: Game) => {
    setPreviewGame(game);
    setPublishSuccessMsg(null);
    setPublishErrorMsg(null);

    let questions: Question[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('questions')
          .select('*, options:question_options(*)')
          .eq('game_id', game.id)
          .order('sort_order', { ascending: true });
        if (data) questions = data as Question[];
      } catch (err) {
        console.error('Failed loading questions for validation:', err);
      }
    }

    const report = validateActivityForPublication(game, questions, mediaAssets);
    setValidationReport(report);
  };

  const handlePublishToSupabase = async () => {
    if (!previewGame || !validationReport || !validationReport.eligible || !validationReport.snapshot) {
      return;
    }

    try {
      setPublishingToSupabase(true);
      setPublishErrorMsg(null);
      setPublishSuccessMsg(null);

      const { data, error } = await supabase.rpc('publish_game_release', {
        p_game_id: previewGame.id,
        p_version_number: validationReport.snapshot.pack_version,
        p_pack_data: validationReport.snapshot,
      });

      if (error) throw error;
      if (data === false) throw new Error('Publish function returned false.');

      setPublishSuccessMsg(`Successfully published version ${validationReport.snapshot.pack_version} to Supabase!`);
      await loadData();
    } catch (err) {
      console.error('Failed publishing release to Supabase:', err);
      const msg = err instanceof Error ? err.message : 'Database publish failed.';
      setPublishErrorMsg(msg);
    } finally {
      setPublishingToSupabase(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmGame) return;
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured.');
      return;
    }

    try {
      const { error } = await supabase.from('games').delete().eq('id', deleteConfirmGame.id);
      if (error) throw error;
      await loadData();
      setDeleteConfirmGame(null);
    } catch (err) {
      console.error('Failed deleting game:', err);
      alert('Failed deleting game.');
    }
  };

  const filtered = gamesList.filter((game) => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) || game.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTemplate = selectedTemplate === 'all' || game.game_type === selectedTemplate;
    const matchesCategory = selectedCategory === 'all' || game.category_id === selectedCategory;
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'published' && game.is_published) ||
      (selectedStatus === 'draft' && !game.is_published);

    return matchesSearch && matchesTemplate && matchesCategory && matchesStatus;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gamepad2 color="var(--color-primary)" size={28} />
            Learning Games Catalog
          </h2>
          <p className="page-subtitle">
            Configure learning game engines, metadata, session difficulty rules, question counts, and publishing releases.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Learning Game
        </button>
      </div>

      {pageError && (
        <div
          style={{
            backgroundColor: 'var(--color-warning-soft)',
            color: 'var(--color-warning)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          {pageError}
        </div>
      )}

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search games by name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              className="form-select form-select-sm"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              <option value="all">All Engine Templates</option>
              {Object.entries(GAME_ENGINE_REGISTRY).map(([key, def]) => (
                <option key={key} value={key}>{def.name}</option>
              ))}
            </select>

            <select
              className="form-select form-select-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Topics</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Games Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading learning games catalog...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No games found matching criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Order</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Game Name</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Engine Template</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Topic Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Questions (Total)</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((game) => {
                  const engineDef = GAME_ENGINE_REGISTRY[game.game_type as EngineType] || GAME_ENGINE_REGISTRY.guess_game;

                  return (
                    <tr key={game.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>#{game.sort_order}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0F2D4A' }}>{game.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>/{game.slug}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className="badge badge-primary">{engineDef.name}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {game.category?.name || categories.find((c) => c.id === game.category_id)?.name || 'None'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {gameQuestionCountError ? (
                          <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 600 }} title={gameQuestionCountError}>
                            Error
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                            {gameQuestionCountMap.get(game.id) ?? 0}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className={`badge ${game.is_published ? 'badge-success' : 'badge-warning'}`}>
                          {game.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => openPreviewAndPublicationValidator(game)}
                            className="btn btn-secondary btn-sm"
                            title="Preview & Validate Publication"
                          >
                            <Eye size={14} /> Publish
                          </button>
                          <button
                            onClick={() => handleDuplicate(game)}
                            className="btn btn-secondary btn-sm"
                            title="Duplicate Game"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => openEditModal(game)}
                            className="btn btn-secondary btn-sm"
                            title="Edit Game"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmGame(game)}
                            className="btn btn-danger btn-sm"
                            title="Delete Game"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Game Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingGame ? 'Edit Learning Game' : 'Add New Learning Game'}
          maxWidth="700px"
        >
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Game Name */}
              <div className="input-group">
                <label className="input-label">
                  Game Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Alphabet Safari"
                  value={gameName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              {/* URL Slug */}
              <div className="input-group">
                <label className="input-label">
                  URL Slug <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. alphabet-safari"
                  value={gameSlug}
                  onChange={(e) => setGameSlug(e.target.value)}
                  required
                />
              </div>

              {/* Engine Template Selection */}
              <div className="input-group">
                <label className="input-label">Engine Template</label>
                <select
                  className="form-select"
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                >
                  {Object.entries(GAME_ENGINE_REGISTRY).map(([key, def]) => (
                    <option key={key} value={key}>
                      {def.name} — {def.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Category */}
              <div className="input-group">
                <label className="input-label">Topic Category</label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">None</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engine Configuration Section */}
              <div style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: 'var(--color-primary-dark)' }}>
                  Engine Configuration Parameters
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Questions Per Session</label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={20}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Difficulty Level</label>
                    <select
                      className="form-select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Min Age</label>
                    <input
                      type="number"
                      className="form-control"
                      min={3}
                      max={12}
                      value={minAge}
                      onChange={(e) => setMinAge(Number(e.target.value))}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Max Age</label>
                    <input
                      type="number"
                      className="form-control"
                      min={3}
                      max={12}
                      value={maxAge}
                      onChange={(e) => setMaxAge(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hintsEnabled}
                      onChange={(e) => setHintsEnabled(e.target.checked)}
                    /> Enable Hints
                  </label>

                  <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={audioNarration}
                      onChange={(e) => setAudioNarration(e.target.checked)}
                    /> Audio Narration
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="input-group">
                <label className="input-label">Description / Learning Objective</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Brief description for educators and parents..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Sort Order & Publish Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Status</label>
                  <select
                    className="form-select"
                    value={String(isPublished)}
                    onChange={(e) => setIsPublished(e.target.value === 'true')}
                  >
                    <option value="false">Draft (Unpublished)</option>
                    <option value="true">Published (Live in App)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Learning Game'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Preview & Publication Validator Modal */}
      {previewGame && (
        <Modal
          isOpen={Boolean(previewGame)}
          onClose={() => setPreviewGame(null)}
          title={`Publishing Preview & Validator: ${previewGame.name}`}
          maxWidth="700px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Validating activity structure, engine config rules, published questions, correct answer keys, and referenced media assets before generating official release snapshot.
            </div>

            {validationReport && (
              <div
                style={{
                  backgroundColor: validationReport.eligible ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                  border: `1px solid ${validationReport.eligible ? 'var(--color-success)' : 'var(--color-danger)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: validationReport.eligible ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: '0.5rem' }}>
                  {validationReport.eligible ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {validationReport.eligible ? 'Activity Eligible for Publication' : 'Publication Blocked by Validation Errors'}
                </div>

                {validationReport.errors.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '0.25rem' }}>Errors (Must fix before publishing):</div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-danger)' }}>
                      {validationReport.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationReport.warnings.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-warning)', marginBottom: '0.25rem' }}>Warnings (Recommended improvements):</div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-warning)' }}>
                      {validationReport.warnings.map((warn, idx) => (
                        <li key={idx}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {publishSuccessMsg && (
              <div style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>
                {publishSuccessMsg}
              </div>
            )}

            {publishErrorMsg && (
              <div style={{ backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)', padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>
                {publishErrorMsg}
              </div>
            )}

            {validationReport?.snapshot && (
              <div className="input-group">
                <label className="input-label">Generated Release Pack Snapshot (JSON)</label>
                <pre
                  style={{
                    backgroundColor: 'var(--color-surface-muted)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    margin: 0,
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {JSON.stringify(validationReport.snapshot, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setPreviewGame(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
              {validationReport?.eligible && (
                <button
                  type="button"
                  onClick={handlePublishToSupabase}
                  className="btn btn-primary"
                  disabled={publishingToSupabase}
                >
                  <Upload size={16} /> {publishingToSupabase ? 'Publishing Release...' : 'Publish Release to Supabase'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmGame && (
        <Modal
          isOpen={Boolean(deleteConfirmGame)}
          onClose={() => setDeleteConfirmGame(null)}
          title="Confirm Game Deletion"
        >
          <div>
            <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to delete game <strong>{deleteConfirmGame.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirmGame(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete Game
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
