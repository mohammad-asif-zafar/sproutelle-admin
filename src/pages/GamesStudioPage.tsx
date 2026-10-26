import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Plus,
  Search,
  Trash2,
  Edit2,
  HelpCircle,
  Eye,
  Copy,
  CheckCircle,
  AlertTriangle,
  Download,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Game, GameCategory, HomescreenExplorerSubcategory, Question, MediaAsset } from '../types/database';
import { Modal } from '../components/Common/Modal';
import { validateActivityForPublication, type ValidationReport } from '../lib/publisher';

const GAME_TEMPLATES = [
  { label: 'Multiple Choice (Guess Game)', value: 'multiple_choice' },
  { label: 'Image Selection', value: 'image_selection' },
  { label: 'Audio Recognition / Listen & Guess', value: 'audio_recognition' },
  { label: 'Matching Pairs (Matching Fun)', value: 'matching' },
  { label: 'True / False (Garden Quiz)', value: 'true_false' },
];

export const GamesStudioPage: React.FC = () => {
  const navigate = useNavigate();

  const [gamesList, setGamesList] = useState<Game[]>(
    !isSupabaseConfigured
      ? [
          {
            id: 'game-1',
            name: 'Alphabet Safari',
            slug: 'alphabet-safari',
            game_type: 'multiple_choice',
            is_published: true,
            sort_order: 1,
            description: 'Learn letter sounds with friendly jungle animals.',
            config: { question_count: 5, difficulty: 'beginner', min_age: 3, max_age: 6, hints_enabled: true, audio_narration: true },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'game-2',
            name: 'Counting Meadow',
            slug: 'counting-meadow',
            game_type: 'image_selection',
            is_published: false,
            sort_order: 2,
            description: 'Count objects in the sunny meadow.',
            config: { question_count: 4, difficulty: 'beginner', min_age: 3, max_age: 5, hints_enabled: true, audio_narration: true },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      : []
  );
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [subcategories, setSubcategories] = useState<HomescreenExplorerSubcategory[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

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
  const [subcategoryId, setSubcategoryId] = useState<string>('');
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
  const [pageError, setPageError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      setPageError(null);

      const [gamesRes, catRes, subRes, mediaRes] = await Promise.all([
        supabase
          .from('games')
          .select('*, category:game_categories(*), subcategory:homescreen_explorer_subcategories(*)')
          .order('sort_order', { ascending: true }),
        supabase.from('game_categories').select('*').order('sort_order'),
        supabase.from('homescreen_explorer_subcategories').select('*').order('sort_order'),
        supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
      ]);

      if (gamesRes.error) {
        console.warn('Games query warning:', gamesRes.error.message);
        setPageError(`Supabase table warning: ${gamesRes.error.message}`);
      } else if (gamesRes.data) {
        setGamesList(gamesRes.data as Game[]);
      }

      if (catRes.data) setCategories(catRes.data as GameCategory[]);
      if (subRes.data) setSubcategories(subRes.data as HomescreenExplorerSubcategory[]);
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
        const [gamesRes, catRes, subRes, mediaRes] = await Promise.all([
          supabase
            .from('games')
            .select('*, category:game_categories(*), subcategory:homescreen_explorer_subcategories(*)')
            .order('sort_order', { ascending: true }),
          supabase.from('game_categories').select('*').order('sort_order'),
          supabase.from('homescreen_explorer_subcategories').select('*').order('sort_order'),
          supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
        ]);

        if (!isMounted) return;

        if (gamesRes.error) {
          console.warn('Games query warning:', gamesRes.error.message);
          setPageError(`Supabase table warning: ${gamesRes.error.message}`);
        } else if (gamesRes.data) {
          setGamesList(gamesRes.data as Game[]);
        }

        if (catRes.data) setCategories(catRes.data as GameCategory[]);
        if (subRes.data) setSubcategories(subRes.data as HomescreenExplorerSubcategory[]);
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
    setSubcategoryId('');
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
    setSubcategoryId(game.subcategory_id || '');
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
      subcategory_id: subcategoryId || null,
      game_type: gameType,
      config: configPayload,
      description: description.trim() || null,
      is_published: isPublished,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      if (editingGame) {
        setGamesList((prev) =>
          prev.map((g) => (g.id === editingGame.id ? { ...g, ...payload } : g))
        );
      } else {
        const newGame: Game = {
          id: `game-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
        };
        setGamesList((prev) => [...prev, newGame]);
      }
      setModalOpen(false);
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
      console.error('Failed saving game:', err);
      const msg = err instanceof Error ? err.message : 'Database save failed.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (game: Game) => {
    const clonedPayload = {
      name: `${game.name} (Copy)`,
      slug: `${game.slug}-copy-${Date.now().toString().slice(-4)}`,
      category_id: game.category_id,
      subcategory_id: game.subcategory_id,
      game_type: game.game_type,
      config: game.config || {},
      description: game.description,
      is_published: false,
      sort_order: gamesList.length + 1,
    };

    if (!isSupabaseConfigured) {
      const newGame: Game = {
        id: `game-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...clonedPayload,
      };
      setGamesList((prev) => [...prev, newGame]);
      return;
    }

    try {
      const { error } = await supabase.from('games').insert(clonedPayload);
      if (error) throw error;
      await loadData();
    } catch (err) {
      console.error('Failed duplicating game:', err);
      alert('Failed to duplicate game.');
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
    } else {
      questions = [
        {
          id: 'q-demo-1',
          game_id: game.id,
          question_text: 'Sample prompt text',
          question_type: game.game_type || 'multiple_choice',
          is_draft: false,
          sort_order: 1,
          created_at: '',
          updated_at: '',
          options: [
            { id: 'o1', question_id: 'q-demo-1', option_text: 'Option A', is_correct: true, sort_order: 1, created_at: '' },
            { id: 'o2', question_id: 'q-demo-1', option_text: 'Option B', is_correct: false, sort_order: 2, created_at: '' },
          ],
        },
      ];
    }

    const report = validateActivityForPublication(game, questions, mediaAssets);
    setValidationReport(report);
  };

  const handlePublishToSupabase = async () => {
    if (!validationReport?.snapshot || !previewGame) return;
    setPublishErrorMsg(null);
    setPublishSuccessMsg(null);

    const snapshot = validationReport.snapshot;

    if (!isSupabaseConfigured) {
      setPublishSuccessMsg(`[Demo Mode Simulation] Successfully simulated publishing version ${snapshot.pack_version} for "${previewGame.name}" (Supabase is not configured; record not persisted remotely).`);
      setGamesList((prev) =>
        prev.map((g) => (g.id === previewGame.id ? { ...g, is_published: true } : g))
      );
      setPreviewGame((prev) => (prev ? { ...prev, is_published: true } : null));
      return;
    }

    try {
      setPublishingToSupabase(true);

      const { data, error } = await supabase.rpc('publish_game_release', {
        p_game_id: previewGame.id,
        p_version_number: snapshot.pack_version,
        p_pack_data: snapshot,
      });

      if (error) throw error;
      if (data === false) throw new Error('Atomic publication transaction returned false.');

      setPublishSuccessMsg(`Successfully published version ${snapshot.pack_version} atomically to Supabase and archived prior versions!`);
      await loadData();
      setPreviewGame((prev) => (prev ? { ...prev, is_published: true } : null));
    } catch (err) {
      console.error('Failed publishing release to Supabase:', err);
      const msg = err instanceof Error ? err.message : 'Database publish failed. Please ensure migration 20260330000500_atomic_publish_function.sql has been applied.';
      setPublishErrorMsg(msg);
    } finally {
      setPublishingToSupabase(false);
    }
  };

  const handleTogglePublish = async (game: Game) => {
    const newStatus = !game.is_published;
    if (!isSupabaseConfigured) {
      setGamesList((prev) =>
        prev.map((g) => (g.id === game.id ? { ...g, is_published: newStatus } : g))
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('games')
        .update({ is_published: newStatus, updated_at: new Date().toISOString() })
        .eq('id', game.id);
      if (error) throw error;
      setGamesList((prev) =>
        prev.map((g) => (g.id === game.id ? { ...g, is_published: newStatus } : g))
      );
    } catch (err) {
      console.error('Failed toggling publication status:', err);
      alert('Failed to update publication status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmGame) return;
    if (!isSupabaseConfigured) {
      setGamesList((prev) => prev.filter((g) => g.id !== deleteConfirmGame.id));
      setDeleteConfirmGame(null);
      return;
    }

    try {
      const { error } = await supabase.from('games').delete().eq('id', deleteConfirmGame.id);
      if (error) throw error;
      await loadData();
      setDeleteConfirmGame(null);
    } catch (err) {
      console.error('Failed deleting game:', err);
      alert('Failed to delete game.');
    }
  };

  const filteredGames = gamesList.filter((game) => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          game.slug.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedTemplate !== 'all' && game.game_type !== selectedTemplate) return false;
    if (selectedCategory !== 'all' && game.category_id !== selectedCategory) return false;
    if (selectedStatus === 'published' && !game.is_published) return false;
    if (selectedStatus === 'draft' && game.is_published) return false;

    return true;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gamepad2 color="var(--color-primary)" size={28} />
            Games Management
          </h2>
          <p className="page-subtitle">
            Create reusable learning games, configure question templates, and assign activities to explorer subcategories.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Game
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

      {/* Filters Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {/* Search */}
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

          {/* Template Filter */}
          <select
            className="form-select"
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="all">All Templates</option>
            {GAME_TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Games Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading games catalog...
          </div>
        ) : filteredGames.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Gamepad2 size={36} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
            <p>No games found matching your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Game Title & Slug</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Template / Type</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Learning Topic</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Subcategory</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((game) => {
                  const templateLabel = GAME_TEMPLATES.find((t) => t.value === game.game_type)?.label || game.game_type;
                  const categoryName = game.category?.name || categories.find((c) => c.id === game.category_id)?.name || 'General';
                  const subcategoryName = game.subcategory?.name || subcategories.find((s) => s.id === game.subcategory_id)?.name || 'None';

                  return (
                    <tr key={game.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{game.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          /{game.slug}
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className="badge badge-primary">{templateLabel}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{categoryName}</td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-muted)' }}>{subcategoryName}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(game)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          title="Click to toggle publication status"
                        >
                          <span className={`badge ${game.is_published ? 'badge-success' : 'badge-warning'}`}>
                            {game.is_published ? 'Published' : 'Draft'}
                          </span>
                        </button>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => navigate(`/games/${game.id}/questions`)}
                            className="btn btn-primary btn-sm"
                            title="Manage Questions"
                          >
                            <HelpCircle size={14} /> Questions
                          </button>
                          <button
                            onClick={() => openPreviewAndPublicationValidator(game)}
                            className="btn btn-secondary btn-sm"
                            title="Preview Game & Publication Validator"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => openEditModal(game)}
                            className="btn btn-secondary btn-sm"
                            title="Edit Game"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDuplicate(game)}
                            className="btn btn-secondary btn-sm"
                            title="Duplicate Game"
                          >
                            <Copy size={14} />
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
          title={editingGame ? 'Edit Learning Game' : 'Create New Learning Game'}
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
                  placeholder="alphabet-safari"
                  value={gameSlug}
                  onChange={(e) => setGameSlug(e.target.value)}
                  required
                />
              </div>

              {/* Game Template */}
              <div className="input-group">
                <label className="input-label">Game Template / Type</label>
                <select
                  className="form-select"
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                >
                  {GAME_TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Engine Configuration Options */}
              <div style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Engine Configuration</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Questions per Session</label>
                    <input
                      type="number"
                      className="form-control"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      min={1}
                      max={20}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Difficulty Level</label>
                    <select
                      className="form-select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    >
                      <option value="beginner">Beginner (Ages 3-5)</option>
                      <option value="intermediate">Intermediate (Ages 5-7)</option>
                      <option value="advanced">Advanced (Ages 6-8)</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Min Target Age</label>
                    <input
                      type="number"
                      className="form-control"
                      value={minAge}
                      onChange={(e) => setMinAge(Number(e.target.value))}
                      min={3}
                      max={12}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Max Target Age</label>
                    <input
                      type="number"
                      className="form-control"
                      value={maxAge}
                      onChange={(e) => setMaxAge(Number(e.target.value))}
                      min={3}
                      max={12}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Hints Enabled</label>
                    <select
                      className="form-select"
                      value={String(hintsEnabled)}
                      onChange={(e) => setHintsEnabled(e.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Audio Narration</label>
                    <select
                      className="form-select"
                      value={String(audioNarration)}
                      onChange={(e) => setAudioNarration(e.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Learning Category */}
              <div className="input-group">
                <label className="input-label">Learning Topic / Category</label>
                <select
                  className="form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Home Explorer Subcategory */}
              <div className="input-group">
                <label className="input-label">Home Explorer Subcategory</label>
                <select
                  className="form-select"
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                >
                  <option value="">None</option>
                  {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea
                  className="form-textarea"
                  placeholder="Optional game overview or summary..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Sort Order & Status */}
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
                  <label className="input-label">Publication Status</label>
                  <select
                    className="form-select"
                    value={String(isPublished)}
                    onChange={(e) => setIsPublished(e.target.value === 'true')}
                  >
                    <option value="false">Draft (Hidden from apps)</option>
                    <option value="true">Published (Live in apps)</option>
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
                  {submitting ? 'Saving...' : 'Save Game'}
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
          title={`Game Activity Preview & Publication Status: ${previewGame.name}`}
          maxWidth="720px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge badge-primary">
                {GAME_TEMPLATES.find((t) => t.value === previewGame.game_type)?.label || previewGame.game_type}
              </span>
              <span className={`badge ${previewGame.is_published ? 'badge-success' : 'badge-warning'}`}>
                {previewGame.is_published ? 'Published' : 'Draft'}
              </span>
            </div>

            {/* Publication Validation Summary */}
            {validationReport && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: validationReport.eligible ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                  border: `1px solid ${validationReport.eligible ? 'var(--color-success)' : 'var(--color-warning)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {validationReport.eligible ? (
                    <>
                      <CheckCircle color="var(--color-success)" size={20} />
                      <span style={{ color: 'var(--color-success)' }}>Eligible for Mobile Release Publishing</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle color="var(--color-warning)" size={20} />
                      <span style={{ color: 'var(--color-warning)' }}>Publication Requirements Not Met</span>
                    </>
                  )}
                </div>

                {validationReport.errors.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0 1.25rem', fontSize: '0.8125rem', color: 'var(--color-danger)' }}>
                    {validationReport.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}

                {validationReport.warnings.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0 1.25rem', fontSize: '0.8125rem', color: 'var(--color-warning)' }}>
                    {validationReport.warnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Offline Release Pack Snapshot Download & Supabase Publishing */}
            {validationReport?.snapshot && (
              <div style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Offline Content Release Pack</h4>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(validationReport.snapshot, null, 2));
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute('href', dataStr);
                        downloadAnchor.setAttribute('download', `${previewGame.slug}-release-${validationReport.snapshot?.pack_version}.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <Download size={14} /> Export Pack JSON
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishToSupabase}
                      className="btn btn-primary btn-sm"
                      disabled={publishingToSupabase || !validationReport.eligible}
                    >
                      {publishingToSupabase ? 'Publishing...' : 'Publish to Supabase'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Version: {validationReport.snapshot.pack_version} | Questions: {validationReport.snapshot.questions.length} | Assets: {validationReport.snapshot.referenced_assets.length}
                </div>

                {publishSuccessMsg && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {publishSuccessMsg}
                  </div>
                )}

                {publishErrorMsg && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600 }}>
                    {publishErrorMsg}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  const gId = previewGame.id;
                  setPreviewGame(null);
                  navigate(`/games/${gId}/questions`);
                }}
                className="btn btn-primary btn-sm"
              >
                <HelpCircle size={14} /> Open Question Manager
              </button>
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
              Are you sure you want to delete game <strong>{deleteConfirmGame.name}</strong>? All associated questions and options will be permanently removed.
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
