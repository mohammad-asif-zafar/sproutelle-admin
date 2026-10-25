import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Compass,
  Eye,
  FolderTree,
  ArrowLeft,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { HomescreenExplorer, HomescreenExplorerSubcategory, MediaAsset, GameCategory } from '../types/database';
import { Modal } from '../components/Common/Modal';
import { MediaSelectorModal } from '../components/Media/MediaSelectorModal';
import { MediaPreviewTile } from '../components/Media/MediaPreviewTile';

const DEMO_EXPLORER_ITEMS: HomescreenExplorer[] = [
  {
    id: 'exp-1',
    title_name: 'Letters\n& Reading',
    background_color: '#FFECEE',
    sort_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-2',
    title_name: 'Numbers\n& Maths',
    background_color: '#FFF9DB',
    sort_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-3',
    title_name: 'Animals\n& Nature',
    background_color: '#E8F8EE',
    sort_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-4',
    title_name: 'Shapes\n& Colours',
    background_color: '#E2F0FD',
    sort_order: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-5',
    title_name: 'Creative\nStudio',
    background_color: '#F1E8FF',
    sort_order: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-6',
    title_name: 'Everyday\nWorld',
    background_color: '#FFECE0',
    sort_order: 6,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const PRESET_CARD_BACKGROUNDS = [
  { label: 'Soft Pink (Reading)', value: '#FFECEE' },
  { label: 'Soft Yellow (Maths)', value: '#FFF9DB' },
  { label: 'Soft Mint (Nature)', value: '#E8F8EE' },
  { label: 'Soft Blue (Shapes)', value: '#E2F0FD' },
  { label: 'Soft Purple (Creative)', value: '#F1E8FF' },
  { label: 'Soft Peach (Everyday)', value: '#FFECE0' },
];

export const ExplorerStudioPage: React.FC = () => {
  const [explorerList, setExplorerList] = useState<HomescreenExplorer[]>(
    !isSupabaseConfigured ? DEMO_EXPLORER_ITEMS : []
  );
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Form State for Explorer Cards
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<HomescreenExplorer | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<HomescreenExplorer | null>(null);
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState<boolean>(false);

  // Form Fields for Explorer Cards
  const [titleName, setTitleName] = useState<string>('');
  const [selectedMediaAsset, setSelectedMediaAsset] = useState<MediaAsset | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFECEE');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Subcategory Management State
  const [managingExplorer, setManagingExplorer] = useState<HomescreenExplorer | null>(null);
  const [subcategories, setSubcategories] = useState<HomescreenExplorerSubcategory[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState<boolean>(false);
  const [subModalOpen, setSubModalOpen] = useState<boolean>(false);
  const [editingSub, setEditingSub] = useState<HomescreenExplorerSubcategory | null>(null);
  const [deleteConfirmSub, setDeleteConfirmSub] = useState<HomescreenExplorerSubcategory | null>(null);
  const [subMediaSelectorOpen, setSubMediaSelectorOpen] = useState<boolean>(false);

  // Subcategory Form Fields
  const [subName, setSubName] = useState<string>('');
  const [subSelectedMediaAsset, setSubSelectedMediaAsset] = useState<MediaAsset | null>(null);
  const [subBackgroundColor, setSubBackgroundColor] = useState<string>('#FFF0F3');
  const [subCategoryId, setSubCategoryId] = useState<string>('');
  const [subSortOrder, setSubSortOrder] = useState<number>(1);
  const [subIsActive, setSubIsActive] = useState<boolean>(true);
  const [subFormError, setSubFormError] = useState<string | null>(null);
  const [subSubmitting, setSubSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return;
    }

    try {
      setPageError(null);

      const [expRes, catRes, mediaRes] = await Promise.all([
        supabase
          .from('homescreen_explorer')
          .select('*, title_image_asset:media_assets(*), category:game_categories(*)')
          .order('sort_order', { ascending: true }),
        supabase.from('game_categories').select('*').order('sort_order'),
        supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
      ]);

      if (expRes.error) {
        console.warn('Homescreen explorer query warning:', expRes.error.message);
        setPageError(`Supabase table warning: ${expRes.error.message}. Table may not exist on live database yet.`);
      } else if (expRes.data) {
        setExplorerList(expRes.data as HomescreenExplorer[]);
      }

      if (catRes.data) setCategories(catRes.data as GameCategory[]);
      if (mediaRes.data) setMediaAssets(mediaRes.data as MediaAsset[]);
    } catch (err) {
      console.error('Failed loading explorer items:', err);
      const msg = err instanceof Error ? err.message : 'Database query failed.';
      setPageError(msg);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    async function initData() {
      try {
        const [expRes, catRes, mediaRes] = await Promise.all([
          supabase
            .from('homescreen_explorer')
            .select('*, title_image_asset:media_assets(*), category:game_categories(*)')
            .order('sort_order', { ascending: true }),
          supabase.from('game_categories').select('*').order('sort_order'),
          supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
        ]);

        if (!isMounted) return;

        if (expRes.error) {
          console.warn('Homescreen explorer query warning:', expRes.error.message);
          setPageError(`Supabase table warning: ${expRes.error.message}. Table may not exist on live database yet.`);
        } else if (expRes.data) {
          setExplorerList(expRes.data as HomescreenExplorer[]);
        }

        if (catRes.data) setCategories(catRes.data as GameCategory[]);
        if (mediaRes.data) setMediaAssets(mediaRes.data as MediaAsset[]);
      } catch (err) {
        console.error('Failed loading explorer items:', err);
        const msg = err instanceof Error ? err.message : 'Database query failed.';
        if (isMounted) setPageError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initData();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadSubcategories = useCallback(async (explorerId: string) => {
    if (!isSupabaseConfigured) {
      setSubcategories([
        {
          id: 'sub-1',
          explorer_id: explorerId,
          name: 'Phonics & Letters',
          background_color: '#FFECEE',
          sort_order: 1,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sub-2',
          explorer_id: explorerId,
          name: 'Sight Words',
          background_color: '#FFF9DB',
          sort_order: 2,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setSubcategoriesLoading(false);
      return;
    }

    try {
      setSubcategoriesLoading(true);
      const { data, error } = await supabase
        .from('homescreen_explorer_subcategories')
        .select('*, image_asset:media_assets(*), category:game_categories(*)')
        .eq('explorer_id', explorerId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSubcategories((data as HomescreenExplorerSubcategory[]) || []);
    } catch (err) {
      console.error('Failed loading subcategories:', err);
    } finally {
      setSubcategoriesLoading(false);
    }
  }, []);

  const handleManageSubcategories = (item: HomescreenExplorer) => {
    setManagingExplorer(item);
    loadSubcategories(item.id);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setTitleName('');
    setSelectedMediaAsset(null);
    setBackgroundColor('#FFECEE');
    setSelectedCategoryId('');
    setSortOrder(explorerList.length + 1);
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: HomescreenExplorer) => {
    setEditingItem(item);
    setTitleName(item.title_name);
    setSelectedMediaAsset(item.title_image_asset || mediaAssets.find((m) => m.id === item.title_image_asset_id) || null);
    setBackgroundColor(item.background_color || '#FFECEE');
    setSelectedCategoryId(item.category_id || '');
    setSortOrder(item.sort_order || 1);
    setIsActive(item.is_active ?? true);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!titleName.trim()) {
      setFormError('Please enter a title name for the explorer card.');
      return;
    }

    const payload = {
      title_name: titleName.trim(),
      title_image_asset_id: selectedMediaAsset?.id || null,
      background_color: backgroundColor,
      category_id: selectedCategoryId || null,
      sort_order: sortOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      if (editingItem) {
        setExplorerList((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? { ...item, ...payload, title_image_asset: selectedMediaAsset }
              : item
          )
        );
      } else {
        const newItem: HomescreenExplorer = {
          id: `exp-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
          title_image_asset: selectedMediaAsset,
        };
        setExplorerList((prev) => [...prev, newItem]);
      }
      setModalOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      if (editingItem) {
        const { error } = await supabase
          .from('homescreen_explorer')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('homescreen_explorer').insert(payload);
        if (error) throw error;
      }

      await loadData();
      setModalOpen(false);
    } catch (err) {
      console.error('Failed saving explorer item:', err);
      const msg = err instanceof Error ? err.message : 'Database save failed.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    if (!isSupabaseConfigured) {
      setExplorerList((prev) => prev.filter((i) => i.id !== deleteConfirmItem.id));
      setDeleteConfirmItem(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('homescreen_explorer')
        .delete()
        .eq('id', deleteConfirmItem.id);
      if (error) throw error;
      await loadData();
      setDeleteConfirmItem(null);
    } catch (err) {
      console.error('Failed deleting explorer item:', err);
      alert('Failed deleting card.');
    }
  };

  // Subcategory CRUD Handlers
  const openCreateSubModal = () => {
    setEditingSub(null);
    setSubName('');
    setSubSelectedMediaAsset(null);
    setSubBackgroundColor('#FFF0F3');
    setSubCategoryId('');
    setSubSortOrder(subcategories.length + 1);
    setSubIsActive(true);
    setSubFormError(null);
    setSubModalOpen(true);
  };

  const openEditSubModal = (sub: HomescreenExplorerSubcategory) => {
    setEditingSub(sub);
    setSubName(sub.name);
    setSubSelectedMediaAsset(sub.image_asset || mediaAssets.find((m) => m.id === sub.image_asset_id) || null);
    setSubBackgroundColor(sub.background_color || '#FFF0F3');
    setSubCategoryId(sub.category_id || '');
    setSubSortOrder(sub.sort_order || 1);
    setSubIsActive(sub.is_active ?? true);
    setSubFormError(null);
    setSubModalOpen(true);
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubFormError(null);

    if (!subName.trim()) {
      setSubFormError('Please enter a subcategory name.');
      return;
    }

    if (!managingExplorer) return;

    const payload = {
      explorer_id: managingExplorer.id,
      name: subName.trim(),
      image_asset_id: subSelectedMediaAsset?.id || null,
      background_color: subBackgroundColor,
      category_id: subCategoryId || null,
      sort_order: subSortOrder,
      is_active: subIsActive,
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      if (editingSub) {
        setSubcategories((prev) =>
          prev.map((s) => (s.id === editingSub.id ? { ...s, ...payload, image_asset: subSelectedMediaAsset } : s))
        );
      } else {
        const newSub: HomescreenExplorerSubcategory = {
          id: `sub-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
          image_asset: subSelectedMediaAsset,
        };
        setSubcategories((prev) => [...prev, newSub]);
      }
      setSubModalOpen(false);
      return;
    }

    try {
      setSubSubmitting(true);
      if (editingSub) {
        const { error } = await supabase
          .from('homescreen_explorer_subcategories')
          .update(payload)
          .eq('id', editingSub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('homescreen_explorer_subcategories').insert(payload);
        if (error) throw error;
      }

      await loadSubcategories(managingExplorer.id);
      setSubModalOpen(false);
    } catch (err) {
      console.error('Failed saving subcategory:', err);
      const msg = err instanceof Error ? err.message : 'Database save failed.';
      setSubFormError(msg);
    } finally {
      setSubSubmitting(false);
    }
  };

  const handleDeleteSub = async () => {
    if (!deleteConfirmSub || !managingExplorer) return;
    if (!isSupabaseConfigured) {
      setSubcategories((prev) => prev.filter((s) => s.id !== deleteConfirmSub.id));
      setDeleteConfirmSub(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('homescreen_explorer_subcategories')
        .delete()
        .eq('id', deleteConfirmSub.id);
      if (error) throw error;
      await loadSubcategories(managingExplorer.id);
      setDeleteConfirmSub(null);
    } catch (err) {
      console.error('Failed deleting subcategory:', err);
      alert('Failed deleting subcategory.');
    }
  };

  const filtered = explorerList.filter((i) =>
    i.title_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If managing subcategories for a specific explorer card
  if (managingExplorer) {
    return (
      <div>
        {/* Subcategory Manager Header */}
        <div className="page-header">
          <div className="page-title">
            <button
              onClick={() => setManagingExplorer(null)}
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <ArrowLeft size={16} /> Back to Explorer Cards
            </button>
            <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderTree color="var(--color-primary)" size={28} />
              Subcategories for: &ldquo;{managingExplorer.title_name.replace('\n', ' ')}&rdquo;
            </h2>
            <p className="page-subtitle">
              Manage subcategory sections belonging to this homescreen explorer card.
            </p>
          </div>
          <button onClick={openCreateSubModal} className="btn btn-primary btn-sm">
            <Plus size={16} /> Add Subcategory
          </button>
        </div>

        {/* Live Subcategory Preview Bar */}
        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--color-primary-dark)' }}>
                Subcategory Preview Bar
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Mobile App Section Rendering
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              overflowX: 'auto',
              padding: '0.5rem 0.25rem 1rem 0.25rem',
              alignItems: 'stretch',
            }}
          >
            {subcategories.filter((s) => s.is_active).length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', padding: '1rem' }}>
                No active subcategories configured for this card yet.
              </div>
            ) : (
              subcategories.filter((s) => s.is_active).map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    width: '120px',
                    minWidth: '120px',
                    height: '130px',
                    backgroundColor: sub.background_color || '#FFF0F3',
                    borderRadius: '16px',
                    padding: '0.75rem 0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sub.image_asset ? (
                      <MediaPreviewTile asset={sub.image_asset} height="48px" />
                    ) : (
                      <FolderTree size={32} color="var(--color-primary)" />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#0F2D4A',
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}
                  >
                    {sub.name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Subcategories Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {subcategoriesLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading subcategories...
            </div>
          ) : subcategories.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No subcategories found for this card. Click &ldquo;Add Subcategory&rdquo; above.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.875rem 1rem' }}>Order</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Theme Preview</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Subcategory Name</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Image Asset</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Linked Category</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subcategories.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>#{sub.sort_order}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: sub.background_color,
                            border: '1px solid var(--color-border)',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>{sub.name}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {sub.image_asset ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '28px', height: '28px' }}>
                              <MediaPreviewTile asset={sub.image_asset} height="28px" />
                            </div>
                            <span style={{ fontSize: '0.8125rem' }}>{sub.image_asset.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {sub.category?.name || categories.find((c) => c.id === sub.category_id)?.name || 'None'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className={`badge ${sub.is_active ? 'badge-success' : 'badge-warning'}`}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button onClick={() => openEditSubModal(sub)} className="btn btn-secondary btn-sm" title="Edit Subcategory">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteConfirmSub(sub)} className="btn btn-danger btn-sm" title="Delete Subcategory">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add / Edit Subcategory Modal */}
        {subModalOpen && (
          <Modal
            isOpen={subModalOpen}
            onClose={() => setSubModalOpen(false)}
            title={editingSub ? 'Edit Subcategory' : 'Add New Subcategory'}
          >
            {subFormError && (
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
                {subFormError}
              </div>
            )}

            <form onSubmit={handleSaveSub}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Subcategory Name */}
                <div className="input-group">
                  <label className="input-label">
                    Subcategory Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Phonics & Letters"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    required
                  />
                </div>

                {/* Subcategory Image Selector */}
                <div className="input-group">
                  <label className="input-label">Subcategory Image Icon</label>

                  {subSelectedMediaAsset ? (
                    <div
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--color-surface-muted)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '48px', height: '48px' }}>
                          <MediaPreviewTile asset={subSelectedMediaAsset} height="48px" />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{subSelectedMediaAsset.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {subSelectedMediaAsset.mime_type}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubMediaSelectorOpen(true)}
                        className="btn btn-secondary btn-sm"
                      >
                        Change Image
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value=""
                        onChange={(e) => {
                          const targetId = e.target.value;
                          const asset = mediaAssets.find((m) => m.id === targetId);
                          setSubSelectedMediaAsset(asset || null);
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select from uploaded images dropdown...</option>
                        {mediaAssets
                          .filter((m) => m.mime_type.startsWith('image/'))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setSubMediaSelectorOpen(true)}
                        className="btn btn-secondary"
                      >
                        <ImageIcon size={18} /> Browse Studio
                      </button>
                    </div>
                  )}
                </div>

                {/* Background Color */}
                <div className="input-group">
                  <label className="input-label">Card Background Color</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {PRESET_CARD_BACKGROUNDS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setSubBackgroundColor(preset.value)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: preset.value,
                          border: `2px solid ${subBackgroundColor === preset.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#0F2D4A',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="#FFF0F3"
                    value={subBackgroundColor}
                    onChange={(e) => setSubBackgroundColor(e.target.value)}
                  />
                </div>

                {/* Linked Game Category */}
                <div className="input-group">
                  <label className="input-label">Linked Game Category</label>
                  <select
                    className="form-select"
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                  >
                    <option value="">None</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Order & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Sort Order</label>
                    <input
                      type="number"
                      className="form-control"
                      value={subSortOrder}
                      onChange={(e) => setSubSortOrder(Number(e.target.value))}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Status</label>
                    <select
                      className="form-select"
                      value={String(subIsActive)}
                      onChange={(e) => setSubIsActive(e.target.value === 'true')}
                    >
                      <option value="true">Active (Visible)</option>
                      <option value="false">Inactive (Hidden)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setSubModalOpen(false)}
                    className="btn btn-secondary"
                    disabled={subSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={subSubmitting}>
                    {subSubmitting ? 'Saving...' : 'Save Subcategory'}
                  </button>
                </div>
              </div>
            </form>
          </Modal>
        )}

        {/* Sub Media Picker Modal */}
        {subMediaSelectorOpen && (
          <MediaSelectorModal
            isOpen={subMediaSelectorOpen}
            onClose={() => setSubMediaSelectorOpen(false)}
            onSelect={(asset) => setSubSelectedMediaAsset(asset)}
            mediaTypeFilter="image"
            title="Select Icon Asset for Subcategory"
          />
        )}

        {/* Delete Subcategory Confirmation Modal */}
        {deleteConfirmSub && (
          <Modal
            isOpen={Boolean(deleteConfirmSub)}
            onClose={() => setDeleteConfirmSub(null)}
            title="Confirm Subcategory Deletion"
          >
            <div>
              <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Are you sure you want to delete subcategory <strong>{deleteConfirmSub.name}</strong>?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setDeleteConfirmSub(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleDeleteSub} className="btn btn-danger">
                  Delete Subcategory
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass color="var(--color-primary)" size={28} />
            Homescreen Explorer Cards
          </h2>
          <p className="page-subtitle">
            Configure mobile app homescreen discovery categories, colorful card themes, 3D icons, and category links.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Explorer Card
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

      {/* Live Mobile App Preview Section */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--color-primary-dark)' }}>
              Live App Homescreen Preview
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Exact Kid's App Rendering
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            overflowX: 'auto',
            padding: '0.5rem 0.25rem 1rem 0.25rem',
            alignItems: 'stretch',
          }}
        >
          {explorerList.filter((i) => i.is_active).map((item) => (
            <div
              key={item.id}
              style={{
                width: '130px',
                minWidth: '130px',
                height: '140px',
                backgroundColor: item.background_color || '#FFECEE',
                borderRadius: '20px',
                padding: '0.875rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.05)',
                transition: 'transform 0.15s ease',
                cursor: 'pointer',
              }}
            >
              {/* Card Icon */}
              <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.title_image_asset ? (
                  <MediaPreviewTile asset={item.title_image_asset} height="56px" />
                ) : (
                  <Sparkles size={36} color="var(--color-primary)" />
                )}
              </div>

              {/* Card Title */}
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  color: '#0F2D4A',
                  textAlign: 'center',
                  lineHeight: 1.25,
                  whiteSpace: 'pre-line',
                }}
              >
                {item.title_name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explorer Cards Manager Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search explorer cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Total Cards: {explorerList.length} ({explorerList.filter((i) => i.is_active).length} Active)
          </div>
        </div>
      </div>

      {/* Cards Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading explorer cards...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No explorer cards configured yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Order</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Theme Preview</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Title Name</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Image Asset</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Linked Category</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>#{item.sort_order}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: item.background_color,
                          border: '1px solid var(--color-border)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700, whiteSpace: 'pre-line' }}>
                      {item.title_name}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {item.title_image_asset ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '32px', height: '32px' }}>
                            <MediaPreviewTile asset={item.title_image_asset} height="32px" />
                          </div>
                          <span style={{ fontSize: '0.8125rem' }}>{item.title_image_asset.name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>None selected</span>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      {item.category?.name || categories.find((c) => c.id === item.category_id)?.name || 'None'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span className={`badge ${item.is_active ? 'badge-success' : 'badge-warning'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        <button
                          onClick={() => handleManageSubcategories(item)}
                          className="btn btn-secondary btn-sm"
                          title="Manage Subcategories"
                        >
                          <FolderTree size={14} /> Subcategories
                        </button>
                        <button onClick={() => openEditModal(item)} className="btn btn-secondary btn-sm" title="Edit Card">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirmItem(item)} className="btn btn-danger btn-sm" title="Delete Card">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Explorer Card Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingItem ? 'Edit Explorer Card' : 'Add New Explorer Card'}
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
              {/* Title Name */}
              <div className="input-group">
                <label className="input-label">
                  Title Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Letters & Reading (use \n or line breaks if needed)"
                  value={titleName}
                  onChange={(e) => setTitleName(e.target.value)}
                  required
                />
              </div>

              {/* Title Image Asset Selector */}
              <div className="input-group">
                <label className="input-label">Title Image Icon</label>

                {selectedMediaAsset ? (
                  <div
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--color-surface-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '48px', height: '48px' }}>
                        <MediaPreviewTile asset={selectedMediaAsset} height="48px" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedMediaAsset.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {selectedMediaAsset.mime_type}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaSelectorOpen(true)}
                      className="btn btn-secondary btn-sm"
                    >
                      Change Image
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value=""
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const asset = mediaAssets.find((m) => m.id === targetId);
                        setSelectedMediaAsset(asset || null);
                      }}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select from uploaded images dropdown...</option>
                      {mediaAssets
                        .filter((m) => m.mime_type.startsWith('image/'))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setMediaSelectorOpen(true)}
                      className="btn btn-secondary"
                    >
                      <ImageIcon size={18} /> Browse Studio
                    </button>
                  </div>
                )}
              </div>

              {/* Background Color Preset Picker */}
              <div className="input-group">
                <label className="input-label">Card Background Color</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {PRESET_CARD_BACKGROUNDS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setBackgroundColor(preset.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: preset.value,
                        border: `2px solid ${backgroundColor === preset.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#0F2D4A',
                        cursor: 'pointer',
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="#FFECEE"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                />
              </div>

              {/* Linked Category Dropdown */}
              <div className="input-group">
                <label className="input-label">Linked Game Category</label>
                <select
                  className="form-select"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <option value="">None (Standalone Card)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order & Active Toggle */}
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
                    value={String(isActive)}
                    onChange={(e) => setIsActive(e.target.value === 'true')}
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Inactive (Hidden)</option>
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
                  {submitting ? 'Saving...' : 'Save Card'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Media Asset Picker Modal */}
      {mediaSelectorOpen && (
        <MediaSelectorModal
          isOpen={mediaSelectorOpen}
          onClose={() => setMediaSelectorOpen(false)}
          onSelect={(asset) => setSelectedMediaAsset(asset)}
          mediaTypeFilter="image"
          title="Select Icon Asset for Explorer Card"
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <Modal
          isOpen={Boolean(deleteConfirmItem)}
          onClose={() => setDeleteConfirmItem(null)}
          title="Confirm Card Deletion"
        >
          <div>
            <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to delete explorer card <strong>{deleteConfirmItem.title_name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirmItem(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete Card
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
