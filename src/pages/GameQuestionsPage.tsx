import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Game, Question, MediaAsset } from '../types/database';
import { Modal } from '../components/Common/Modal';
import { MediaSelectorModal } from '../components/Media/MediaSelectorModal';
import { MediaPreviewTile } from '../components/Media/MediaPreviewTile';

interface FormOption {
  id: string;
  option_text: string;
  is_correct: boolean;
  media_asset?: MediaAsset | null;
  media_asset_id?: string | null;
}

export const GameQuestionsPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(
    !isSupabaseConfigured
      ? {
          id: gameId || 'game-1',
          name: 'Alphabet Safari',
          slug: 'alphabet-safari',
          game_type: 'multiple_choice',
          is_published: true,
          sort_order: 1,
          created_at: '',
          updated_at: '',
        }
      : null
  );
  const [questions, setQuestions] = useState<Question[]>(
    !isSupabaseConfigured
      ? [
          {
            id: 'q-1',
            game_id: gameId || 'game-1',
            question_text: 'What sound does the letter A make?',
            question_type: 'multiple_choice',
            is_draft: false,
            sort_order: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            options: [
              { id: 'o-1', question_id: 'q-1', option_text: 'Ah as in Apple', is_correct: true, sort_order: 1, created_at: '' },
              { id: 'o-2', question_id: 'q-1', option_text: 'Buh as in Ball', is_correct: false, sort_order: 2, created_at: '' },
            ],
          },
        ]
      : []
  );
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  // Modals & Form State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteConfirmQuestion, setDeleteConfirmQuestion] = useState<Question | null>(null);

  // Form Fields
  const [questionText, setQuestionText] = useState<string>('');
  const [questionType, setQuestionType] = useState<string>('multiple_choice');
  const [instructions, setInstructions] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isDraft, setIsDraft] = useState<boolean>(true);
  const [imageAsset, setImageAsset] = useState<MediaAsset | null>(null);
  const [audioAsset, setAudioAsset] = useState<MediaAsset | null>(null);

  // Answer Options
  const [options, setOptions] = useState<FormOption[]>([
    { id: '1', option_text: 'Option A', is_correct: true },
    { id: '2', option_text: 'Option B', is_correct: false },
  ]);

  // Media Selector Modal State
  const [mediaModalOpen, setMediaModalOpen] = useState<boolean>(false);
  const [mediaTarget, setMediaTarget] = useState<'question_image' | 'question_audio' | { optionId: string }>('question_image');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadGameAndQuestions = useCallback(async () => {
    if (!gameId || !isSupabaseConfigured) return;

    try {
      const [gameRes, qRes] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase
          .from('questions')
          .select('*, options:question_options(*, media_asset:media_assets(*)), image_asset:media_assets!questions_image_asset_id_fkey(*), audio_asset:media_assets!questions_audio_asset_id_fkey(*)')
          .eq('game_id', gameId)
          .order('sort_order', { ascending: true }),
      ]);

      if (gameRes.data) {
        setGame(gameRes.data as Game);
        setQuestionType(gameRes.data.game_type || 'multiple_choice');
      }

      if (qRes.data) {
        setQuestions(qRes.data as Question[]);
      }
    } catch (err) {
      console.error('Failed loading game questions:', err);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) return;

    let isMounted = true;

    async function init() {
      try {
        const [gameRes, qRes] = await Promise.all([
          supabase.from('games').select('*').eq('id', gameId).single(),
          supabase
            .from('questions')
            .select('*, options:question_options(*, media_asset:media_assets(*)), image_asset:media_assets!questions_image_asset_id_fkey(*), audio_asset:media_assets!questions_audio_asset_id_fkey(*)')
            .eq('game_id', gameId)
            .order('sort_order', { ascending: true }),
        ]);

        if (!isMounted) return;

        if (gameRes.data) {
          setGame(gameRes.data as Game);
          setQuestionType(gameRes.data.game_type || 'multiple_choice');
        }

        if (qRes.data) {
          setQuestions(qRes.data as Question[]);
        }
      } catch (err) {
        console.error('Failed loading game questions:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [gameId]);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setQuestionText('');
    setQuestionType(game?.game_type || 'multiple_choice');
    setInstructions('');
    setSortOrder(questions.length + 1);
    setIsDraft(true);
    setImageAsset(null);
    setAudioAsset(null);

    if (game?.game_type === 'true_false') {
      setOptions([
        { id: '1', option_text: 'True', is_correct: true },
        { id: '2', option_text: 'False', is_correct: false },
      ]);
    } else {
      setOptions([
        { id: '1', option_text: 'Option A', is_correct: true },
        { id: '2', option_text: 'Option B', is_correct: false },
      ]);
    }
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setQuestionText(q.question_text);
    setQuestionType(q.question_type || game?.game_type || 'multiple_choice');
    setInstructions(q.instructions || '');
    setSortOrder(q.sort_order || 1);
    setIsDraft(q.is_draft ?? true);
    setImageAsset(q.image_asset || null);
    setAudioAsset(q.audio_asset || null);

    if (q.options && q.options.length > 0) {
      setOptions(
        q.options.map((o) => ({
          id: o.id,
          option_text: o.option_text || '',
          is_correct: o.is_correct,
          media_asset: o.media_asset || null,
          media_asset_id: o.media_asset_id || null,
        }))
      );
    } else {
      setOptions([
        { id: '1', option_text: 'Option A', is_correct: true },
        { id: '2', option_text: 'Option B', is_correct: false },
      ]);
    }
    setFormError(null);
    setModalOpen(true);
  };

  const handleAddOption = () => {
    if (questionType === 'true_false') {
      setFormError('True / False questions must have exactly 2 options.');
      return;
    }
    setOptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), option_text: `Option ${String.fromCharCode(65 + prev.length)}`, is_correct: false },
    ]);
  };

  const handleRemoveOption = (id: string) => {
    if (questionType === 'true_false') {
      setFormError('True / False questions must have exactly 2 options.');
      return;
    }
    if (options.length <= 2) {
      setFormError('Questions require at least 2 answer options.');
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const handleSetCorrect = (id: string) => {
    setOptions((prev) =>
      prev.map((o) => ({
        ...o,
        is_correct: o.id === id,
      }))
    );
  };

  const validateTemplateRules = (): string | null => {
    if (!questionText.trim()) return 'Question prompt text is required.';
    if (options.length < 2) return 'At least 2 options are required.';

    const correctCount = options.filter((o) => o.is_correct).length;
    if (correctCount === 0) return 'Please select at least one correct answer option.';

    if (questionType === 'true_false') {
      if (options.length !== 2) return 'True / False template requires exactly 2 options (True and False).';
      if (correctCount !== 1) return 'True / False template must have exactly one correct option.';
    }

    if (questionType === 'image_selection') {
      const missingImg = options.some(
        (o) => !o.media_asset_id || !o.media_asset || (o.media_asset.mime_type && !o.media_asset.mime_type.startsWith('image/'))
      );
      if (missingImg) return 'Image Selection template requires a valid image asset for every answer option.';
    }

    return null;
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationErr = validateTemplateRules();
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    if (!gameId) return;

    if (!isSupabaseConfigured) {
      const newQ: Question = {
        id: editingQuestion ? editingQuestion.id : `q-${Date.now()}`,
        game_id: gameId,
        question_text: questionText.trim(),
        question_type: questionType,
        instructions: instructions.trim() || null,
        sort_order: sortOrder,
        is_draft: isDraft,
        image_asset_id: imageAsset?.id || null,
        audio_asset_id: audioAsset?.id || null,
        created_at: editingQuestion?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        image_asset: imageAsset,
        audio_asset: audioAsset,
        options: options.map((o, idx) => ({
          id: o.id,
          question_id: editingQuestion ? editingQuestion.id : `q-${Date.now()}`,
          option_text: o.option_text,
          is_correct: o.is_correct,
          sort_order: idx + 1,
          media_asset_id: o.media_asset?.id || null,
          media_asset: o.media_asset,
          created_at: '',
        })),
      };

      setQuestions((prev) =>
        editingQuestion
          ? prev.map((q) => (q.id === editingQuestion.id ? newQ : q))
          : [...prev, newQ]
      );
      setModalOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      const questionPayload = {
        game_id: gameId,
        question_text: questionText.trim(),
        question_type: questionType,
        instructions: instructions.trim() || null,
        sort_order: sortOrder,
        is_draft: isDraft,
        image_asset_id: imageAsset?.id || null,
        audio_asset_id: audioAsset?.id || null,
        updated_at: new Date().toISOString(),
      };

      let qId = editingQuestion?.id;

      if (editingQuestion) {
        const { error } = await supabase.from('questions').update(questionPayload).eq('id', qId);
        if (error) throw error;
        await supabase.from('question_options').delete().eq('question_id', qId);
      } else {
        const { data: insertedQ, error } = await supabase.from('questions').insert(questionPayload).select().single();
        if (error) throw error;
        qId = insertedQ.id;
      }

      const optionRows = options.map((o, idx) => ({
        question_id: qId,
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: idx + 1,
        media_asset_id: o.media_asset?.id || null,
      }));

      const { error: optError } = await supabase.from('question_options').insert(optionRows);
      if (optError) throw optError;

      await loadGameAndQuestions();
      setModalOpen(false);
    } catch (err) {
      console.error('Failed saving question:', err);
      const msg = err instanceof Error ? err.message : 'Database save failed.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmQuestion) return;
    if (!isSupabaseConfigured) {
      setQuestions((prev) => prev.filter((q) => q.id !== deleteConfirmQuestion.id));
      setDeleteConfirmQuestion(null);
      return;
    }

    try {
      const { error } = await supabase.from('questions').delete().eq('id', deleteConfirmQuestion.id);
      if (error) throw error;
      await loadGameAndQuestions();
      setDeleteConfirmQuestion(null);
    } catch (err) {
      console.error('Failed deleting question:', err);
      alert('Failed to delete question.');
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <button
            onClick={() => navigate('/games')}
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <ArrowLeft size={16} /> Back to Games
          </button>
          <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle color="var(--color-primary)" size={28} />
            Manage Questions: {game?.name || 'Loading game...'}
          </h2>
          <p className="page-subtitle">
            Create and configure learning questions, template rules, correct answer keys, and option media assets.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Question
        </button>
      </div>

      {/* Questions List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading game questions...
          </div>
        ) : questions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <HelpCircle size={36} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
            <p>No questions configured for this game yet. Click &ldquo;Add Question&rdquo; above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
            {questions.map((q, index) => (
              <div
                key={q.id}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary-soft)',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                      }}
                    >
                      {index + 1}
                    </span>
                    <h4 style={{ fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                      {q.question_text}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${!q.is_draft ? 'badge-success' : 'badge-warning'}`}>
                      {!q.is_draft ? 'Published' : 'Draft'}
                    </span>
                    <button onClick={() => openEditModal(q)} className="btn btn-secondary btn-sm" title="Edit Question">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleteConfirmQuestion(q)} className="btn btn-danger btn-sm" title="Delete Question">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Options preview */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingLeft: '2.25rem' }}>
                  {(q.options || []).map((opt) => (
                    <div
                      key={opt.id}
                      style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: opt.is_correct ? 'var(--color-success-soft)' : 'var(--color-surface-muted)',
                        border: `1px solid ${opt.is_correct ? 'var(--color-success)' : 'var(--color-border)'}`,
                        fontSize: '0.8125rem',
                        fontWeight: opt.is_correct ? 700 : 500,
                        color: opt.is_correct ? 'var(--color-success)' : 'var(--color-text-body)',
                      }}
                    >
                      {opt.option_text || '(Media Option)'} {opt.is_correct && '✓'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingQuestion ? 'Edit Question' : 'Add New Question'}
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

          <form onSubmit={handleSaveQuestion}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Question Text */}
              <div className="input-group">
                <label className="input-label">
                  Question Prompt / Text <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. What sound does the letter A make?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  required
                />
              </div>

              {/* Question Type */}
              <div className="input-group">
                <label className="input-label">Question Template Mode</label>
                <select
                  className="form-select"
                  value={questionType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setQuestionType(t);
                    if (t === 'true_false') {
                      setOptions([
                        { id: '1', option_text: 'True', is_correct: true },
                        { id: '2', option_text: 'False', is_correct: false },
                      ]);
                    }
                  }}
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="image_selection">Image Selection</option>
                  <option value="audio_recognition">Audio Recognition / Listen & Guess</option>
                  <option value="matching">Matching Pairs</option>
                  <option value="true_false">True / False</option>
                </select>
              </div>

              {/* Question Image Asset */}
              <div className="input-group">
                <label className="input-label">Optional Question Image / Prompt Asset</label>
                {imageAsset ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '36px', height: '36px' }}>
                        <MediaPreviewTile asset={imageAsset} height="36px" />
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{imageAsset.name}</span>
                    </div>
                    <button type="button" onClick={() => setImageAsset(null)} className="btn btn-secondary btn-sm">Remove</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMediaTarget('question_image');
                      setMediaModalOpen(true);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <ImageIcon size={16} /> Attach Image Asset
                  </button>
                )}
              </div>

              {/* Answer Options Manager */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <label className="input-label" style={{ margin: 0 }}>
                    Answer Options (Select Correct Answer) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  {questionType !== 'true_false' && (
                    <button type="button" onClick={handleAddOption} className="btn btn-secondary btn-sm">
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {options.map((opt, idx) => (
                    <div
                      key={opt.id}
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: opt.is_correct ? 'var(--color-success-soft)' : 'var(--color-surface-muted)',
                        border: `1px solid ${opt.is_correct ? 'var(--color-success)' : 'var(--color-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <input
                        type="radio"
                        name="correct_option"
                        checked={opt.is_correct}
                        onChange={() => handleSetCorrect(opt.id)}
                        title="Mark as correct answer"
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />

                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, minWidth: '20px' }}>
                        {idx + 1}.
                      </span>

                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Option ${idx + 1} text...`}
                        value={opt.option_text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOptions((prev) =>
                            prev.map((o) => (o.id === opt.id ? { ...o, option_text: val } : o))
                          );
                        }}
                        style={{ flex: 1 }}
                        disabled={questionType === 'true_false'}
                      />

                      {/* Option Image Media Asset */}
                      {questionType === 'image_selection' && (
                        <div>
                          {opt.media_asset ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <div style={{ width: '32px', height: '32px' }}>
                                <MediaPreviewTile asset={opt.media_asset} height="32px" />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setOptions((prev) =>
                                    prev.map((o) => (o.id === opt.id ? { ...o, media_asset: null, media_asset_id: null } : o))
                                  );
                                }}
                                className="btn btn-secondary btn-sm"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setMediaTarget({ optionId: opt.id });
                                setMediaModalOpen(true);
                              }}
                              className="btn btn-secondary btn-sm"
                            >
                              <ImageIcon size={14} /> Add Image
                            </button>
                          )}
                        </div>
                      )}

                      {questionType !== 'true_false' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt.id)}
                          className="btn btn-danger btn-sm"
                          title="Remove Option"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sort Order & Publication Status */}
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
                    value={String(isDraft)}
                    onChange={(e) => setIsDraft(e.target.value === 'true')}
                  >
                    <option value="true">Draft (Incomplete)</option>
                    <option value="false">Published (Ready for App)</option>
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
                  {submitting ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Media Selector Modal */}
      {mediaModalOpen && (
        <MediaSelectorModal
          isOpen={mediaModalOpen}
          onClose={() => setMediaModalOpen(false)}
          onSelect={(asset) => {
            if (mediaTarget === 'question_image') {
              setImageAsset(asset);
            } else if (mediaTarget === 'question_audio') {
              setAudioAsset(asset);
            } else if (typeof mediaTarget === 'object' && 'optionId' in mediaTarget) {
              const optId = mediaTarget.optionId;
              setOptions((prev) =>
                prev.map((o) => (o.id === optId ? { ...o, media_asset: asset, media_asset_id: asset?.id || null } : o))
              );
            }
          }}
          mediaTypeFilter={mediaTarget === 'question_audio' ? 'audio' : 'image'}
          title="Select Media Asset"
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmQuestion && (
        <Modal
          isOpen={Boolean(deleteConfirmQuestion)}
          onClose={() => setDeleteConfirmQuestion(null)}
          title="Confirm Question Deletion"
        >
          <div>
            <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to delete this question?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirmQuestion(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete Question
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
