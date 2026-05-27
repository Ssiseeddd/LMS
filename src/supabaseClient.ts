/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Fetch server credentials on start to sync local state
export async function fetchServerSupabaseConfig() {
  try {
    const res = await fetch('/api/db-config', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.url && data.key) {
          localStorage.setItem('lms_supabase_url', data.url.trim());
          localStorage.setItem('lms_supabase_anon_key', data.key.trim());
          return { url: data.url, key: data.key };
        }
      }
    }
  } catch (err) {
    console.error('Failed to pre-fetch server Supabase credentials:', err);
  }
  return null;
}

export async function saveSupabaseConfigToServer(url: string, key: string) {
  try {
    await fetch('/api/db-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), key: key.trim() })
    });
  } catch (err) {
    console.error('Failed to persist Supabase config to server:', err);
  }
}

export async function clearSupabaseConfigOnServer() {
  try {
    await fetch('/api/db-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '', key: '' })
    });
  } catch (err) {
    console.error('Failed to clear Supabase config on server:', err);
  }
}

// Load initial values from environment or localStorage
export function getSavedSupabaseConfig() {
  const url = localStorage.getItem('lms_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('lms_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const autoSync = localStorage.getItem('lms_supabase_auto_sync') !== 'false'; // default to true if keys present
  
  return { url, key, autoSync };
}

export function saveSupabaseConfig(url: string, key: string, autoSync: boolean) {
  localStorage.setItem('lms_supabase_url', url.trim());
  localStorage.setItem('lms_supabase_anon_key', key.trim());
  localStorage.setItem('lms_supabase_auto_sync', String(autoSync));
  // Fire-and-forget save to backend
  saveSupabaseConfigToServer(url, key);
}

export function clearSupabaseConfig() {
  localStorage.removeItem('lms_supabase_url');
  localStorage.removeItem('lms_supabase_anon_key');
  localStorage.removeItem('lms_supabase_auto_sync');
  // Fire-and-forget clear on backend
  clearSupabaseConfigOnServer();
}

// Get client instance dynamically based on saved credentials
export function getSupabaseClient() {
  const { url, key } = getSavedSupabaseConfig();
  if (!url || !key) return null;
  
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// Test connectivity and table schema existence
export async function testSupabaseConnection(url: string, key: string): Promise<{
  success: boolean;
  message: string;
  missingTables?: string[];
}> {
  if (!url || !key) {
    return { success: false, message: 'Please provide both Supabase URL and Anon Key' };
  }

  try {
    const client = createClient(url, key, {
      auth: { persistSession: false }
    });

    // Check if we can query any table to verify connection
    // We try to fetch the first row of contracts or scheduled_payments to test schema
    const tables = ['contracts', 'disbursements', 'scheduled_payments', 'repayments'];
    const missingTables: string[] = [];

    // Let's do a simple connection check first by trying a simple head request or a quick select
    const testResult = await client.from('contracts').select('id').limit(1);
    
    if (testResult.error) {
      // Check if it's a connection / URL error or a "relation does not exist" error
      const errCode = testResult.error.code;
      const errMsg = testResult.error.message || '';
      
      if (errMsg.includes('failed to fetch') || errMsg.includes('Failed to fetch') || errCode === 'PGRST116') {
        return { 
          success: false, 
          message: `Unable to connect to Supabase. Please double check your Supabase API URL. Error: ${errMsg}` 
        };
      }
      
      if (errMsg.includes('relation "public.contracts" does not exist') || errMsg.includes('does not exist')) {
        missingTables.push('contracts');
      } else {
        // Any other DB-related error, e.g. JWT invalid
        return { 
          success: false, 
          message: `Connection established, but got API Error: ${testResult.error.message} (Code: ${errCode})` 
        };
      }
    }

    // Check remaining tables
    for (const t of tables) {
      if (t === 'contracts' && missingTables.includes('contracts')) continue;
      const { error } = await client.from(t).select('id').limit(1);
      if (error && (error.message?.includes('does not exist') || error.code === 'PGRST116')) {
        missingTables.push(t);
      }
    }

    if (missingTables.length > 0) {
      return {
        success: true,
        message: 'Connected to Supabase! However, the database tables specified in the schema are missing. You will need to run the SQL migration script.',
        missingTables
      };
    }

    return {
      success: true,
      message: 'Successfully connected and verified database schema!'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Critial connection failure: ${error?.message || error}`
    };
  }
}
