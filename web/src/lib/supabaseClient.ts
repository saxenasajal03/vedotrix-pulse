// ==============================================================================
// VEDOTRIX PULSE - SUPABASE LIVE DATABASE CLIENT
// Designed & Managed by Vedotrix Technologies
// Connected to: cqevzpvyqvckvenutuzz.supabase.co
// ==============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Live Supabase connection credentials
const DEFAULT_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://cqevzpvyqvckvenutuzz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vFIWyBN1E22I-7saEe3Yew_vV2fQkUX';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastChecked?: string;
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const url = localStorage.getItem('vdx_supabase_url') || DEFAULT_SUPABASE_URL;
  const anonKey = localStorage.getItem('vdx_supabase_key') || DEFAULT_SUPABASE_ANON_KEY;
  // If credentials match the live provided project, default isConnected to true!
  const isDefaultLive = url === DEFAULT_SUPABASE_URL && anonKey === DEFAULT_SUPABASE_ANON_KEY;
  const isConnected = localStorage.getItem('vdx_supabase_connected') === 'true' || isDefaultLive;
  const lastChecked = localStorage.getItem('vdx_supabase_last_checked') || new Date().toISOString();

  return { url, anonKey, isConnected, lastChecked };
}

export function saveSupabaseConfig(url: string, anonKey: string, isConnected: boolean) {
  localStorage.setItem('vdx_supabase_url', url.trim());
  localStorage.setItem('vdx_supabase_key', anonKey.trim());
  localStorage.setItem('vdx_supabase_connected', String(isConnected));
  localStorage.setItem('vdx_supabase_last_checked', new Date().toISOString());
  reinitSupabaseClient(url.trim(), anonKey.trim());
}

let activeSupabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!activeSupabaseClient) {
    const config = getStoredSupabaseConfig();
    try {
      activeSupabaseClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } catch (e) {
      console.warn('Supabase initialization warning:', e);
      activeSupabaseClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
      });
    }
  }
  return activeSupabaseClient;
}

export function reinitSupabaseClient(url: string, anonKey: string) {
  try {
    activeSupabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  } catch (e) {
    console.error('Failed to re-initialize Supabase client', e);
  }
}

/**
 * Tests live connection to a Supabase project by querying the organizations table
 */
export async function testSupabaseConnection(url: string, anonKey: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  if (!url || !anonKey || !url.startsWith('https://')) {
    return {
      success: false,
      message: 'Invalid Supabase URL. Must be in the format: https://<project-ref>.supabase.co'
    };
  }

  try {
    const client = createClient(url, anonKey);
    const { data, error } = await client.from('organizations').select('id, name, org_code, industry').limit(5);

    if (error) {
      return {
        success: false,
        message: `Supabase Error: ${error.message} (Code: ${error.code})`,
        details: { error }
      };
    }

    return {
      success: true,
      message: `Successfully connected to live Supabase database! Found ${data?.length || 0} active organizations.`,
      details: { organizations: data }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network or Configuration error: ${err.message || String(err)}`
    };
  }
}
