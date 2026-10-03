import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// GuardKids uses its own Supabase project. The publishable key is safe for browser/mobile clients.
// Keep environment overrides for deployment, but provide a production fallback so the APK
// cannot silently build without a backend connection when GitHub Actions secrets are absent.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://mxrffgfdygkawbzhrhbt.supabase.co';
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_dGi335AHTBTqiihiYd-EIA_956EnECY';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
const TOKEN_KEY = 'guardkids_session_token';

let supabase: SupabaseClient | null = null;
function buildClient(token?: string) {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl!, supabasePublishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { 'x-guardkids-session': token } : {} },
  });
}
export function setSessionToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  supabase = buildClient(token || undefined);
}
if (typeof window !== 'undefined') supabase = buildClient(localStorage.getItem(TOKEN_KEY) || undefined);
export { supabase };

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}
export function currentIso(): string { return new Date().toISOString(); }

export async function registerParent(email: string, password: string, fullName: string) {
  const db = buildClient();
  if (!db) throw new Error('Supabase belum dikonfigurasi.');
  const { data, error } = await db.rpc('guardkids_register', { p_email: email.trim(), p_password: password, p_full_name: fullName.trim() });
  if (error) throw error;
  setSessionToken(data.session_token);
  return data;
}
export async function loginParent(email: string, password: string) {
  const db = buildClient();
  if (!db) throw new Error('Supabase belum dikonfigurasi.');
  const { data, error } = await db.rpc('guardkids_login', { p_email: email.trim(), p_password: password });
  if (error) throw error;
  setSessionToken(data.session_token);
  return data;
}
export function signOut() { setSessionToken(null); }
export async function getCurrentSession(): Promise<{ user: { id: string } } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('id').maybeSingle();
  if (error || !data?.id) { setSessionToken(null); return null; }
  return { user: { id: data.id } };
}
export async function pairChild(pairingCode: string, deviceModel: string, osVersion: string) {
  const db = buildClient();
  if (!db) throw new Error('Supabase belum dikonfigurasi.');
  const { data, error } = await db.rpc('guardkids_pair_child', {
    p_pairing_code: pairingCode, p_device_model: deviceModel, p_os_version: osVersion
  });
  if (error) throw error;
  setSessionToken(data.session_token);
  return data;
}
