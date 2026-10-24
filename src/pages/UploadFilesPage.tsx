import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  Search,
  Image as ImageIcon,
  File,
  Copy,
  Check,
  Trash2,
  Info,
  Grid,
  List as ListIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured, uploadMediaAsset, deleteMediaAsset } from '../lib/supabase';
import type { MediaAsset } from '../types/database';
import { Modal } from '../components/Common/Modal';
import { MediaPreviewTile } from '../components/Media/MediaPreviewTile';

export const UploadFilesPage: React.FC = () => {
  const { user } = useAuth();
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all'); // all | image | audio | other
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // File Upload state
  const [uploadQueue, setUploadQueue] = useState<{ file: File; status: 'pending' | 'uploading' | 'success' | 'error'; progress: number; errorMsg?: string }[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detail Modal state
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<MediaAsset | null>(null);

  // Audio playback state
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchMediaAssets();
  }, []);

  async function fetchMediaAssets() {
    if (!isSupabaseConfigured) {
      // Demo mock media items
      setMediaList([
        {
          id: 'asset-1111-2222-3333',
          name: 'forest_background.png',
          bucket_name: 'game-assets',
          file_path: '2026/03/forest_background.png',
          mime_type: 'image/png',
          size_bytes: 1420000,
          created_at: new Date().toISOString(),
          public_url: 'https://images.unsplash.com/photo-1511497584788-8767611136f6?w=600&auto=format&fit=crop',
        },
        {
          id: 'asset-4444-5555-6666',
          name: 'lion_roar_effect.mp3',
          bucket_name: 'game-assets',
          file_path: '2026/03/lion_roar_effect.mp3',
          mime_type: 'audio/mpeg',
          size_bytes: 450000,
          created_at: new Date().toISOString(),
          public_url: 'https://actions.google.com/sounds/v1/animals/lion_roar.ogg',
        },
      ]);
      setLoadingList(false);
      return;
    }

    try {
      setLoadingList(true);
      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMediaList((data as MediaAsset[]) || []);
    } catch (err) {
      console.error('Failed to load media assets:', err);
    } finally {
      setLoadingList(false);
    }
  }

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const validateFile = (file: File): string | null => {
    // Prohibit executable / dangerous scripts
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['exe', 'sh', 'bat', 'cmd', 'js', 'vbs', 'app', 'dmg'].includes(ext || '')) {
      return `Executable file type .${ext} is not allowed for security reasons.`;
    }

    // Size checks: 50MB max
    if (file.size > 50 * 1024 * 1024) {
      return `File size exceeds maximum allowed limit of 50MB.`;
    }

    return null;
  };

  const handleFiles = async (files: File[]) => {
    const queue = files.map((file) => {
      const errorMsg = validateFile(file);
      return {
        file,
        status: errorMsg ? ('error' as const) : ('pending' as const),
        progress: 0,
        errorMsg: errorMsg || undefined,
      };
    });

    setUploadQueue(queue);

    // Process valid files
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'error') continue;

      try {
        setUploadQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading', progress: 50 } : q))
        );

        if (isSupabaseConfigured && user) {
          await uploadMediaAsset(item.file, user.id);
        } else {
          // Simulate delay in demo mode
          await new Promise((res) => setTimeout(res, 800));
        }

        setUploadQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'success', progress: 100 } : q))
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploadQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'error', errorMsg } : q))
        );
      }
    }

    // Refresh media library
    fetchMediaAssets();
  };

  const copyToClipboard = (text: string, labelKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(labelKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async () => {
    if (!deleteConfirmAsset) return;
    try {
      if (isSupabaseConfigured) {
        await deleteMediaAsset(deleteConfirmAsset.id, deleteConfirmAsset.file_path, deleteConfirmAsset.bucket_name);
      }
      setMediaList((prev) => prev.filter((item) => item.id !== deleteConfirmAsset.id));
      setDeleteConfirmAsset(null);
    } catch (err) {
      console.error('Failed to delete media asset:', err);
      alert('Failed to delete asset. It may still be referenced by active questions.');
    }
  };

  const toggleAudio = (url: string) => {
    if (currentlyPlaying === url) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setCurrentlyPlaying(url);
      audio.onended = () => setCurrentlyPlaying(null);
    }
  };

  // Filter media library
  const filteredList = mediaList.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.includes(searchQuery);
    if (!matchesSearch) return false;

    if (selectedType === 'image') return item.mime_type.startsWith('image/');
    if (selectedType === 'audio') return item.mime_type.startsWith('audio/');
    if (selectedType === 'other') return !item.mime_type.startsWith('image/') && !item.mime_type.startsWith('audio/');
    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <h2 style={{ color: 'var(--color-primary-dark)' }}>Media Assets Studio</h2>
          <p className="page-subtitle">
            Upload images, audio recordings, character animations, and background assets to Supabase Storage.
          </p>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
          backgroundColor: dragActive ? 'var(--color-primary-soft)' : 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '2rem',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,.json,.svg"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary-soft)',
            color: 'var(--color-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}
        >
          <UploadCloud size={28} />
        </div>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '0.375rem', color: 'var(--color-primary-dark)' }}>
          Click or drag files to upload
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Supports PNG, JPG, WEBP, SVG, MP3, WAV, OGG, and JSON up to 50MB.
        </p>
      </div>

      {/* Upload Queue Progress */}
      {uploadQueue.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Upload Queue</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {uploadQueue.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: item.status === 'error' ? 'var(--color-danger-soft)' : 'var(--color-surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
                  <File size={18} color="var(--color-primary)" />
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {formatFileSize(item.file.size)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {item.status === 'error' && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                      {item.errorMsg || 'Upload failed'}
                    </span>
                  )}
                  {item.status === 'success' && (
                    <span className="badge badge-success">Uploaded</span>
                  )}
                  {item.status === 'uploading' && (
                    <span className="badge badge-primary">Uploading...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Library Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search assets by filename or UUID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Files' },
              { id: 'image', label: 'Images' },
              { id: 'audio', label: 'Audio' },
              { id: 'other', label: 'Other/JSON' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedType(filter.id)}
                className={`btn btn-sm ${selectedType === filter.id ? 'btn-primary' : 'btn-secondary'}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.375rem 0.625rem',
                border: 'none',
                backgroundColor: viewMode === 'grid' ? 'var(--color-primary-soft)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
              title="Grid View"
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.375rem 0.625rem',
                border: 'none',
                backgroundColor: viewMode === 'list' ? 'var(--color-primary-soft)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
              title="List View"
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Media Asset Display */}
      {loadingList ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          Loading media library...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <ImageIcon size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <h3>No media assets found</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Upload new images or audio files above to display them in your catalog.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredList.map((asset) => {
            return (
              <div
                key={asset.id}
                className="card"
                style={{
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Media Preview Box */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <MediaPreviewTile
                    asset={asset}
                    height="140px"
                    onToggleAudio={(url) => toggleAudio(url)}
                    isPlaying={currentlyPlaying === asset.id || currentlyPlaying === asset.file_path}
                  />
                </div>

                {/* Info & Actions */}
                <div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '0.25rem',
                    }}
                    title={asset.name}
                  >
                    {asset.name}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                    {formatFileSize(asset.size_bytes)} • {asset.mime_type.split('/')[1] || 'file'}
                  </div>

                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => copyToClipboard(asset.id, `id-${asset.id}`)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      title="Copy Asset UUID"
                    >
                      {copiedId === `id-${asset.id}` ? <Check size={14} color="green" /> : <Copy size={14} />}
                      ID
                    </button>

                    <button
                      onClick={() => copyToClipboard(asset.file_path, `path-${asset.id}`)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      title="Copy Storage File Path"
                    >
                      {copiedId === `path-${asset.id}` ? <Check size={14} color="green" /> : <Copy size={14} />}
                      Path
                    </button>

                    <button
                      onClick={() => setSelectedAsset(asset)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.375rem' }}
                      title="Details"
                    >
                      <Info size={14} />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmAsset(asset)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.25rem 0.375rem' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '0.875rem 1rem' }}>Asset Name</th>
                <th style={{ padding: '0.875rem 1rem' }}>Storage Path</th>
                <th style={{ padding: '0.875rem 1rem' }}>MIME Type</th>
                <th style={{ padding: '0.875rem 1rem' }}>Size</th>
                <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((asset) => (
                <tr key={asset.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{asset.name}</td>
                  <td style={{ padding: '0.875rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {asset.file_path}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>{asset.mime_type}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>{formatFileSize(asset.size_bytes)}</td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                      <button
                        onClick={() => copyToClipboard(asset.id, `id-${asset.id}`)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Copy size={14} /> Copy ID
                      </button>
                      <button
                        onClick={() => setSelectedAsset(asset)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmAsset(asset)}
                        className="btn btn-danger btn-sm"
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

      {/* Details Modal */}
      {selectedAsset && (
        <Modal
          isOpen={Boolean(selectedAsset)}
          onClose={() => setSelectedAsset(null)}
          title={`Asset Metadata: ${selectedAsset.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <MediaPreviewTile
              asset={selectedAsset}
              height="180px"
              onToggleAudio={(url) => toggleAudio(url)}
              isPlaying={currentlyPlaying === selectedAsset.id || currentlyPlaying === selectedAsset.file_path}
            />

            <div className="input-group">
              <label className="input-label">Asset UUID</label>
              <input type="text" className="form-control" readOnly value={selectedAsset.id} />
            </div>

            <div className="input-group">
              <label className="input-label">Storage Bucket & Path</label>
              <input type="text" className="form-control" readOnly value={`${selectedAsset.bucket_name}/${selectedAsset.file_path}`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">MIME Type</label>
                <input type="text" className="form-control" readOnly value={selectedAsset.mime_type} />
              </div>
              <div className="input-group">
                <label className="input-label">File Size</label>
                <input type="text" className="form-control" readOnly value={formatFileSize(selectedAsset.size_bytes)} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmAsset && (
        <Modal
          isOpen={Boolean(deleteConfirmAsset)}
          onClose={() => setDeleteConfirmAsset(null)}
          title="Confirm Asset Deletion"
        >
          <div>
            <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteConfirmAsset.name}</strong> from Supabase Storage and the database?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setDeleteConfirmAsset(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete Asset
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
