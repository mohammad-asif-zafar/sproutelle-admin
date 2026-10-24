import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Music,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { GameCategory, Game, GameLevel, MediaAsset } from '../types/database';
import { MediaSelectorModal } from '../components/Media/MediaSelectorModal';

interface FormOption {
  id: string;
  option_text: string;
  is_correct: boolean;
  media_asset?: MediaAsset | null;
}

export const AddQuestionPage: React.FC = () => {
  const navigate = useNavigate();

  // Data dropdown options from database
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [levels, setLevels] = useState<GameLevel[]>([]);

  // Form State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');

  const [questionText, setQuestionText] = useState<string>('');
  const [questionType, setQuestionType] = useState<string>('multiple_choice');
  const [instructions, setInstructions] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isDraft, setIsDraft] = useState<boolean>(true);

  // Attached media
  const [imageAsset, setImageAsset] = useState<MediaAsset | null>(null);
  const [audioAsset, setAudioAsset] = useState<MediaAsset | null>(null);

  // Answer Options
  const [options, setOptions] = useState<FormOption[]>([
    { id: '1', option_text: 'Option A', is_correct: true },
    { id: '2', option_text: 'Option B', is_correct: false },
  ]);

  // Modals & submission state
  const [mediaModalOpen, setMediaModalOpen] = useState<boolean>(false);
  const [mediaModalTarget, setMediaModalTarget] = useState<'question_image' | 'question_audio' | { optionId: string }>('question_image');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadCategoriesAndGames = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCategories([
        { id: 'cat-1', name: 'Early Literacy', slug: 'early-literacy', sort_order: 1, created_at: '', updated_at: '' },
        { id: 'cat-2', name: 'Mathematics', slug: 'mathematics', sort_order: 2, created_at: '', updated_at: '' },
      ]);
      setGames([
        { id: 'game-1', category_id: 'cat-1', name: 'Alphabet Animals', slug: 'alphabet-animals', game_type: 'multiple_choice', is_published: true, sort_order: 1, created_at: '', updated_at: '' },
      ]);
      setLevels([
        { id: 'level-1', game_id: 'game-1', level_number: 1, title: 'Level 1: Letter Sounds', pass_score: 100, sort_order: 1, created_at: '' },
      ]);
      return;
    }

    try {
      const [{ data: catData }, { data: gameData }, { data: levelData }] = await Promise.all([
        supabase.from('game_categories').select('*').order('sort_order'),
        supabase.from('games').select('*').order('sort_order'),
        supabase.from('game_levels').select('*').order('sort_order'),
      ]);

      if (catData) setCategories(catData);
      if (gameData) setGames(gameData);
      if (levelData) setLevels(levelData);
    } catch (err) {
      console.error('Failed loading question form options:', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategoriesAndGames();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCategoriesAndGames]);

  // Filtered games based on selected category
  const filteredGames = games.filter((g) => !selectedCategoryId || g.category_id === selectedCategoryId);
  const filteredLevels = levels.filter((l) => !selectedGameId || l.game_id === selectedGameId);

  // Option actions
  const handleAddOption = () => {
    setOptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), option_text: `Option ${prev.length + 1}`, is_correct: false },
    ]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) {
      alert('Questions must have at least 2 answer options.');
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const handleOptionTextChange = (id: string, text: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, option_text: text } : o)));
  };

  const handleSetCorrect = (id: string) => {
    setOptions((prev) => prev.map((o) => ({ ...o, is_correct: o.id === id })));
  };

  // Media selector trigger
  const openMediaModal = (target: 'question_image' | 'question_audio' | { optionId: string }) => {
    setMediaModalTarget(target);
    setMediaModalOpen(true);
  };

  const handleMediaSelect = (asset: MediaAsset) => {
    if (mediaModalTarget === 'question_image') {
      setImageAsset(asset);
    } else if (mediaModalTarget === 'question_audio') {
      setAudioAsset(asset);
    } else if (typeof mediaModalTarget === 'object' && mediaModalTarget.optionId) {
      setOptions((prev) =>
        prev.map((o) => (o.id === mediaModalTarget.optionId ? { ...o, media_asset: asset } : o))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!questionText.trim()) {
      setErrorMsg('Question text is required.');
      return;
    }

    if (options.length < 2) {
      setErrorMsg('At least two answer options are required.');
      return;
    }

    const hasCorrect = options.some((o) => o.is_correct);
    if (!hasCorrect) {
      setErrorMsg('Please select at least one correct answer option.');
      return;
    }

    try {
      setSubmitting(true);

      if (!isSupabaseConfigured) {
        // Demo mode simulation
        await new Promise((res) => setTimeout(res, 800));
        setSuccessMsg('Question saved successfully in demo studio!');
        setTimeout(() => navigate('/tables?table=questions'), 1500);
        return;
      }

      // 1. Insert question into database
      const newQuestionPayload = {
        game_id: selectedGameId || (games[0]?.id ?? null),
        level_id: selectedLevelId || (levels[0]?.id ?? null),
        question_text: questionText,
        question_type: questionType,
        instructions: instructions || null,
        sort_order: sortOrder,
        is_draft: isDraft,
        image_asset_id: imageAsset?.id || null,
        audio_asset_id: audioAsset?.id || null,
      };

      const { data: insertedQuestion, error: qError } = await supabase
        .from('questions')
        .insert(newQuestionPayload)
        .select()
        .single();

      if (qError) throw qError;

      // 2. Insert answer options into database
      const optionRows = options.map((opt, idx) => ({
        question_id: insertedQuestion.id,
        option_text: opt.option_text,
        is_correct: opt.is_correct,
        sort_order: idx + 1,
        media_asset_id: opt.media_asset?.id || null,
      }));

      const { error: optError } = await supabase
        .from('question_options')
        .insert(optionRows);

      if (optError) throw optError;

      setSuccessMsg('Question and answer options saved successfully!');
      setTimeout(() => navigate('/tables?table=questions'), 1200);
    } catch (err: unknown) {
      console.error('Failed creating question:', err);
      const msg = err instanceof Error ? err.message : 'Database operation failed.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)' }}>Question Composer Studio</h2>
          <p className="page-subtitle">
            Create educational questions, configure multiple answer choices, and link reusable media assets.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            backgroundColor: 'var(--color-danger-soft)',
            color: 'var(--color-danger)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            backgroundColor: 'var(--color-success-soft)',
            color: 'var(--color-success)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
          {/* Main Question Form Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Question Details Card */}
            <div className="card">
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem', color: 'var(--color-primary-dark)' }}>
                Question Content & Type
              </h3>

              <div className="input-group">
                <label className="input-label">Question Text *</label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. Which animal makes the 'Moo' sound?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Question Type</label>
                  <select
                    className="form-select"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="image_selection">Image Selection</option>
                    <option value="matching">Matching Pair</option>
                    <option value="audio_recognition">Audio Recognition</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Display Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Child Instructions (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Listen carefully and tap the right card!"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </div>

            {/* Answer Options Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: '1.125rem' }}>Answer Options</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Add multiple choices and select the correct answer.
                  </p>
                </div>
                <button type="button" onClick={handleAddOption} className="btn btn-secondary btn-sm">
                  <Plus size={16} /> Add Option
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {options.map((option, index) => (
                  <div
                    key={option.id}
                    style={{
                      padding: '1rem',
                      border: `1px solid ${option.is_correct ? 'var(--color-success)' : 'var(--color-border)'}`,
                      backgroundColor: option.is_correct ? 'var(--color-success-soft)' : 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <input
                        type="radio"
                        name="correct_option"
                        checked={option.is_correct}
                        onChange={() => handleSetCorrect(option.id)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-success)', cursor: 'pointer' }}
                        title="Mark as correct answer"
                      />

                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Option ${index + 1} text`}
                        value={option.option_text}
                        onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                        style={{ flex: 1 }}
                      />

                      <button
                        type="button"
                        onClick={() => openMediaModal({ optionId: option.id })}
                        className="btn btn-secondary btn-sm"
                        title="Attach option image/audio"
                      >
                        <ImageIcon size={16} />
                        {option.media_asset ? 'Linked Media' : 'Link Media'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveOption(option.id)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.375rem' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {option.media_asset && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, paddingLeft: '2rem' }}>
                        Linked Asset: {option.media_asset.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Category, Game, Level & Media Link */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Context Hierarchy */}
            <div className="card">
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem', color: 'var(--color-primary-dark)' }}>
                Hierarchy & Publishing
              </h3>

              <div className="input-group">
                <label className="input-label">Game Category</label>
                <select
                  className="form-select"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    setSelectedGameId('');
                  }}
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Target Game</label>
                <select
                  className="form-select"
                  value={selectedGameId}
                  onChange={(e) => setSelectedGameId(e.target.value)}
                >
                  <option value="">Select Game...</option>
                  {filteredGames.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Game Level</label>
                <select
                  className="form-select"
                  value={selectedLevelId}
                  onChange={(e) => setSelectedLevelId(e.target.value)}
                >
                  <option value="">Select Level...</option>
                  {filteredLevels.map((l) => (
                    <option key={l.id} value={l.id}>{l.title || `Level ${l.level_number}`}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ marginTop: '0.5rem' }}>
                <label className="input-label">Publishing Status</label>
                <select
                  className="form-select"
                  value={isDraft ? 'draft' : 'published'}
                  onChange={(e) => setIsDraft(e.target.value === 'draft')}
                >
                  <option value="draft">Draft (Admin Only)</option>
                  <option value="published">Published to App API</option>
                </select>
              </div>
            </div>

            {/* Question Attachments */}
            <div className="card">
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem', color: 'var(--color-primary-dark)' }}>
                Question Media Attachments
              </h3>

              {/* Image Asset Attachment */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.375rem' }}>Question Image</label>
                {imageAsset ? (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{imageAsset.name}</span>
                    <button type="button" onClick={() => setImageAsset(null)} className="btn btn-secondary btn-sm">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => openMediaModal('question_image')} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                    <ImageIcon size={16} /> Attach Image Asset
                  </button>
                )}
              </div>

              {/* Audio Asset Attachment */}
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.375rem' }}>Question Audio Prompt</label>
                {audioAsset ? (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{audioAsset.name}</span>
                    <button type="button" onClick={() => setAudioAsset(null)} className="btn btn-secondary btn-sm">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => openMediaModal('question_audio')} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                    <Music size={16} /> Attach Audio Asset
                  </button>
                )}
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', gap: '0.5rem' }}
            >
              <Save size={20} />
              {submitting ? 'Saving Question...' : 'Save Question'}
            </button>
          </div>
        </div>
      </form>

      {/* Media Selector Modal */}
      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={handleMediaSelect}
        mediaTypeFilter={mediaModalTarget === 'question_image' ? 'image' : mediaModalTarget === 'question_audio' ? 'audio' : 'all'}
      />
    </div>
  );
};
