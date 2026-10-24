import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Database,
  Search,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { TableName } from '../types/database';
import { Modal } from '../components/Common/Modal';

interface FieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select';
  required?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
  placeholder?: string;
  helperText?: string;
}

interface TableSchema {
  tableName: TableName;
  label: string;
  fields: FieldSchema[];
}

const TABLE_SCHEMAS: Record<TableName, TableSchema> = {
  game_categories: {
    tableName: 'game_categories',
    label: 'Game Categories',
    fields: [
      { key: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Early Literacy' },
      { key: 'slug', label: 'URL Slug', type: 'text', required: true, placeholder: 'e.g. early-literacy' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional category description' },
      { key: 'icon_asset_id', label: 'Icon Asset ID (UUID)', type: 'text', placeholder: 'Optional Media Asset UUID' },
      { key: 'sort_order', label: 'Sort Order', type: 'number', defaultValue: 0 },
    ],
  },
  games: {
    tableName: 'games',
    label: 'Games',
    fields: [
      { key: 'name', label: 'Game Name', type: 'text', required: true, placeholder: 'e.g. Alphabet Safari' },
      { key: 'slug', label: 'URL Slug', type: 'text', required: true, placeholder: 'e.g. alphabet-safari' },
      { key: 'category_id', label: 'Category ID (UUID)', type: 'text', placeholder: 'Category UUID' },
      { key: 'description', label: 'Description', type: 'textarea' },
      {
        key: 'game_type',
        label: 'Game Type',
        type: 'select',
        defaultValue: 'multiple_choice',
        options: [
          { label: 'Multiple Choice', value: 'multiple_choice' },
          { label: 'Matching', value: 'matching' },
          { label: 'Image Selection', value: 'image_selection' },
          { label: 'Audio Recognition', value: 'audio_recognition' },
        ],
      },
      { key: 'is_published', label: 'Published Status', type: 'boolean', defaultValue: false },
      { key: 'sort_order', label: 'Sort Order', type: 'number', defaultValue: 0 },
    ],
  },
  game_levels: {
    tableName: 'game_levels',
    label: 'Game Levels',
    fields: [
      { key: 'game_id', label: 'Game ID (UUID)', type: 'text', required: true, placeholder: 'Game UUID' },
      { key: 'level_number', label: 'Level Number', type: 'number', required: true, defaultValue: 1 },
      { key: 'title', label: 'Level Title', type: 'text', placeholder: 'e.g. Level 1: Letter Sounds' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'pass_score', label: 'Pass Score', type: 'number', defaultValue: 100 },
      { key: 'sort_order', label: 'Sort Order', type: 'number', defaultValue: 0 },
    ],
  },
  questions: {
    tableName: 'questions',
    label: 'Questions',
    fields: [
      { key: 'game_id', label: 'Game ID (UUID)', type: 'text', required: true, placeholder: 'Game UUID' },
      { key: 'level_id', label: 'Level ID (UUID)', type: 'text', placeholder: 'Optional Level UUID' },
      { key: 'question_text', label: 'Question Text', type: 'textarea', required: true, placeholder: 'What sound does the letter A make?' },
      {
        key: 'question_type',
        label: 'Question Type',
        type: 'select',
        defaultValue: 'multiple_choice',
        options: [
          { label: 'Multiple Choice', value: 'multiple_choice' },
          { label: 'Matching', value: 'matching' },
          { label: 'Image Selection', value: 'image_selection' },
          { label: 'Audio Recognition', value: 'audio_recognition' },
        ],
      },
      { key: 'instructions', label: 'Instructions', type: 'text', placeholder: 'Optional audio or visual guidance' },
      { key: 'is_draft', label: 'Is Draft', type: 'boolean', defaultValue: true },
      { key: 'sort_order', label: 'Sort Order', type: 'number', defaultValue: 1 },
      { key: 'image_asset_id', label: 'Image Asset ID (UUID)', type: 'text' },
      { key: 'audio_asset_id', label: 'Audio Asset ID (UUID)', type: 'text' },
    ],
  },
  question_options: {
    tableName: 'question_options',
    label: 'Question Options',
    fields: [
      { key: 'question_id', label: 'Question ID (UUID)', type: 'text', required: true, placeholder: 'Question UUID' },
      { key: 'option_text', label: 'Option Text', type: 'text', placeholder: 'Display text for answer choice' },
      { key: 'is_correct', label: 'Is Correct Answer', type: 'boolean', defaultValue: false },
      { key: 'sort_order', label: 'Sort Order', type: 'number', defaultValue: 1 },
      { key: 'media_asset_id', label: 'Media Asset ID (UUID)', type: 'text' },
    ],
  },
  media_assets: {
    tableName: 'media_assets',
    label: 'Media Assets',
    fields: [
      { key: 'name', label: 'File Name', type: 'text', required: true, placeholder: 'e.g. hero_banner.png' },
      { key: 'bucket_name', label: 'Bucket Name', type: 'text', required: true, defaultValue: 'game-assets' },
      { key: 'file_path', label: 'File Path in Storage', type: 'text', required: true, placeholder: 'e.g. 2026/03/hero_banner.png' },
      { key: 'mime_type', label: 'MIME Type', type: 'text', required: true, placeholder: 'e.g. image/png' },
      { key: 'size_bytes', label: 'Size (Bytes)', type: 'number', required: true, defaultValue: 0 },
      { key: 'checksum_sha256', label: 'SHA256 Checksum', type: 'text' },
    ],
  },
  activity_media: {
    tableName: 'activity_media',
    label: 'Activity Media',
    fields: [
      { key: 'media_id', label: 'Media Asset ID (UUID)', type: 'text', required: true },
      { key: 'target_type', label: 'Target Type', type: 'text', required: true, placeholder: 'e.g. question' },
      { key: 'target_id', label: 'Target ID (UUID)', type: 'text', required: true },
      {
        key: 'usage_role',
        label: 'Usage Role',
        type: 'select',
        required: true,
        defaultValue: 'question_image',
        options: [
          { label: 'Question Image', value: 'question_image' },
          { label: 'Answer Image', value: 'answer_image' },
          { label: 'Instruction Audio', value: 'instruction_audio' },
          { label: 'Background Image', value: 'background_image' },
          { label: 'Character Animation', value: 'character_animation' },
        ],
      },
    ],
  },
  game_versions: {
    tableName: 'game_versions',
    label: 'Game Versions',
    fields: [
      { key: 'version_number', label: 'Version Number', type: 'text', required: true, placeholder: 'e.g. 1.0.0' },
      { key: 'release_notes', label: 'Release Notes', type: 'textarea' },
      { key: 'min_app_version', label: 'Minimum App Version', type: 'text', placeholder: 'e.g. 1.0.0' },
      { key: 'is_active', label: 'Is Active Version', type: 'boolean', defaultValue: false },
    ],
  },
  admin_users: {
    tableName: 'admin_users',
    label: 'Admin Users',
    fields: [
      { key: 'id', label: 'Auth User UUID', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'is_admin', label: 'Is Administrator', type: 'boolean', defaultValue: true },
    ],
  },
};

export const ViewTablesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTable = (searchParams.get('table') as TableName) || 'game_categories';

  const tablesList: { name: TableName; label: string }[] = [
    { name: 'media_assets', label: 'Media Assets' },
    { name: 'game_categories', label: 'Game Categories' },
    { name: 'games', label: 'Games' },
    { name: 'game_levels', label: 'Game Levels' },
    { name: 'questions', label: 'Questions' },
    { name: 'question_options', label: 'Question Options' },
    { name: 'activity_media', label: 'Activity Media' },
    { name: 'game_versions', label: 'Game Versions' },
  ];

  // Records state
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search, Sorting, Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Modals & Form State
  const [viewRecord, setViewRecord] = useState<Record<string, unknown> | null>(null);
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<Record<string, unknown> | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchTableRecords(currentTable);
  }, [currentTable]);

  async function fetchTableRecords(tableName: TableName) {
    if (!isSupabaseConfigured) {
      const mockData: Record<TableName, Record<string, unknown>[]> = {
        media_assets: [
          { id: 'm-1', name: 'banner.png', bucket_name: 'game-assets', mime_type: 'image/png', size_bytes: 120000, created_at: new Date().toISOString() },
        ],
        game_categories: [
          { id: 'c-1', name: 'Early Literacy', slug: 'early-literacy', description: 'Reading & Alphabet', sort_order: 1, created_at: new Date().toISOString() },
          { id: 'c-2', name: 'Mathematics', slug: 'mathematics', description: 'Counting & Logic', sort_order: 2, created_at: new Date().toISOString() },
        ],
        games: [
          { id: 'g-1', category_id: 'c-1', name: 'Alphabet Quest', slug: 'alphabet-quest', game_type: 'multiple_choice', is_published: true, created_at: new Date().toISOString() },
        ],
        game_levels: [
          { id: 'l-1', game_id: 'g-1', level_number: 1, title: 'Letter A', pass_score: 100, created_at: new Date().toISOString() },
        ],
        questions: [
          { id: 'q-1', game_id: 'g-1', question_text: 'Select the letter A', question_type: 'multiple_choice', is_draft: false, created_at: new Date().toISOString() },
        ],
        question_options: [
          { id: 'o-1', question_id: 'q-1', option_text: 'A', is_correct: true, created_at: new Date().toISOString() },
        ],
        activity_media: [
          { id: 'am-1', media_id: 'm-1', target_type: 'question', target_id: 'q-1', usage_role: 'question_image', created_at: new Date().toISOString() },
        ],
        game_versions: [
          { id: 'v-1', version_number: '1.0.0', release_notes: 'Initial release', min_app_version: '1.0.0', is_active: true, created_at: new Date().toISOString() },
        ],
        admin_users: [],
      };

      setRecords(mockData[tableName] || []);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords((data as Record<string, unknown>[]) || []);
    } catch (err: unknown) {
      console.error(`Error fetching table ${tableName}:`, err);
      const msg = err instanceof Error ? err.message : 'Database fetch failed';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  // Column headers inferred from static schema or records
  const columns = useMemo(() => {
    const schema = TABLE_SCHEMAS[currentTable];
    if (schema) {
      return ['id', ...schema.fields.map((f) => f.key), 'created_at'];
    }
    if (records.length === 0) return ['id', 'created_at'];
    return Object.keys(records[0]).filter((k) => typeof records[0][k] !== 'object' || records[0][k] === null);
  }, [records, currentTable]);

  // Filtering & Sorting
  const filteredAndSortedRecords = useMemo(() => {
    return records
      .filter((rec) => {
        if (!searchQuery) return true;
        return Object.values(rec).some((val) =>
          String(val ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
      .sort((a, b) => {
        const valA = a[sortColumn] ?? '';
        const valB = b[sortColumn] ?? '';
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [records, searchQuery, sortColumn, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRecords.slice(start, start + pageSize);
  }, [filteredAndSortedRecords, currentPage]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
  };

  const openCreateModal = () => {
    const initial: Record<string, unknown> = {};
    const schema = TABLE_SCHEMAS[currentTable];
    if (schema) {
      schema.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initial[field.key] = field.defaultValue;
        } else if (field.type === 'boolean') {
          initial[field.key] = false;
        } else if (field.type === 'number') {
          initial[field.key] = 0;
        } else {
          initial[field.key] = '';
        }
      });
    }
    setFormData(initial);
    setFormErrorMsg(null);
    setIsCreatingNew(true);
  };

  const openEditModal = (rec: Record<string, unknown>) => {
    setEditRecord(rec);
    const initial: Record<string, unknown> = {};
    const schema = TABLE_SCHEMAS[currentTable];
    if (schema) {
      schema.fields.forEach((field) => {
        initial[field.key] = rec[field.key] ?? (field.defaultValue !== undefined ? field.defaultValue : (field.type === 'boolean' ? false : ''));
      });
    } else {
      Object.assign(initial, rec);
    }
    setFormData(initial);
    setFormErrorMsg(null);
    setIsCreatingNew(false);
  };

  // Save Record (Create or Edit)
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMsg(null);

    const schema = TABLE_SCHEMAS[currentTable];
    if (!schema) {
      setFormErrorMsg(`Unsupported table: ${currentTable}`);
      return;
    }

    // 1. Validate required fields
    for (const field of schema.fields) {
      if (field.required) {
        const val = formData[field.key];
        if (val === undefined || val === null || String(val).trim() === '') {
          setFormErrorMsg(`Please enter a valid value for required field: "${field.label}"`);
          return;
        }
      }
    }

    // 2. Prepare payload excluding generated keys
    const payload: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const rawVal = formData[field.key];

      if (field.type === 'number') {
        payload[field.key] = rawVal !== '' && rawVal !== undefined && rawVal !== null ? Number(rawVal) : (field.required ? 0 : null);
      } else if (field.type === 'boolean') {
        payload[field.key] = Boolean(rawVal);
      } else if (field.type === 'text' || field.type === 'textarea') {
        const strVal = String(rawVal ?? '').trim();
        payload[field.key] = strVal !== '' ? strVal : (field.required ? '' : null);
      } else if (field.type === 'select') {
        const strVal = String(rawVal ?? field.defaultValue ?? '').trim();
        payload[field.key] = strVal !== '' ? strVal : (field.required ? field.defaultValue : null);
      } else {
        payload[field.key] = rawVal ?? null;
      }
    }

    if (!isSupabaseConfigured) {
      setRecords((prev) =>
        isCreatingNew
          ? [{ id: `demo-${Date.now()}`, created_at: new Date().toISOString(), ...payload }, ...prev]
          : prev.map((r) => (r.id === editRecord?.id ? { ...r, ...payload } : r))
      );
      setEditRecord(null);
      setIsCreatingNew(false);
      return;
    }

    try {
      setSubmitting(true);
      if (isCreatingNew) {
        const { error } = await supabase.from(currentTable).insert(payload);
        if (error) throw error;
      } else if (editRecord && editRecord.id) {
        const { error } = await supabase
          .from(currentTable)
          .update(payload)
          .eq('id', editRecord.id as string);
        if (error) throw error;
      }

      await fetchTableRecords(currentTable);
      setEditRecord(null);
      setIsCreatingNew(false);
    } catch (err: unknown) {
      console.error('Failed saving record to Supabase:', err);
      const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : 'Database save failed.');
      setFormErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Record
  const handleDeleteRecord = async () => {
    if (!deleteConfirmRecord || !deleteConfirmRecord.id) return;
    if (!isSupabaseConfigured) {
      setRecords((prev) => prev.filter((r) => r.id !== deleteConfirmRecord.id));
      setDeleteConfirmRecord(null);
      return;
    }

    try {
      const { error } = await supabase
        .from(currentTable)
        .delete()
        .eq('id', deleteConfirmRecord.id as string);

      if (error) throw error;
      fetchTableRecords(currentTable);
      setDeleteConfirmRecord(null);
    } catch (err: unknown) {
      console.error('Failed deleting record:', err);
      const msg = err instanceof Error ? err.message : 'Delete failed';
      alert(msg);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)' }}>Database Table Browser</h2>
          <p className="page-subtitle">
            Search, sort, filter, and edit relational records across Sproutelle content tables.
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Record
        </button>
      </div>

      {/* Table Selector Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {tablesList.map((t) => (
          <button
            key={t.name}
            onClick={() => {
              setSearchParams({ table: t.name });
              setCurrentPage(1);
            }}
            className={`btn btn-sm ${currentTable === t.name ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Actions Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
            <input
              type="text"
              className="form-control"
              placeholder={`Search records in ${currentTable}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Total Records: {filteredAndSortedRecords.length}
          </div>
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
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Table Records Grid */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading records for table {currentTable}...
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Database size={36} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
            <p>No records found in table <strong>{currentTable}</strong>.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  {columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{
                        padding: '0.875rem 1rem',
                        fontWeight: 700,
                        color: 'var(--color-primary-dark)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                        {col}
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((rec, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {columns.map((col) => (
                      <td key={col} style={{ padding: '0.875rem 1rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof rec[col] === 'boolean' ? (
                          <span className={`badge ${rec[col] ? 'badge-success' : 'badge-warning'}`}>
                            {rec[col] ? 'True' : 'False'}
                          </span>
                        ) : (
                          String(rec[col] ?? '—')
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        <button
                          onClick={() => setViewRecord(rec)}
                          className="btn btn-secondary btn-sm"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEditModal(rec)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Record"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmRecord(rec)}
                          className="btn btn-danger btn-sm"
                          title="Delete Record"
                        >
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

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '1rem',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-surface-muted)',
            }}
          >
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Page {currentPage} of {totalPages}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="btn btn-secondary btn-sm"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {viewRecord && (
        <Modal
          isOpen={Boolean(viewRecord)}
          onClose={() => setViewRecord(null)}
          title={`Record Details (${currentTable})`}
        >
          <pre style={{ backgroundColor: 'var(--color-surface-muted)', padding: '1rem', borderRadius: 'var(--radius-md)', overflowX: 'auto', fontSize: '0.8125rem' }}>
            {JSON.stringify(viewRecord, null, 2)}
          </pre>
        </Modal>
      )}

      {/* Create / Edit Record Modal */}
      {(isCreatingNew || editRecord) && (
        <Modal
          isOpen={isCreatingNew || Boolean(editRecord)}
          onClose={() => {
            setIsCreatingNew(false);
            setEditRecord(null);
            setFormErrorMsg(null);
          }}
          title={isCreatingNew ? `Add New Record to ${currentTable}` : `Edit Record in ${currentTable}`}
        >
          {formErrorMsg && (
            <div
              style={{
                backgroundColor: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{formErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveRecord}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(TABLE_SCHEMAS[currentTable]?.fields || []).map((field) => (
                <div key={field.key} className="input-group">
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {field.label}
                    {field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      placeholder={field.placeholder}
                      value={String(formData[field.key] ?? '')}
                      onChange={(e) => {
                        const newForm = { ...formData, [field.key]: e.target.value };
                        if ((currentTable === 'game_categories' || currentTable === 'games') && field.key === 'name' && isCreatingNew) {
                          newForm.slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        }
                        setFormData(newForm);
                      }}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="form-select"
                      value={String(formData[field.key] ?? field.defaultValue ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <select
                      className="form-select"
                      value={String(Boolean(formData[field.key]))}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value === 'true' })}
                    >
                      <option value="false">False / Draft / Inactive</option>
                      <option value="true">True / Published / Active</option>
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      className="form-control"
                      placeholder={field.placeholder}
                      value={formData[field.key] !== undefined && formData[field.key] !== null ? String(formData[field.key]) : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newForm = { ...formData, [field.key]: val };
                        if ((currentTable === 'game_categories' || currentTable === 'games') && field.key === 'name' && isCreatingNew) {
                          newForm.slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        }
                        setFormData(newForm);
                      }}
                    />
                  )}
                  {field.helperText && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{field.helperText}</span>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditRecord(null);
                    setFormErrorMsg(null);
                  }}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRecord && (
        <Modal
          isOpen={Boolean(deleteConfirmRecord)}
          onClose={() => setDeleteConfirmRecord(null)}
          title="Confirm Record Deletion"
        >
          <div>
            <p style={{ marginBottom: '1.5rem' }}>
              Are you sure you want to delete this record (ID: <code>{String(deleteConfirmRecord.id || '')}</code>) from table <strong>{currentTable}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirmRecord(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDeleteRecord} className="btn btn-danger">
                Delete Record
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
