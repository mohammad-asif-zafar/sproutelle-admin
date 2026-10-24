import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { MediaAsset } from '../types/database';

function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string || '').trim();

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  isValidHttpUrl(rawUrl) &&
  !rawUrl.includes('your-supabase-project') &&
  !rawUrl.includes('placeholder.supabase.co') &&
  rawKey !== 'your-supabase-anon-key' &&
  rawKey !== 'placeholder-key'
);

function initSupabaseClient(): SupabaseClient {
  try {
    if (isSupabaseConfigured) {
      return createClient(rawUrl, rawKey);
    }
  } catch (err) {
    console.warn('Failed to initialize live Supabase client, falling back to dummy client:', err);
  }
  return createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export const supabase: SupabaseClient = initSupabaseClient();

/**
 * Signs in user with email and password
 */
export async function signInWithEmailAndPassword(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Signs out current user session
 */
export async function signOutUser() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Checks if a given user is listed as an authorized Sproutelle administrator
 */
export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user || !isSupabaseConfigured) return false;

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Admin status lookup error:', error.message);
      return false;
    }

    return data?.is_admin === true;
  } catch (err) {
    console.error('Failed checking admin status:', err);
    return false;
  }
}

/**
 * Helper to retrieve public URL for an asset path in the game-assets bucket
 */
export function getMediaPublicUrl(filePath: string, bucketName: string = 'game-assets'): string {
  if (!isSupabaseConfigured || !filePath) return '';
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/**
 * Helper to generate short-lived signed URL for private bucket storage delivery
 */
export async function getMediaSignedUrl(
  filePath: string,
  expiresInSeconds: number = 3600,
  bucketName: string = 'game-assets'
): Promise<string> {
  if (!isSupabaseConfigured || !filePath) return '';
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      console.warn(
        `[Storage Diagnostics] Failed generating signed URL for bucket="${bucketName}" path="${filePath}":`,
        `Message="${error.message}"`,
        'status' in error ? `Status=${(error as { status?: number }).status}` : ''
      );
      return '';
    }

    return data?.signedUrl || '';
  } catch (err) {
    console.warn(`[Storage Diagnostics] Exception generating signed URL for bucket="${bucketName}" path="${filePath}":`, err);
    return '';
  }
}

/**
 * Uploads a file to Supabase Storage and records metadata in media_assets table
 */
export async function uploadMediaAsset(
  file: File,
  userId: string,
  bucketName: string = 'game-assets'
): Promise<MediaAsset> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Cannot upload files.');
  }

  // Generate unique path: year/month/uuid-filename
  const date = new Date();
  const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniquePath = `${yearMonth}/${crypto.randomUUID()}-${sanitizedFilename}`;

  // 1. Upload file object to Storage
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(uniquePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 2. Insert metadata record into media_assets table
  const newAsset = {
    name: file.name,
    bucket_name: bucketName,
    file_path: uniquePath,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    created_by: userId,
  };

  const { data: dbData, error: dbError } = await supabase
    .from('media_assets')
    .insert(newAsset)
    .select()
    .single();

  if (dbError) {
    // Attempt safe storage cleanup if database insert fails
    await supabase.storage.from(bucketName).remove([uniquePath]).catch(() => {});
    throw new Error(`Database record creation failed: ${dbError.message}`);
  }

  const signedUrl = await getMediaSignedUrl(uniquePath, 3600, bucketName);

  return {
    ...dbData,
    public_url: signedUrl,
  };
}

/**
 * Safely removes a media asset from both Storage and Database
 */
export async function deleteMediaAsset(assetId: string, filePath: string, bucketName: string = 'game-assets') {
  if (!isSupabaseConfigured) return;

  // 1. Delete from database
  const { error: dbError } = await supabase
    .from('media_assets')
    .delete()
    .eq('id', assetId);

  if (dbError) throw dbError;

  // 2. Delete from storage bucket
  const { error: storageError } = await supabase.storage
    .from(bucketName)
    .remove([filePath]);

  if (storageError) {
    console.warn(`Storage file removal warning for ${filePath}:`, storageError.message);
  }
}
