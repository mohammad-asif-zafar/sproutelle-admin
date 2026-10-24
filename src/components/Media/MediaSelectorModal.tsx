import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { MediaAsset } from '../../types/database';
import { Modal } from '../Common/Modal';
import { MediaPreviewTile } from './MediaPreviewTile';

interface MediaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  mediaTypeFilter?: 'image' | 'audio' | 'all';
  title?: string;
}

export const MediaSelectorModal: React.FC<MediaSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  mediaTypeFilter = 'all',
  title = 'Select Reusable Media Asset',
}) => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const loadAssets = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAssets([
        {
          id: 'demo-asset-img-1',
          name: 'apple_illustration.png',
          bucket_name: 'game-assets',
          file_path: '2026/03/apple_illustration.png',
          mime_type: 'image/png',
          size_bytes: 520000,
          created_at: new Date().toISOString(),
          public_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&auto=format&fit=crop',
        },
        {
          id: 'demo-asset-audio-1',
          name: 'pronunciation_apple.mp3',
          bucket_name: 'game-assets',
          file_path: '2026/03/pronunciation_apple.mp3',
          mime_type: 'audio/mpeg',
          size_bytes: 120000,
          created_at: new Date().toISOString(),
          public_url: 'https://actions.google.com/sounds/v1/speech/person_saying_hello.ogg',
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAssets((data as MediaAsset[]) || []);
    } catch (err) {
      console.error('Failed loading media assets for selector:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadAssets();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, loadAssets]);

  const filtered = assets.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (mediaTypeFilter === 'image') return item.mime_type.startsWith('image/');
    if (mediaTypeFilter === 'audio') return item.mime_type.startsWith('audio/');
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="750px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search media by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        {/* Asset Grid */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading available assets...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No matching media assets found.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1rem',
              maxHeight: '400px',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {filtered.map((asset) => {
              return (
                <div
                  key={asset.id}
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-surface)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-soft)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)';
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <MediaPreviewTile asset={asset} height="90px" />
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {asset.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
