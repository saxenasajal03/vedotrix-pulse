// ==============================================================================
// VEDOTRIX PULSE - SUPABASE S3 & STORAGE MANAGER
// Designed & Managed by Vedotrix Technologies
// S3 Endpoint: https://cqevzpvyqvckvenutuzz.storage.supabase.co/storage/v1/s3
// ==============================================================================

import { getSupabaseClient } from './supabaseClient';

export interface StorageUploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export const S3_CONFIG = {
  endpoint: 'https://cqevzpvyqvckvenutuzz.storage.supabase.co/storage/v1/s3',
  accessKeyId: 'c67f8cd83918298b25882ffa5b6692ad',
  secretAccessKey: '5718eb331bbbd9443ec6780e89fd92998561e05a3e23e57a5ca635c50dc4d8ac',
  region: 'ap-northeast-1',
  buckets: {
    logos: 'organization-logos',
    avatars: 'avatars',
    documents: 'documents'
  }
};

/**
 * Uploads an image or document directly to Supabase S3 Storage Bucket
 * and returns the public CDN URL.
 */
export async function uploadFileToStorage(
  file: File,
  bucket: 'organization-logos' | 'avatars' | 'documents' = 'organization-logos',
  customPrefix: string = 'org'
): Promise<StorageUploadResult> {
  try {
    const supabase = getSupabaseClient();
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${customPrefix}_${Date.now()}_${cleanName}`;

    // Upload to bucket
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // Generate public CDN URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      path: data.path
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'File upload failed'
    };
  }
}
