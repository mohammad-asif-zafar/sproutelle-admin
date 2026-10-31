import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Gamepad2,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { HomescreenExplorer, HomescreenExplorerSubcategory, MediaAsset, GameCategory, Game, SubcategoryGameAssignment } from '../types/database';
import { GAME_ENGINE_REGISTRY, type EngineType } from '../types/engine';
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
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { managingExplorerId?: string; managingSubcategoryId?: string } | null;
  const managingExplorerId = locationState?.managingExplorerId;
  const managingSubcategoryId = locationState?.managingSubcategoryId;

  const [explorerList, setExplorerList] = useState<HomescreenExplorer[]>(
    !isSupabaseConfigured ? DEMO_EXPLORER_ITEMS : []
  );
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [allGames, setAllGames] = useState<Game[]>(
    !isSupabaseConfigured
      ? [
          { id: 'game-1', name: 'Alphabet Safari', slug: 'alphabet-safari', game_type: 'multiple_choice', is_published: true, sort_order: 1, created_at: '', updated_at: '' },
          { id: 'game-2', name: 'Counting Meadow', slug: 'counting-meadow', game_type: 'image_selection', is_published: true, sort_order: 2, created_at: '', updated_at: '' },
        ]
      : []
  );
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

  // Assigned Games for Subcategory Editor
  const [assignedGames, setAssignedGames] = useState<Array<{ game_id: string; enabled_patterns: string[]; sort_order: number; is_active: boolean }>>([]);

  // Subcategory Games Management State
  const [managingSubcategory, setManagingSubcategory] = useState<HomescreenExplorerSubcategory | null>(null);
  const [subcategoryGames, setSubcategoryGames] = useState<Game[]>([]);
  const [subcategoryGamesLoading, setSubcategoryGamesLoading] = useState<boolean>(false);
  const [gameQuestionCountMap, setGameQuestionCountMap] = useState<Map<string, number>>(new Map());

  // Add Existing Games Modal State
  const [assignGamesModalOpen, setAssignGamesModalOpen] = useState<boolean>(false);
  const [selectedGameIdsToAssign, setSelectedGameIdsToAssign] = useState<string[]>([]);

  // Create New Game Modal State
  const [createGameModalOpen, setCreateGameModalOpen] = useState<boolean>(false);
  const [newGameName, setNewGameName] = useState<string>('');
  const [newGameSlug, setNewGameSlug] = useState<string>('');
  const [newGameType, setNewGameType] = useState<string>('multiple_choice');
  const [newGameCategoryId, setNewGameCategoryId] = useState<string>('');
  const [newGameIsPublished, setNewGameIsPublished] = useState<boolean>(false);
  const [newGameSubmitting, setNewGameSubmitting] = useState<boolean>(false);
  const [newGameError, setNewGameError] = useState<string | null>(null);

  const loadSubcategoryGames = useCallback(async (subId: string) => {
    if (!isSupabaseConfigured) {
      setSubcategoryGames(allGames.slice(0, 2));
      setSubcategoryGamesLoading(false);
      return;
    }
    try {
      setSubcategoryGamesLoading(true);
      const [assignRes, qRes] = await Promise.all([
        supabase
          .from('subcategory_games')
          .select('game:games(*, category:game_categories(*))')
          .eq('subcategory_id', subId)
          .order('sort_order', { ascending: true }),
        supabase.from('questions').select('game_id'),
      ]);

      if (assignRes.error) throw assignRes.error;
      const gamesList = (assignRes.data || []).map((item: unknown) => (item as { game: Game }).game).filter(Boolean);
      setSubcategoryGames(gamesList);

      if (qRes.data) {
        const qMap = new Map<string, number>();
        ((qRes.data as Array<Record<string, unknown>>) || []).forEach((q) => {
          const gId = q.game_id as string;
          if (gId) {
            qMap.set(gId, (qMap.get(gId) || 0) + 1);
          }
        });
        setGameQuestionCountMap(qMap);
      }
    } catch (err) {
      console.error('Failed loading subcategory games:', err);
    } finally {
      setSubcategoryGamesLoading(false);
    }
  }, [allGames]);

  const handleOpenSubcategoryGames = (sub: HomescreenExplorerSubcategory) => {
    setManagingSubcategory(sub);
    loadSubcategoryGames(sub.id);
  };

  const handleAssignExistingGames = async () => {
    if (selectedGameIdsToAssign.length === 0 || !managingSubcategory || !managingExplorer) return;
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured.');
      return;
    }

    try {
      const rows = selectedGameIdsToAssign.map((gId, idx) => ({
        subcategory_id: managingSubcategory.id,
        game_id: gId,
        sort_order: subcategoryGames.length + idx + 1,
        is_active: true,
      }));

      const { error } = await supabase.from('subcategory_games').upsert(rows, { onConflict: 'subcategory_id,game_id' });
      if (error) throw error;

      await loadSubcategoryGames(managingSubcategory.id);
      await loadSubcategories(managingExplorer.id);
      setAssignGamesModalOpen(false);
      setSelectedGameIdsToAssign([]);
    } catch (err) {
      console.error('Failed assigning existing games:', err);
      alert('Failed assigning games.');
    }
  };

  const handleCreateNewGameInSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewGameError(null);
    if (!newGameName.trim()) {
      setNewGameError('Game name is required.');
      return;
    }
    if (!managingSubcategory || !managingExplorer) return;

    if (!isSupabaseConfigured) {
      alert('Supabase is not configured.');
      return;
    }

    try {
      setNewGameSubmitting(true);
      const slug = newGameSlug.trim() || newGameName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const payload = {
        name: newGameName.trim(),
        slug,
        game_type: newGameType,
        category_id: newGameCategoryId || null,
        is_published: newGameIsPublished,
        sort_order: subcategoryGames.length + 1,
        config: { question_count: 5 },
        updated_at: new Date().toISOString(),
      };

      const { data: insertedGame, error: gameErr } = await supabase.from('games').insert(payload).select().single();
      if (gameErr) throw gameErr;

      if (insertedGame) {
        const { error: assignErr } = await supabase.from('subcategory_games').insert({
          subcategory_id: managingSubcategory.id,
          game_id: insertedGame.id,
          sort_order: subcategoryGames.length + 1,
          is_active: true,
        });
        if (assignErr) throw assignErr;
      }

      await loadSubcategoryGames(managingSubcategory.id);
      await loadSubcategories(managingExplorer.id);
      setCreateGameModalOpen(false);
      setNewGameName('');
      setNewGameSlug('');
    } catch (err) {
      console.error('Failed creating game for subcategory:', err);
      const msg = err instanceof Error ? err.message : 'Database save failed.';
      setNewGameError(msg);
    } finally {
      setNewGameSubmitting(false);
    }
  };

  // Counts & Error States
  const [explorerSubCountMap, setExplorerSubCountMap] = useState<Map<string, number>>(new Map());
  const [explorerSubCountError, setExplorerSubCountError] = useState<string | null>(null);
  const [subGameCountMap, setSubGameCountMap] = useState<Map<string, number>>(new Map());
  const [subGameCountError, setSubGameCountError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAllGames([
        { id: 'game-1', name: 'Alphabet Safari', slug: 'alphabet-safari', game_type: 'multiple_choice', is_published: true, sort_order: 1, created_at: '', updated_at: '' },
        { id: 'game-2', name: 'Counting Meadow', slug: 'counting-meadow', game_type: 'image_selection', is_published: true, sort_order: 2, created_at: '', updated_at: '' },
      ]);
      setExplorerSubCountMap(new Map([['exp-1', 2], ['exp-2', 2], ['exp-3', 1]]));
      setExplorerSubCountError(null);
      return;
    }

    try {
      setPageError(null);

      const [expRes, catRes, mediaRes, gamesRes, subCountRes, qRes] = await Promise.all([
        supabase
          .from('homescreen_explorer')
          .select('*, title_image_asset:media_assets(*), category:game_categories(*)')
          .order('sort_order', { ascending: true }),
        supabase.from('game_categories').select('*').order('sort_order'),
        supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
        supabase.from('games').select('*').order('sort_order'),
        supabase.from('homescreen_explorer_subcategories').select('id, explorer_id'),
        supabase.from('questions').select('game_id'),
      ]);

      if (expRes.error) {
        console.warn('Homescreen explorer query warning:', expRes.error.message);
        setPageError(`Supabase table warning: ${expRes.error.message}. Table may not exist on live database yet.`);
      } else if (expRes.data) {
        const list = expRes.data as HomescreenExplorer[];
        setExplorerList(list);
        if (managingExplorerId && !managingExplorer) {
          const exp = list.find((e) => e.id === managingExplorerId);
          if (exp) {
            setManagingExplorer(exp);
            const { data: subData } = await supabase
              .from('homescreen_explorer_subcategories')
              .select('*, image_asset:media_assets(*), category:game_categories(*)')
              .eq('explorer_id', exp.id)
              .order('sort_order', { ascending: true });
            if (subData) {
              const subList = subData as HomescreenExplorerSubcategory[];
              setSubcategories(subList);
              if (managingSubcategoryId && !managingSubcategory) {
                const sub = subList.find((s) => s.id === managingSubcategoryId);
                if (sub) {
                  setManagingSubcategory(sub);
                }
              }
            }
          }
        }
      }

      if (catRes.data) setCategories(catRes.data as GameCategory[]);
      if (mediaRes.data) setMediaAssets(mediaRes.data as MediaAsset[]);
      if (gamesRes.data) setAllGames(gamesRes.data as Game[]);

      if (subCountRes.error) {
        setExplorerSubCountError(subCountRes.error.message);
        setExplorerSubCountMap(new Map());
      } else {
        setExplorerSubCountError(null);
        const countMap = new Map<string, number>();
        ((subCountRes.data as Array<Record<string, unknown>>) || []).forEach((s) => {
          const expId = s.explorer_id as string;
          if (expId) {
            countMap.set(expId, (countMap.get(expId) || 0) + 1);
          }
        });
        setExplorerSubCountMap(countMap);
      }

      if (qRes.data) {
        const qMap = new Map<string, number>();
        ((qRes.data as Array<Record<string, unknown>>) || []).forEach((q) => {
          const gId = q.game_id as string;
          if (gId) {
            qMap.set(gId, (qMap.get(gId) || 0) + 1);
          }
        });
        setGameQuestionCountMap(qMap);
      }
    } catch (err) {
      console.error('Failed loading explorer items:', err);
      const msg = err instanceof Error ? err.message : 'Database query failed.';
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    async function initData() {
      try {
        const [expRes, catRes, mediaRes, gamesRes, subCountRes, qRes] = await Promise.all([
          supabase
            .from('homescreen_explorer')
            .select('*, title_image_asset:media_assets(*), category:game_categories(*)')
            .order('sort_order', { ascending: true }),
          supabase.from('game_categories').select('*').order('sort_order'),
          supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
          supabase.from('games').select('*').order('sort_order'),
          supabase.from('homescreen_explorer_subcategories').select('id, explorer_id'),
          supabase.from('questions').select('game_id'),
        ]);

        if (!isMounted) return;

        if (expRes.error) {
          console.warn('Homescreen explorer query warning:', expRes.error.message);
          setPageError(`Supabase table warning: ${expRes.error.message}. Table may not exist on live database yet.`);
        } else if (expRes.data) {
          const list = expRes.data as HomescreenExplorer[];
          setExplorerList(list);
          if (managingExplorerId && !managingExplorer) {
            const exp = list.find((e) => e.id === managingExplorerId);
            if (exp) {
              setManagingExplorer(exp);
              const { data: subData } = await supabase
                .from('homescreen_explorer_subcategories')
                .select('*, image_asset:media_assets(*), category:game_categories(*)')
                .eq('explorer_id', exp.id)
                .order('sort_order', { ascending: true });
              if (subData) {
                const subList = subData as HomescreenExplorerSubcategory[];
                setSubcategories(subList);
                if (managingSubcategoryId && !managingSubcategory) {
                  const sub = subList.find((s) => s.id === managingSubcategoryId);
                  if (sub) {
                    setManagingSubcategory(sub);
                  }
                }
              }
            }
          }
        }

        if (catRes.data) setCategories(catRes.data as GameCategory[]);
        if (mediaRes.data) setMediaAssets(mediaRes.data as MediaAsset[]);
        if (gamesRes.data) setAllGames(gamesRes.data as Game[]);

        if (subCountRes.error) {
          setExplorerSubCountError(subCountRes.error.message);
          setExplorerSubCountMap(new Map());
        } else {
          setExplorerSubCountError(null);
          const countMap = new Map<string, number>();
          ((subCountRes.data as Array<Record<string, unknown>>) || []).forEach((s) => {
            const expId = s.explorer_id as string;
            if (expId) {
              countMap.set(expId, (countMap.get(expId) || 0) + 1);
            }
          });
          setExplorerSubCountMap(countMap);
        }

        if (qRes.data) {
          const qMap = new Map<string, number>();
          ((qRes.data as Array<Record<string, unknown>>) || []).forEach((q) => {
            const gId = q.game_id as string;
            if (gId) {
              qMap.set(gId, (qMap.get(gId) || 0) + 1);
            }
          });
          setGameQuestionCountMap(qMap);
        }
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
      setSubGameCountMap(new Map([['sub-1', 1], ['sub-2', 1]]));
      setSubGameCountError(null);
      setSubcategoriesLoading(false);
      return;
    }

    try {
      setSubcategoriesLoading(true);
      const [subRes, assignRes] = await Promise.all([
        supabase
          .from('homescreen_explorer_subcategories')
          .select('*, image_asset:media_assets(*), category:game_categories(*)')
          .eq('explorer_id', explorerId)
          .order('sort_order', { ascending: true }),
        supabase.from('subcategory_games').select('subcategory_id, game_id'),
      ]);

      if (subRes.error) throw subRes.error;
      setSubcategories((subRes.data as HomescreenExplorerSubcategory[]) || []);

      if (assignRes.error) {
        setSubGameCountError(assignRes.error.message);
        setSubGameCountMap(new Map());
      } else {
        setSubGameCountError(null);
        const countMap = new Map<string, number>();
        ((assignRes.data as Array<Record<string, unknown>>) || []).forEach((ag) => {
          const subId = ag.subcategory_id as string;
          if (subId) {
            countMap.set(subId, (countMap.get(subId) || 0) + 1);
          }
        });
        setSubGameCountMap(countMap);
      }
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
  const openCreateSubModal = async () => {
    setEditingSub(null);
    setSubName('');
    setSubSelectedMediaAsset(null);
    setSubBackgroundColor('#FFF0F3');
    setSubCategoryId('');
    setSubSortOrder(subcategories.length + 1);
    setSubIsActive(true);
    setAssignedGames([]);
    setSubFormError(null);
    setSubModalOpen(true);
  };

  const openEditSubModal = async (sub: HomescreenExplorerSubcategory) => {
    setEditingSub(sub);
    setSubName(sub.name);
    setSubSelectedMediaAsset(sub.image_asset || mediaAssets.find((m) => m.id === sub.image_asset_id) || null);
    setSubBackgroundColor(sub.background_color || '#FFF0F3');
    setSubCategoryId(sub.category_id || '');
    setSubSortOrder(sub.sort_order || 1);
    setSubIsActive(sub.is_active ?? true);
    setSubFormError(null);
    setAssignedGames([]);

    // Load assigned games for this subcategory with strict error handling
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('subcategory_games')
          .select('*')
          .eq('subcategory_id', sub.id)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        if (data) {
          setAssignedGames(
            (data as SubcategoryGameAssignment[]).map((ag) => ({
              game_id: ag.game_id,
              enabled_patterns: ag.enabled_patterns || [],
              sort_order: ag.sort_order,
              is_active: ag.is_active,
            }))
          );
        }
      } catch (err) {
        console.error('Failed loading subcategory game assignments:', err);
        setSubFormError('Failed loading existing game assignments for this subcategory. Saving is blocked until loaded successfully.');
      }
    }

    setSubModalOpen(true);
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubFormError(null);

    if (!subName.trim()) {
      setSubFormError('Please enter a subcategory name.');
      return;
    }

    // Validate duplicate game assignments
    const gameIds = assignedGames.map((ag) => ag.game_id);
    const uniqueGameIds = new Set(gameIds);
    if (uniqueGameIds.size !== gameIds.length) {
      setSubFormError('Duplicate game assignments are not allowed in the same subcategory.');
      return;
    }

    if (!managingExplorer) return;

    if (!isSupabaseConfigured) {
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
      if (editingSub) {
        setSubcategories((prev) =>
          prev.map((s) => (s.id === editingSub.id ? { ...s, ...payload, image_asset: subSelectedMediaAsset } : s))
        );
      } else {
        const newSub: HomescreenExplorerSubcategory = {
          id: `sub-${crypto.randomUUID()}`,
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
      const subId = editingSub?.id || null;

      const normalizedAssignments = assignedGames.map((ag, idx) => ({
        game_id: ag.game_id,
        enabled_patterns: ag.enabled_patterns,
        sort_order: idx + 1,
        is_active: ag.is_active,
      }));

      const { data, error } = await supabase.rpc('save_subcategory_with_games', {
        p_subcategory_id: subId,
        p_explorer_id: managingExplorer.id,
        p_name: subName.trim(),
        p_image_asset_id: subSelectedMediaAsset?.id || null,
        p_background_color: subBackgroundColor,
        p_category_id: subCategoryId || null,
        p_sort_order: subSortOrder,
        p_is_active: subIsActive,
        p_assignments: normalizedAssignments,
      });

      if (error) throw error;
      if (!data) throw new Error('Atomic subcategory save transaction returned null/false.');

      await loadSubcategories(managingExplorer.id);
      setSubModalOpen(false);
    } catch (err) {
      console.error('Failed saving subcategory atomically:', err);
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

  // If managing games for a specific subcategory
  if (managingSubcategory && managingExplorer) {
    return (
      <div>
        {/* Subcategory Games Header */}
        <div className="page-header">
          <div className="page-title">
            <button
              onClick={() => setManagingSubcategory(null)}
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <ArrowLeft size={16} /> Back to Subcategories
            </button>
            <h2 style={{ color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Gamepad2 color="var(--color-primary)" size={28} />
              Games for: &ldquo;{managingSubcategory.name}&rdquo;
            </h2>
            <p className="page-subtitle">
              Manage learning games assigned to this subcategory within &ldquo;{managingExplorer.title_name.replace('\n', ' ')}&rdquo;.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setAssignGamesModalOpen(true)} className="btn btn-secondary btn-sm">
              <Plus size={16} /> Add Existing Games
            </button>
            <button onClick={() => setCreateGameModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Create New Game
            </button>
          </div>
        </div>

        {/* Games Preview Bar */}
        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--color-primary-dark)' }}>
                Games Preview Bar
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Assigned Activity Carousel
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
            {subcategoryGames.length === 0 ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', padding: '1rem' }}>
                No games assigned to this subcategory yet.
              </div>
            ) : (
              subcategoryGames.map((game) => {
                const engineDef = GAME_ENGINE_REGISTRY[game.game_type as EngineType] || GAME_ENGINE_REGISTRY.guess_game;
                return (
                  <div
                    key={game.id}
                    style={{
                      width: '140px',
                      minWidth: '140px',
                      height: '130px',
                      backgroundColor: managingSubcategory.background_color || '#FFF0F3',
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
                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '12px' }}>
                      <Gamepad2 size={24} color="var(--color-primary)" />
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
                      {game.name}
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.625rem' }}>{engineDef.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Games Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {subcategoryGamesLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading assigned games...
            </div>
          ) : subcategoryGames.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No games assigned to this subcategory. Click &ldquo;Add Existing Games&rdquo; or &ldquo;Create New Game&rdquo; above.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '0.875rem 1rem' }}>Order</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Game Name</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Game Type</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Engine</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Questions Count</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subcategoryGames.map((game, index) => {
                    const engineDef = GAME_ENGINE_REGISTRY[game.game_type as EngineType] || GAME_ENGINE_REGISTRY.guess_game;
                    const qCount = gameQuestionCountMap.get(game.id) ?? 0;
                    return (
                      <tr key={game.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>#{index + 1}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: '#0F2D4A' }}>{game.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>/{game.slug}</div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>{game.game_type}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span className="badge badge-primary">{engineDef.name}</span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span className="badge badge-secondary" style={{ fontWeight: 700 }}>{qCount}</span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span className={`badge ${game.is_published ? 'badge-success' : 'badge-warning'}`}>
                            {game.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                            <button
                              onClick={() => navigate(`/games/${game.id}/questions`, {
                                state: {
                                  fromSubcategory: managingSubcategory.id,
                                  explorerId: managingExplorer.id,
                                  openAddModal: true,
                                },
                              })}
                              className="btn btn-primary btn-sm"
                              title="Add Questions"
                            >
                              <Plus size={14} /> Add Questions
                            </button>
                            <button
                              onClick={() => {
                                navigate('/games');
                              }}
                              className="btn btn-secondary btn-sm"
                              title="Edit Game"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Remove game "${game.name}" from subcategory "${managingSubcategory.name}"?`)) {
                                  await supabase.from('subcategory_games').delete().eq('subcategory_id', managingSubcategory.id).eq('game_id', game.id);
                                  await loadSubcategoryGames(managingSubcategory.id);
                                  await loadSubcategories(managingExplorer.id);
                                }
                              }}
                              className="btn btn-danger btn-sm"
                              title="Remove Game Assignment"
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

        {/* Add Existing Games Modal */}
        {assignGamesModalOpen && (
          <Modal
            isOpen={assignGamesModalOpen}
            onClose={() => setAssignGamesModalOpen(false)}
            title={`Add Existing Games to "${managingSubcategory.name}"`}
            maxWidth="600px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Select available games to assign to this subcategory:
              </p>
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
                {allGames.filter((g) => !subcategoryGames.some((sg) => sg.id === g.id)).length === 0 ? (
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>
                    All available games are already assigned to this subcategory.
                  </div>
                ) : (
                  allGames
                    .filter((g) => !subcategoryGames.some((sg) => sg.id === g.id))
                    .map((game) => (
                      <label key={game.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedGameIdsToAssign.includes(game.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGameIdsToAssign((prev) => [...prev, game.id]);
                            } else {
                              setSelectedGameIdsToAssign((prev) => prev.filter((id) => id !== game.id));
                            }
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{game.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{game.game_type} | /{game.slug}</div>
                        </div>
                      </label>
                    ))
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setAssignGamesModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleAssignExistingGames}
                  className="btn btn-primary"
                  disabled={selectedGameIdsToAssign.length === 0}
                >
                  Assign Selected Games
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Create New Game Modal */}
        {createGameModalOpen && (
          <Modal
            isOpen={createGameModalOpen}
            onClose={() => setCreateGameModalOpen(false)}
            title={`Create New Game for "${managingSubcategory.name}"`}
            maxWidth="600px"
          >
            {newGameError && (
              <div style={{ backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {newGameError}
              </div>
            )}
            <form onSubmit={handleCreateNewGameInSubcategory}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Game Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Letter Tracing Safari"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Game Slug (URL path)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. letter-tracing-safari"
                    value={newGameSlug}
                    onChange={(e) => setNewGameSlug(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Engine / Game Type</label>
                  <select
                    className="form-select"
                    value={newGameType}
                    onChange={(e) => setNewGameType(e.target.value)}
                  >
                    {Object.entries(GAME_ENGINE_REGISTRY).map(([key, def]) => (
                      <option key={key} value={key}>{def.name} ({key})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Topic Category</label>
                  <select
                    className="form-select"
                    value={newGameCategoryId}
                    onChange={(e) => setNewGameCategoryId(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Publication Status</label>
                  <select
                    className="form-select"
                    value={String(newGameIsPublished)}
                    onChange={(e) => setNewGameIsPublished(e.target.value === 'true')}
                  >
                    <option value="false">Draft (Unpublished)</option>
                    <option value="true">Published (Live in App)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setCreateGameModalOpen(false)}
                    className="btn btn-secondary"
                    disabled={newGameSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={newGameSubmitting}>
                    {newGameSubmitting ? 'Creating...' : 'Create & Assign Game'}
                  </button>
                </div>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

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
                    <th style={{ padding: '0.875rem 1rem' }}>Games</th>
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
                        {subGameCountError ? (
                          <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 600 }} title={subGameCountError}>
                            Error
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                            {subGameCountMap.get(sub.id) ?? 0}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className={`badge ${sub.is_active ? 'badge-success' : 'badge-warning'}`}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => handleOpenSubcategoryGames(sub)}
                            className="btn btn-primary btn-sm"
                            title="Manage Games"
                          >
                            <Gamepad2 size={14} /> Games ({subGameCountMap.get(sub.id) ?? 0})
                          </button>
                          <button onClick={() => openEditSubModal(sub)} className="btn btn-secondary btn-sm" title="Add Games & Manage Subcategory">
                            <Gamepad2 size={14} /> Add Games
                          </button>
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

        {/* Add / Edit Subcategory Modal with Game & Pattern Selection */}
        {subModalOpen && (
          <Modal
            isOpen={subModalOpen}
            onClose={() => setSubModalOpen(false)}
            title={editingSub ? 'Edit Subcategory & Games' : 'Add New Subcategory & Games'}
            maxWidth="750px"
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

                {/* Games in this Subcategory Section */}
                <div style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Gamepad2 size={16} color="var(--color-primary)" /> Games & Patterns in this Subcategory
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const unassignedGames = allGames.filter((g) => !assignedGames.some((ag) => ag.game_id === g.id));
                        if (unassignedGames.length === 0) {
                          alert('All available games are already assigned to this subcategory.');
                          return;
                        }
                        const targetGame = unassignedGames[0];
                        const engineDef = GAME_ENGINE_REGISTRY[targetGame.game_type as EngineType] || GAME_ENGINE_REGISTRY.guess_game;
                        setAssignedGames((prev) => [
                          ...prev,
                          {
                            game_id: targetGame.id,
                            enabled_patterns: engineDef.supportedQuestionTypes,
                            sort_order: prev.length + 1,
                            is_active: true,
                          },
                        ]);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <Plus size={14} /> Assign Game
                    </button>
                  </div>

                  {assignedGames.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '0.5rem 0' }}>
                      No games assigned to this subcategory yet. Click &ldquo;Assign Game&rdquo; to add learning activities.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {assignedGames.map((ag, index) => {
                        const gameRecord = allGames.find((g) => g.id === ag.game_id);
                        const engineType = (gameRecord?.game_type as EngineType) || 'guess_game';
                        const engineDef = GAME_ENGINE_REGISTRY[engineType] || GAME_ENGINE_REGISTRY.guess_game;

                        return (
                          <div
                            key={ag.game_id}
                            style={{
                              backgroundColor: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.875rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-primary)' }}>#{index + 1}</span>
                                <select
                                  className="form-select form-select-sm"
                                  value={ag.game_id}
                                  onChange={(e) => {
                                    const newGameId = e.target.value;
                                    setAssignedGames((prev) =>
                                      prev.map((item, idx) => (idx === index ? { ...item, game_id: newGameId } : item))
                                    );
                                  }}
                                  style={{ width: '220px' }}
                                >
                                  {allGames.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name} ({g.game_type})</option>
                                  ))}
                                </select>
                                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{engineDef.name}</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={ag.is_active}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setAssignedGames((prev) =>
                                        prev.map((item, idx) => (idx === index ? { ...item, is_active: checked } : item))
                                      );
                                    }}
                                  /> Active
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignedGames((prev) => prev.filter((_, idx) => idx !== index));
                                  }}
                                  className="btn btn-danger btn-sm"
                                  title="Remove Assignment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Supported Patterns Selection for this Engine */}
                            <div style={{ paddingLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Supported Patterns:</span>
                              {engineDef.supportedQuestionTypes.map((pattern) => {
                                const isSelected = ag.enabled_patterns.includes(pattern);
                                return (
                                  <label key={pattern} style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', backgroundColor: 'var(--color-surface-muted)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setAssignedGames((prev) =>
                                          prev.map((item, idx) => {
                                            if (idx !== index) return item;
                                            const patterns = checked
                                              ? [...item.enabled_patterns, pattern]
                                              : item.enabled_patterns.filter((p) => p !== pattern);
                                            return { ...item, enabled_patterns: patterns };
                                          })
                                        );
                                      }}
                                    />
                                    {pattern.replace('_', ' ')}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={subSubmitting || (subFormError !== null && subFormError.includes('Failed loading'))}
                  >
                    {subSubmitting ? 'Saving...' : 'Save Subcategory & Games'}
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

        {/* Delete Confirmation Modal */}
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
                  <th style={{ padding: '0.875rem 1rem' }}>Subcategories</th>
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
                      {explorerSubCountError ? (
                        <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 600 }} title={explorerSubCountError}>
                          Error
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontWeight: 700 }}>
                          {explorerSubCountMap.get(item.id) ?? 0}
                        </span>
                      )}
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
