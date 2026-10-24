import React, { useState, useEffect } from 'react';
import { Play, Pause, FileCode, AlertTriangle, ImageOff } from 'lucide-react';
import { getMediaSignedUrl, isSupabaseConfigured } from '../../lib/supabase';
import type { MediaAsset } from '../../types/database';

interface MediaPreviewTileProps {
  asset: MediaAsset;
  height?: string;
  onToggleAudio?: (signedUrl: string) => void;
  isPlaying?: boolean;
}

export const MediaPreviewTile: React.FC<MediaPreviewTileProps> = ({
  asset,
  height = '140px',
  onToggleAudio,
  isPlaying = false,
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(
    !isSupabaseConfigured ? asset.public_url || null : null
  );
  const [loadingUrl, setLoadingUrl] = useState<boolean>(isSupabaseConfigured);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    getMediaSignedUrl(asset.file_path, 3600, asset.bucket_name)
      .then((url) => {
        if (!isMounted) return;
        if (url) {
          setSignedUrl(url);
          setHasError(false);
        } else {
          setHasError(true);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn(`[MediaPreviewTile] Failed generating signed URL for ${asset.name}:`, err);
        setHasError(true);
      })
      .finally(() => {
        if (isMounted) setLoadingUrl(false);
      });

    return () => {
      isMounted = false;
    };
  }, [asset.file_path, asset.bucket_name, asset.name]);

  const isImage = asset.mime_type.startsWith('image/');
  const isAudio = asset.mime_type.startsWith('audio/');

  return (
    <div
      style={{
        height,
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-surface-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {loadingUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Loading preview...
          </span>
        </div>
      ) : hasError || !signedUrl ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem',
            textAlign: 'center',
          }}
        >
          {isImage ? (
            <ImageOff size={24} color="var(--color-text-muted)" />
          ) : (
            <AlertTriangle size={24} color="var(--color-warning)" />
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Preview Unavailable
          </span>
        </div>
      ) : isImage ? (
        <img
          src={signedUrl}
          alt={asset.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setHasError(true)}
        />
      ) : isAudio ? (
        <button
          type="button"
          onClick={() => onToggleAudio?.(signedUrl)}
          className="btn btn-primary"
          style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0 }}
          title={isPlaying ? 'Pause Audio' : 'Play Audio'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      ) : (
        <FileCode size={36} color="var(--color-text-muted)" />
      )}
    </div>
  );
};
