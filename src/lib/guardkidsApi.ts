import type {
  AlertNotification,
  AppUsageItem,
  ChildDevice,
  LocationPoint,
  MediaItem,
  SafeZone,
  TimeRequest,
} from '../types';
import { requireSupabase, currentIso } from './supabase';

const DEVICE_COLUMNS = [
  'id', 'parent_id', 'name', 'age', 'avatar_color', 'device_model', 'os_version',
  'battery_level', 'is_charging', 'network_type', 'wifi_ssid', 'is_online', 'last_seen_at',
  'screen_status', 'lock_message', 'today_screen_time_minutes', 'screen_time_date', 'screen_time_limit_minutes',
  'bedtime_start', 'bedtime_end', 'is_bedtime_enabled', 'current_lat', 'current_lng',
  'current_address', 'current_accuracy', 'current_location_at', 'is_screen_mirroring_active',
  'is_screen_mirroring_requested', 'is_camera_active', 'camera_facing', 'is_flashlight_on',
'companion_permissions', 'pairing_expires_at', 'paired_user_id',
  'created_at', 'updated_at',
].join(',');

export interface ChildCreateResult {
  child: ChildDevice;
  pairingCode: string;
}

export interface ChildRecord {
  row: Record<string, unknown>;
  child: ChildDevice;
}

export function generatePairingCode(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  const left = 100 + (values[0] % 900);
  const right = 100 + (values[1] % 900);
  return `${left}-${right}`;
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fallbackPermissions() {
  return {
    camera: false,
    microphone: false,
    location: false,
    gallery: false,
    galleryFull: false,
    galleryPartial: false,
    usageStats: false,
    notificationAccess: false,
    deviceAdmin: false,
    batteryOptimization: false,
  };
}

function mapMediaCategory(value: unknown): MediaItem['category'] {
  if (value === 'camera' || value === 'screenshot' || value === 'whatsapp' || value === 'download') return value;
  return 'download';
}

function mapChild(row: Record<string, any>): ChildDevice {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    avatarColor: row.avatar_color || 'from-emerald-500 to-teal-600',
    deviceModel: row.device_model || 'Perangkat belum terdeteksi',
    osVersion: row.os_version || 'OS belum terdeteksi',
    batteryLevel: Number(row.battery_level ?? 0),
    isCharging: Boolean(row.is_charging),
    networkType: row.network_type === '5G' ? '5G' : row.network_type === '4G' ? '4G' : 'WiFi',
    wifiSSID: row.wifi_ssid || '',
    isOnline: Boolean(row.is_online),
    lastSyncTime: row.last_seen_at ? new Date(row.last_seen_at).toLocaleString('id-ID') : 'Belum tersambung',
    screenStatus: row.screen_status || 'unlocked',
    lockMessage: row.lock_message || '',
    todayScreenTimeMinutes: Number(row.today_screen_time_minutes ?? 0),
    screenTimeDate: String(row.screen_time_date || new Date().toISOString().slice(0, 10)),
    screenTimeLimitMinutes: Number(row.screen_time_limit_minutes ?? 120),
    bedtimeStart: row.bedtime_start || '21:00',
    bedtimeEnd: row.bedtime_end || '06:00',
    isBedtimeEnabled: Boolean(row.is_bedtime_enabled),
    currentCoordinates: {
      lat: Number(row.current_lat ?? 0),
      lng: Number(row.current_lng ?? 0),
      address: row.current_address || 'Lokasi belum tersedia',
      accuracy: Number(row.current_accuracy ?? 0),
      timestamp: row.current_location_at ? new Date(row.current_location_at).toLocaleString('id-ID') : 'Belum tersedia',
    },
    locationHistory: [],
    safeZones: [],
    appUsages: [],
    pairingCode: '',
    isScreenMirroringActive: Boolean(row.is_screen_mirroring_active),
    isScreenMirroringRequested: Boolean(row.is_screen_mirroring_requested),
    isCameraActive: Boolean(row.is_camera_active),
    cameraFacing: row.camera_facing === 'front' ? 'front' : 'back',
    isFlashlightOn: Boolean(row.is_flashlight_on),
    galleryItems: [],
    companionPermissions: row.companion_permissions || fallbackPermissions(),
  };
}

export async function loadChildren(parentId: string): Promise<ChildDevice[]> {
  const db = requireSupabase();
  const { data: childRows, error } = await db.from('child_devices').select(DEVICE_COLUMNS).eq('parent_id', parentId).order('created_at');
  if (error) throw error;
  if (!childRows?.length) return [];

  const children = await Promise.all(childRows.map(async (row) => {
    const child = mapChild(row as Record<string, any>);
    const [{ data: locations }, { data: zones }, { data: apps }, { data: gallery }] = await Promise.all([
      db.from('location_points').select('*').eq('child_id', child.id).order('recorded_at', { ascending: false }).limit(100),
      db.from('safe_zones').select('*').eq('child_id', child.id).order('created_at'),
      db.from('app_usages').select('*').eq('child_id', child.id).order('minutes_today', { ascending: false }),
      db.from('media_items').select('*').eq('child_id', child.id).order('created_at', { ascending: false }).limit(200),
    ]);

    child.locationHistory = (locations || []).map((x: any): LocationPoint => ({
      id: x.id,
      time: new Date(x.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      address: x.address || `${x.lat}, ${x.lng}`,
      lat: Number(x.lat), lng: Number(x.lng), battery: Number(x.battery ?? child.batteryLevel),
    }));

    child.safeZones = (zones || []).map((x: any): SafeZone => ({
      id: x.id,
      name: x.name,
      address: x.address,
      radiusMeters: Number(x.radius_meters),
      lat: Number(x.lat), lng: Number(x.lng),
      isInside: Boolean(x.is_inside),
      type: x.type === 'school' ? 'school' : x.type === 'home' ? 'home' : 'other',
    }));

    child.appUsages = (apps || []).map((x: any): AppUsageItem => ({
      id: x.id, name: x.app_name, packageName: x.package_name, category: x.category,
      minutesToday: Number(x.minutes_today ?? 0), dailyLimitMinutes: Number(x.daily_limit_minutes ?? 0),
      isBlocked: Boolean(x.is_blocked), iconName: x.icon_name || 'Smartphone',
    }));

    child.galleryItems = await Promise.all((gallery || []).map(async (x: any): Promise<MediaItem> => ({
      id: x.id,
      filename: x.filename,
      timestamp: new Date(x.created_at).toLocaleString('id-ID'),
      category: mapMediaCategory(x.category),
      mediaType: x.media_type === 'video' ? 'video' : 'image',
      duration: x.duration || undefined,
      title: x.title || x.filename,
      imageUrl: x.preview_url || await signedMediaUrl(x.storage_path),
      videoUrl: x.media_type === 'video' ? (x.preview_url || await signedMediaUrl(x.storage_path)) : undefined,
      aiSafetyScore: x.ai_safety_score || 'warning',
      aiSafetyTag: x.ai_safety_tag || 'Belum dianalisis',
      fileSize: x.file_size || '—',
    })));

    return child;
  }));

  return children;
}

export async function signedMediaUrl(path: string): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.storage.from('guardkids-media').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadAlerts(parentId: string): Promise<AlertNotification[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('alerts').select('*').eq('parent_id', parentId).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data || []).map((x: any) => ({
    id: x.id,
    timestamp: new Date(x.created_at).toLocaleString('id-ID'),
    type: x.type,
    title: x.title,
    message: x.message,
    isRead: Boolean(x.is_read),
    severity: x.severity,
  }));
}

export async function loadTimeRequests(parentId: string): Promise<TimeRequest[]> {
  const db = requireSupabase();
  const { data, error } = await db.from('time_requests').select('*, child_devices(name)').eq('parent_id', parentId).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data || []).map((x: any) => ({
    id: x.id,
    timestamp: new Date(x.created_at).toLocaleString('id-ID'),
    childId: x.child_id,
    childName: x.child_devices?.name || 'Anak',
    appName: x.app_name || undefined,
    requestedMinutes: Number(x.requested_minutes),
    reason: x.reason,
    status: x.status,
  }));
}

export async function createChild(parentId: string, input: { name: string; age: number; deviceModel: string }): Promise<ChildCreateResult> {
  const db = requireSupabase();
  const pairingCode = generatePairingCode();
  const pairingHash = await sha256(pairingCode);
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data, error } = await db.from('child_devices').insert({
    parent_id: parentId,
    name: input.name.trim(),
    age: input.age,
    avatar_color: 'from-emerald-500 to-teal-600',
    device_model: input.deviceModel.trim(),
    screen_status: 'unlocked',
    screen_time_date: new Date().toISOString().slice(0, 10),
    screen_time_limit_minutes: 120,
    bedtime_start: '21:00',
    bedtime_end: '06:00',
    is_bedtime_enabled: true,
    pairing_code_hash: pairingHash,
    pairing_expires_at: expires,
    companion_permissions: fallbackPermissions(),
  }).select(DEVICE_COLUMNS).single();
  if (error) throw error;

  return { child: mapChild(data as Record<string, any>), pairingCode };
}

export async function renewPairingCode(childId: string): Promise<string> {
  const db = requireSupabase();
  const pairingCode = generatePairingCode();
  const pairingHash = await sha256(pairingCode);
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error } = await db.from('child_devices').update({ pairing_code_hash: pairingHash, pairing_expires_at: expires, paired_user_id: null }).eq('id', childId);
  if (error) throw error;
  return pairingCode;
}

export async function loadPairedChild(childId: string): Promise<ChildDevice | null> {
  const db = requireSupabase();
  // A disconnected device must no longer be able to load or operate the child profile.
  const { data, error } = await db.from('child_devices').select(DEVICE_COLUMNS).eq('id', childId).eq('paired_user_id', localStorage.getItem('guardkids_user_id') || '__unpaired__').single();
  if (error) {
    if ((error as any).code === 'PGRST116') return null;
    throw error;
  }
  const child = mapChild(data as Record<string, any>);
  const [{ data: locations }, { data: zones }, { data: apps }] = await Promise.all([
    db.from('location_points').select('*').eq('child_id', child.id).order('recorded_at', { ascending: false }).limit(100),
    db.from('safe_zones').select('*').eq('child_id', child.id).order('created_at'),
    db.from('app_usages').select('*').eq('child_id', child.id).order('minutes_today', { ascending: false }),
  ]);
  child.locationHistory = (locations || []).map((x: any): LocationPoint => ({
    id: x.id, time: new Date(x.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    address: x.address || `${x.lat}, ${x.lng}`, lat: Number(x.lat), lng: Number(x.lng), battery: Number(x.battery ?? child.batteryLevel),
  }));
  child.safeZones = (zones || []).map((x: any): SafeZone => ({
    id: x.id, name: x.name, address: x.address, radiusMeters: Number(x.radius_meters), lat: Number(x.lat), lng: Number(x.lng),
    isInside: Boolean(x.is_inside), type: x.type === 'school' ? 'school' : x.type === 'home' ? 'home' : 'other',
  }));
  child.appUsages = (apps || []).map((x: any): AppUsageItem => ({
    id: x.id, name: x.app_name, packageName: x.package_name, category: x.category,
    minutesToday: Number(x.minutes_today ?? 0), dailyLimitMinutes: Number(x.daily_limit_minutes ?? 0),
    isBlocked: Boolean(x.is_blocked), iconName: x.icon_name || 'Smartphone',
  }));
  return child;
}

export async function updateChild(childId: string, patch: Record<string, unknown>) {
  const db = requireSupabase();
  const { error } = await db.from('child_devices').update({ ...patch, updated_at: currentIso() }).eq('id', childId);
  if (error) throw error;
}

export async function updateAppUsage(appId: string, patch: Record<string, unknown>) {
  const db = requireSupabase();
  const { error } = await db.from('app_usages').update({ ...patch, updated_at: currentIso() }).eq('id', appId);
  if (error) throw error;
}

export async function insertSafeZone(childId: string, zone: Omit<SafeZone, 'id' | 'isInside'>) {
  const db = requireSupabase();
  const { error } = await db.from('safe_zones').insert({
    child_id: childId, name: zone.name, address: zone.address, radius_meters: zone.radiusMeters,
    lat: zone.lat, lng: zone.lng, type: zone.type, is_inside: false,
  });
  if (error) throw error;
}

export async function updateSafeZoneFromAgent(zoneId: string, isInside: boolean) {
  const db = requireSupabase();
  const { error } = await db.from('safe_zones').update({ is_inside: isInside }).eq('id', zoneId);
  if (error) throw error;
}

export async function insertLocation(childId: string, point: { lat: number; lng: number; address?: string; accuracy?: number; battery?: number }) {
  const db = requireSupabase();
  const { error } = await db.from('location_points').insert({
    child_id: childId, lat: point.lat, lng: point.lng, address: point.address || '', accuracy: point.accuracy ?? 0,
    battery: point.battery ?? 0, recorded_at: currentIso(),
  });
  if (error) throw error;
  await updateChild(childId, {
    current_lat: point.lat, current_lng: point.lng, current_address: point.address || '',
    current_accuracy: point.accuracy ?? 0, current_location_at: currentIso(), is_online: true, last_seen_at: currentIso(),
  });
}

export async function sendCommand(childId: string, command: string, payload: Record<string, unknown> = {}) {
  const db = requireSupabase();
  const { data, error } = await db.from('device_commands').insert({ child_id: childId, command, payload }).select('*').single();
  if (error) throw error;
  return data;
}

export async function addAlert(childId: string, alert: Omit<AlertNotification, 'id' | 'timestamp' | 'isRead'>) {
  const db = requireSupabase();
  const { data: child, error: childError } = await db.from('child_devices').select('parent_id').eq('id', childId).single();
  if (childError) throw childError;
  const { error } = await db.from('alerts').insert({
    child_id: childId, parent_id: child.parent_id, type: alert.type, title: alert.title,
    message: alert.message, is_read: false, severity: alert.severity,
  });
  if (error) throw error;
}

export async function addTimeRequest(childId: string, minutes: number, reason: string, appName?: string) {
  const db = requireSupabase();
  const { data: child, error: childError } = await db.from('child_devices').select('parent_id,name').eq('id', childId).single();
  if (childError) throw childError;
  const { data: request, error } = await db.from('time_requests').insert({
    child_id: childId, parent_id: child.parent_id, app_name: appName || null,
    requested_minutes: minutes, reason, status: 'pending',
  }).select('id').single();
  if (error) throw error;
  await addAlert(childId, {
    type: 'request', title: 'Permintaan Tambahan Waktu',
    message: `${child.name} meminta +${minutes} menit untuk ${appName || 'waktu layar'}.`, severity: 'medium',
  });
  return request;
}

export async function resolveTimeRequest(requestId: string, status: 'approved' | 'rejected') {
  const db = requireSupabase();
  const { data, error } = await db.from('time_requests').update({ status, resolved_at: currentIso() }).eq('id', requestId).select('*').single();
  if (error) throw error;
  if (status === 'approved') {
    const { data: child } = await db.from('child_devices').select('screen_time_limit_minutes').eq('id', data.child_id).single();
    await updateChild(data.child_id, {
      screen_time_limit_minutes: Number(child?.screen_time_limit_minutes || 0) + Number(data.requested_minutes || 0),
      screen_status: 'unlocked',
    });
    await sendCommand(data.child_id, 'unlock_device');
  }
  return data;
}

export async function markAlertsRead(parentId: string) {
  const db = requireSupabase();
  const { error } = await db.from('alerts').update({ is_read: true }).eq('parent_id', parentId);
  if (error) throw error;
}

export async function clearAlerts(parentId: string) {
  const db = requireSupabase();
  const { error } = await db.from('alerts').delete().eq('parent_id', parentId);
  if (error) throw error;
}

export async function uploadNativeMedia(
  childId: string,
  sourceId: string,
  filename: string,
  mimeType: string,
  base64: string,
  category: MediaItem['category'] = 'camera',
  createdAt?: number,
) {
  const db = requireSupabase();
  const existing = await db.from('media_items').select('id').eq('child_id', childId).eq('source_id', sourceId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return { skipped: true, id: existing.data.id };

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], filename || 'media', { type: mimeType || 'application/octet-stream' });
  if (file.size > 25 * 1024 * 1024) return { skipped: true, reason: 'too_large' };

  const mediaId = crypto.randomUUID();
  const safeName = (filename || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${childId}/gallery_${mediaId}_${safeName}`;
  const { error: uploadError } = await db.storage.from('guardkids-media').upload(path, file, {
    cacheControl: '3600', contentType: mimeType || undefined, upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await db.from('media_items').insert({
    id: mediaId,
    child_id: childId,
    source_id: sourceId,
    filename: filename || safeName,
    category,
    media_type: mimeType?.startsWith('video/') ? 'video' : 'image',
    storage_path: path,
    title: filename || safeName,
    file_size: formatBytes(file.size),
    created_at: createdAt ? new Date(createdAt).toISOString() : undefined,
    ai_safety_score: 'warning',
    ai_safety_tag: 'Belum dianalisis',
  }).select('*').single();
  if (error) {
    await db.storage.from('guardkids-media').remove([path]);
    if ((error as any).code === '23505') return { skipped: true, reason: 'duplicate' };
    throw error;
  }
  return data;
}

export async function uploadMedia(childId: string, file: File, category: MediaItem['category']) {
  const db = requireSupabase();
  const allowed = file.type.startsWith('image/') || file.type.startsWith('video/');
  if (!allowed) throw new Error('Hanya file gambar atau video yang dapat dikirim.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Ukuran media maksimal 25 MB per file.');
  const mediaId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${childId}/${mediaId}_${safeName}`;
  const { error: uploadError } = await db.storage.from('guardkids-media').upload(path, file, {
    cacheControl: '3600', contentType: file.type || undefined, upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await db.from('media_items').insert({
    id: mediaId, child_id: childId, filename: file.name, category, media_type: file.type.startsWith('video/') ? 'video' : 'image',
    storage_path: path, title: file.name, file_size: formatBytes(file.size), ai_safety_score: 'warning', ai_safety_tag: 'Belum dianalisis',
  }).select('*').single();
  if (error) {
    await db.storage.from('guardkids-media').remove([path]);
    throw error;
  }
  return data;
}

export async function getPendingCommands(childId: string) {
  const db = requireSupabase();
  const { data, error } = await db.from('device_commands').select('*').eq('child_id', childId).eq('status', 'pending').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function acknowledgeCommand(commandId: string, status: 'accepted' | 'rejected' | 'completed', result: Record<string, unknown> = {}) {
  const db = requireSupabase();
  const { error } = await db.from('device_commands').update({ status, result, acknowledged_at: currentIso() }).eq('id', commandId);
  if (error) throw error;
}

export async function updateChildFromAgent(childId: string, patch: Record<string, unknown>) {
  await updateChild(childId, { ...patch, is_online: true, last_seen_at: currentIso() });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
