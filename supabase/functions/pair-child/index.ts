import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!serviceRoleKey) throw new Error('Kunci server Supabase belum dikonfigurasi.');
    const token = authHeader.slice('Bearer '.length);
    const client = createClient(supabaseUrl, serviceRoleKey);
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || serviceRoleKey);
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData.user) throw new Error('Sesi perangkat tidak valid.');

    const body = await request.json();
    const pairingCode = String(body?.pairingCode || '').trim();
    if (!/^\d{3}-\d{3}$/.test(pairingCode)) throw new Error('Kode pemasangan tidak valid.');
    const hash = await sha256(pairingCode);

    const { data: child, error: lookupError } = await client
      .from('child_devices')
      .select('id, pairing_expires_at, paired_user_id')
      .eq('pairing_code_hash', hash)
      .gt('pairing_expires_at', new Date().toISOString())
      .is('paired_user_id', null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!child) throw new Error('Kode pemasangan tidak ditemukan, sudah dipakai, atau sudah kedaluwarsa.');

    const device = body?.device || {};
    const { data: claimed, error: updateError } = await client.from('child_devices').update({
      paired_user_id: userData.user.id,
      pairing_code_hash: null,
      pairing_expires_at: null,
      is_online: true,
      last_seen_at: new Date().toISOString(),
      device_model: String(device.model || ''),
      os_version: String(device.osVersion || ''),
    }).eq('id', child.id).is('paired_user_id', null).eq('pairing_code_hash', hash).gt('pairing_expires_at', new Date().toISOString()).select('id').maybeSingle();
    if (updateError) throw updateError;
    if (!claimed) throw new Error('Kode pemasangan sudah dipakai atau kedaluwarsa.');

    return new Response(JSON.stringify({ childId: claimed.id }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Pairing failed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
