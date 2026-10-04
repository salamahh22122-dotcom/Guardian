import { useCallback, useEffect, useRef, useState } from 'react';
import { requireSupabase, currentIso } from '../lib/supabase';
import {
  acknowledgeCommand,
  addAlert,
  addTimeRequest,
  getPendingCommands,
  insertLocation,
  loadPairedChild,
  updateSafeZoneFromAgent,
  uploadMedia,
  updateChildFromAgent,
  uploadNativeMedia,
} from '../lib/guardkidsApi';
import { GuardianNative, isNativeAndroid, type GuardianPermissionState } from '../lib/guardianNative';
import { GuardKidsRtcSession, captureCamera, captureScreen, setTorch, type RtcKind } from '../lib/webrtc';
import type { ChildDevice } from '../types';

export interface PendingMediaRequest {
  id: string;
  commandId: string;
  kind: RtcKind;
  sessionId: string;
}


function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

function playRingTone() {
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const start = ctx.currentTime;
    [0, 0.45, 0.9, 1.35].forEach((offset) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.32);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.34);
    });
    setTimeout(() => ctx.close().catch(() => undefined), 2200);
  } catch {
    // Audio is best-effort; vibration/visual alert remains available.
  }
}

export function useChildAgent(childId: string) {
  const [child, setChild] = useState<ChildDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMediaRequest | null>(null);
  const [ringing, setRinging] = useState(false);
  const [pairedLoading, setPairedLoading] = useState(true);
  const [activeMediaKind, setActiveMediaKind] = useState<RtcKind | null>(null);
  const [mediaPreviewStream, setMediaPreviewStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<GuardianPermissionState | null>(null);
  const [gallerySyncing, setGallerySyncing] = useState(false);

  const mirrorSession = useRef<GuardKidsRtcSession | null>(null);
  const cameraSession = useRef<GuardKidsRtcSession | null>(null);
  const activeCameraStream = useRef<MediaStream | null>(null);
  const screenTickAt = useRef(Date.now());
  const batteryAlertSent = useRef(false);
  const childRef = useRef<ChildDevice | null>(null);
  childRef.current = child;

  const refresh = useCallback(async () => {
    try {
      setPairedLoading(true);
      const data = await loadPairedChild(childId);
      setChild(data);
      if (!data) setError('Perangkat ini tidak lagi terhubung ke akun orang tua.');
      else setError(null);
    } catch (e: any) {
      setError(e?.message || 'Gagal membaca konfigurasi perangkat.');
    } finally {
      setPairedLoading(false);
    }
  }, [childId]);

  const acceptMedia = useCallback(async () => {
    if (!pendingMedia) throw new Error('Tidak ada permintaan media.');
    if (pendingMedia.kind === 'camera') {
      const facing = child?.cameraFacing || 'back';
      const stream = await captureCamera(facing);
      activeCameraStream.current = stream;
      setMediaPreviewStream(stream);
      cameraSession.current?.stop();
      cameraSession.current = await GuardKidsRtcSession.startChild(childId, pendingMedia.sessionId, 'camera', stream, (state) => {
        if (state === 'connected') setActiveMediaKind('camera');
        if (state === 'failed' || state === 'disconnected' || state === 'closed') setActiveMediaKind(null);
      });
      await updateChildFromAgent(childId, { is_camera_active: true, camera_facing: facing, is_screen_mirroring_requested: false });
      setPendingMedia(null); setActiveMediaKind('camera');
      return;
    }

    const stream = await captureScreen();
    setMediaPreviewStream(stream);
    mirrorSession.current?.stop();
    mirrorSession.current = await GuardKidsRtcSession.startChild(childId, pendingMedia.sessionId, 'screen', stream, (state) => {
      if (state === 'connected') setActiveMediaKind('screen');
      if (state === 'failed' || state === 'disconnected' || state === 'closed') setActiveMediaKind(null);
    });
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      void updateChildFromAgent(childId, { is_screen_mirroring_active: false, is_screen_mirroring_requested: false });
      mirrorSession.current?.stop(); mirrorSession.current = null; setActiveMediaKind(null); setMediaPreviewStream(null);
    });
    await updateChildFromAgent(childId, { is_screen_mirroring_active: true, is_screen_mirroring_requested: false });
    setPendingMedia(null); setActiveMediaKind('screen');
  }, [child, childId, pendingMedia]);


  const handleCommand = useCallback(async (command: any) => {
    const type = command.command as string;
    try {
      if (type === 'ring') {
        setRinging(true);
        navigator.vibrate?.([250, 150, 250, 150, 650]);
        playRingTone();
        await acknowledgeCommand(command.id, 'completed');
        setTimeout(() => setRinging(false), 4500);
        return;
      }

      if (type === 'request_screen_mirror' || type === 'request_camera') {
        const sessionId = String(command.payload?.sessionId || '');
        if (!sessionId) throw new Error('Permintaan media tidak memiliki sesi.');
        setPendingMedia({ id: `${type}-${command.id}`, commandId: command.id, kind: type === 'request_camera' ? 'camera' : 'screen', sessionId });
        await acknowledgeCommand(command.id, 'accepted');
        if (childRef.current) {
          await updateChildFromAgent(childRef.current.id, type === 'request_camera'
            ? { is_camera_active: false }
            : { is_screen_mirroring_requested: true });
        }
        try {
          if (type === 'request_camera' && isNativeAndroid()) {
            const status = await GuardianNative.getPermissionStatus();
            if (!status.camera) {
              const next = await GuardianNative.requestPermissions();
              setPermissionState(next);
              if (!next.camera) throw new Error('Izin kamera Android belum diberikan.');
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
          await acceptMedia();
        } catch (mediaError: any) {
          setPendingMedia(null);
          await acknowledgeCommand(command.id, 'rejected', { error: mediaError?.message || 'Akses media gagal.' });
          if (type === 'request_camera') {
            await updateChildFromAgent(childId, { is_camera_active: false });
          } else {
            await updateChildFromAgent(childId, { is_screen_mirroring_requested: false, is_screen_mirroring_active: false });
          }
          setError(mediaError?.message || 'Akses media gagal.');
        }
        return;
      }

      if (type === 'stop_camera') {
        cameraSession.current?.stop(); cameraSession.current = null; activeCameraStream.current?.getTracks().forEach((track) => track.stop()); activeCameraStream.current = null;
        setActiveMediaKind(null); setMediaPreviewStream(null);
        await updateChildFromAgent(childId, { is_camera_active: false, is_flashlight_on: false });
        await acknowledgeCommand(command.id, 'completed');
        await refresh();
        return;
      }

      if (type === 'stop_screen_mirror') {
        mirrorSession.current?.stop(); mirrorSession.current = null;
        setActiveMediaKind(null); setMediaPreviewStream(null);
        await updateChildFromAgent(childId, { is_screen_mirroring_active: false, is_screen_mirroring_requested: false });
        await acknowledgeCommand(command.id, 'completed');
        await refresh();
        return;
      }

      if (type === 'lock_device' || type === 'unlock_device') {
        // Parent already persists the requested lock state. The companion only refreshes its local view.
        await acknowledgeCommand(command.id, 'completed');
        await refresh();
        return;
      }

      if (type === 'switch_camera') {
        const facing = command.payload?.facing === 'front' ? 'front' : 'back';
        if (cameraSession.current) {
          cameraSession.current.stop();
          cameraSession.current = null;
          activeCameraStream.current?.getTracks().forEach((track) => track.stop());
          activeCameraStream.current = null;
        }
        await updateChildFromAgent(childId, { camera_facing: facing, is_camera_active: false, is_flashlight_on: false });
        await acknowledgeCommand(command.id, 'completed');
        await refresh();
        return;
      }

      if (type === 'toggle_flashlight') {
        const enabled = !Boolean(command.payload?.currentOn);
        let applied = false;
        if (activeCameraStream.current) applied = await setTorch(activeCameraStream.current, enabled);
        await updateChildFromAgent(childId, { is_flashlight_on: applied ? enabled : false });
        await acknowledgeCommand(command.id, 'completed', { applied });
        await refresh();
        return;
      }

      if (type === 'sync_gallery') {
        await acknowledgeCommand(command.id, 'accepted');
        await syncNativeGallery();
        await acknowledgeCommand(command.id, 'completed');
        return;
      }

      if (type === 'block_app' || type === 'unblock_app' || type === 'set_app_limit') {
        await acknowledgeCommand(command.id, 'rejected', {
          error: 'Kontrol aplikasi sistem memerlukan companion Android native; browser tidak dapat mengelola aplikasi terpasang di perangkat.'
        });
        setError('Kontrol aplikasi sistem tidak tersedia pada companion web.');
        return;
      }

      if (type === 'set_screen_time_limit' || type === 'set_bedtime') {
        // Parent already persists these policy values. The companion only refreshes its local view.
        await acknowledgeCommand(command.id, 'completed');
        await refresh();
        return;
      }

      if (type === 'refresh_safe_zones') {
        await acknowledgeCommand(command.id, 'completed');
        await refresh();
        return;
      }

      await acknowledgeCommand(command.id, 'completed');
      await refresh();
    } catch (e: any) {
      await acknowledgeCommand(command.id, 'rejected', { error: e?.message || 'Command gagal' }).catch(() => undefined);
      setError(e?.message || 'Perintah perangkat gagal dijalankan.');
    }
  }, [acceptMedia, childId, refresh, syncNativeGallery]);

  const requestDevicePermissions = useCallback(async () => {
    try {
      if (isNativeAndroid()) {
        await GuardianNative.requestPermissions();
        await new Promise((resolve) => setTimeout(resolve, 900));
        const status = await GuardianNative.getPermissionStatus();
        setPermissionState(status);
        await updateChildFromAgent(childId, { companion_permissions: status });
        await refresh();
        return status;
      }
      const next: any = { camera:false, microphone:false, location:false, notifications:false, gallery:false, galleryFull:false, galleryPartial:false };
      if (navigator.mediaDevices?.getUserMedia) {
        try { const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:true}); stream.getTracks().forEach(t=>t.stop()); next.camera=true; next.microphone=true; } catch {}
      }
      if (navigator.geolocation) {
        await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(()=>{next.location=true;resolve()},()=>resolve(),{enableHighAccuracy:true,timeout:10000}));
      }
      if ('Notification' in window) { try { next.notifications = (await Notification.requestPermission()) === 'granted'; } catch {} }
      setPermissionState(next);
      await updateChildFromAgent(childId, { companion_permissions: next });
      await refresh();
      return next;
    } catch (e:any) { setError(e?.message || 'Izin perangkat tidak dapat diminta.'); return null; }
  }, [childId, refresh]);

  const syncNativeGallery = useCallback(async () => {
    if (!isNativeAndroid() || gallerySyncing) return;
    setGallerySyncing(true);
    try {
      let result;
      try {
        result = await GuardianNative.getGallery({limit:40});
      } catch {
        result = { items: [], permission: await GuardianNative.requestGalleryPermissions() };
        if (!result.permission.gallery) {
          setPermissionState(result.permission);
          await updateChildFromAgent(childId, { companion_permissions: result.permission });
          return;
        }
        result = await GuardianNative.getGallery({limit:40});
      }
      setPermissionState(result.permission);
      await updateChildFromAgent(childId, {companion_permissions:result.permission});
      for (const item of result.items) {
        try {
          const media = await GuardianNative.readMedia({uri:item.uri});
          await uploadNativeMedia(childId,item.sourceId,item.filename,media.mimeType || item.mimeType,media.base64,'camera',item.createdAt);
        } catch (e) { console.warn('Gallery media sync failed',item.sourceId,e); }
      }
      await refresh();
    } catch (e) { console.warn('Native gallery sync failed',e); }
    finally { setGallerySyncing(false); }
  }, [childId, gallerySyncing, refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled=false;
    const initPermissions=async()=>{
      try {
        if (!isNativeAndroid()) return;
        const status=await GuardianNative.getPermissionStatus();
        if(!cancelled) setPermissionState(status);
        if(!status.camera || !status.microphone || !status.location || !status.notifications) await requestDevicePermissions();
        // Request/read gallery on first native launch as well; do not wait for the 2-minute timer.
        if (!status.gallery) {
          await syncNativeGallery();
        } else {
          await syncNativeGallery();
        }
      } catch(e){ console.warn('Permission initialization failed',e); }
    };
    void initPermissions();
    return ()=>{cancelled=true;};
  }, [requestDevicePermissions, syncNativeGallery]);

  useEffect(() => {
    let channel: any;
    let mounted = true;
    const start = async () => {
      const db = requireSupabase();
      const pending = await getPendingCommands(childId);
      for (const command of pending) if (mounted) await handleCommand(command);
      channel = db.channel(`device-commands-${childId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'device_commands', filter: `child_id=eq.${childId}`,
        }, (payload) => { void handleCommand(payload.new); })
        .subscribe();
    };
    start().catch((e) => setError(e?.message || 'Sinkronisasi perintah gagal.'));
    return () => { mounted = false; channel?.unsubscribe(); };
  }, [childId, handleCommand]);

  useEffect(() => {
    let watchId: number | null = null;
    const pushPosition = async (position: GeolocationPosition) => {
      try {
        setChild((prev) => prev ? ({ ...prev, currentCoordinates: {
          lat: position.coords.latitude, lng: position.coords.longitude,
          address: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          accuracy: position.coords.accuracy, timestamp: new Date().toLocaleString('id-ID'),
        } }) : prev);
        const latest = childRef.current;
        if (latest && !latest.companionPermissions.location) {
          await updateChildFromAgent(childId, {
            companion_permissions: { ...latest.companionPermissions, location: true },
          });
        }
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const safeZones = latest?.safeZones || [];
        const zoneChanges = safeZones.map((zone) => ({
          zone,
          inside: distanceMeters(lat, lng, zone.lat, zone.lng) <= zone.radiusMeters,
        })).filter(({ zone, inside }) => inside !== zone.isInside);
        if (zoneChanges.length) {
          await Promise.all(zoneChanges.map(async ({ zone, inside }) => {
            await updateSafeZoneFromAgent(zone.id, inside);
            await addAlert(childId, {
              type: 'geofence',
              title: `${inside ? 'Masuk' : 'Keluar'} zona aman: ${zone.name}`,
              message: `${latest?.name || 'Perangkat'} ${inside ? 'memasuki' : 'meninggalkan'} radius ${zone.radiusMeters} m dari ${zone.address || zone.name}.`,
              severity: inside ? 'low' : 'high',
            });
          }));
          setChild((prev) => prev ? ({
            ...prev,
            safeZones: prev.safeZones.map((zone) => {
              const change = zoneChanges.find((item) => item.zone.id === zone.id);
              return change ? { ...zone, isInside: change.inside } : zone;
            }),
          }) : prev);
        }
        await insertLocation(childId, {
          lat, lng,
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          accuracy: position.coords.accuracy, battery: childRef.current?.batteryLevel || 0,
        });
      } catch (e) {
        console.warn('Location sync failed', e);
      }
    };
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((p) => { void pushPosition(p); }, () => undefined, {
        enableHighAccuracy: true, maximumAge: 15000, timeout: 20000,
      });
    }
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [childId]);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    const id=window.setInterval(()=>{void syncNativeGallery();},120000);
    return ()=>window.clearInterval(id);
  }, [syncNativeGallery]);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    const token = localStorage.getItem('guardkids_session_token');
    if (!token) return;
    void GuardianNative.startConnection({ childId, sessionToken: token }).catch((e) => console.warn('Persistent connection start failed', e));
    return () => { /* keep the native service alive when the WebView is closed */ };
  }, [childId]);

  useEffect(() => {
    let cleanup = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const syncDevice = async () => {
      try {
        const nav = navigator as Navigator & { connection?: { type?: string; effectiveType?: string } };
        let batteryLevel = child?.batteryLevel ?? 0;
        let charging = child?.isCharging ?? false;
        const battery = (navigator as any).getBattery ? await (navigator as any).getBattery() : null;
        if (battery) { batteryLevel = Math.round(battery.level * 100); charging = Boolean(battery.charging); }
        const connection = nav.connection?.effectiveType || nav.connection?.type || 'wifi';
        const networkType = connection.includes('5g') ? '5G' : /4g|cellular/.test(connection) ? '4G' : 'WiFi';
        if (cleanup) return;
        setChild((prev) => prev ? ({ ...prev, batteryLevel, isCharging: charging, isOnline: navigator.onLine }) : prev);
        if (battery && batteryLevel <= 15 && !batteryAlertSent.current) {
          batteryAlertSent.current = true;
          await addAlert(childId, { type: 'battery', title: 'Baterai perangkat rendah', message: `Baterai perangkat ${batteryLevel}%.`, severity: batteryLevel <= 5 ? 'critical' : 'high' });
        } else if (batteryLevel > 20) {
          batteryAlertSent.current = false;
        }
        await updateChildFromAgent(childId, {
          battery_level: batteryLevel, is_charging: charging, network_type: networkType,
          is_online: navigator.onLine, last_seen_at: currentIso(), os_version: navigator.platform,
        });
      } catch (e) { console.warn('Device telemetry failed', e); }
    };
    void syncDevice();
    interval = setInterval(() => { void syncDevice(); }, 15000);
    return () => { cleanup = true; if (interval) clearInterval(interval); };
  }, [childId]);


  useEffect(() => {
    screenTickAt.current = Date.now();
    let interval: ReturnType<typeof setInterval> | null = null;

    const isBetween = (nowMinutes: number, start: string, end: string) => {
      const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
      const s = sh * 60 + sm; const e = eh * 60 + em;
      if (s === e) return true;
      return s < e ? nowMinutes >= s && nowMinutes < e : nowMinutes >= s || nowMinutes < e;
    };

    const enforce = async () => {
      const latest = childRef.current;
      if (!latest) return;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const deltaMinutes = document.visibilityState === 'visible' && latest.screenStatus === 'unlocked'
        ? Math.floor((Date.now() - screenTickAt.current) / 60000)
        : 0;
      screenTickAt.current = Date.now();

      let used = latest.screenTimeDate === today ? latest.todayScreenTimeMinutes + deltaMinutes : deltaMinutes;
      let status = latest.screenTimeDate === today ? latest.screenStatus : 'unlocked';
      const minuteOfDay = now.getHours() * 60 + now.getMinutes();
      const bedtime = latest.isBedtimeEnabled && isBetween(minuteOfDay, latest.bedtimeStart, latest.bedtimeEnd);

      if (status === 'locked_bedtime' && !bedtime) status = 'unlocked';
      if (bedtime && status === 'unlocked') status = 'locked_bedtime';
      if (latest.screenTimeLimitMinutes > 0 && used >= latest.screenTimeLimitMinutes && status === 'unlocked') status = 'locked_limit';

      const changed = used !== latest.todayScreenTimeMinutes || latest.screenTimeDate !== today || status !== latest.screenStatus;
      if (!changed) return;
      await updateChildFromAgent(childId, {
        today_screen_time_minutes: Math.max(0, used),
        screen_time_date: today,
        screen_status: status,
        last_seen_at: currentIso(),
        is_online: navigator.onLine,
      });
      setChild((prev) => prev ? ({ ...prev, todayScreenTimeMinutes: Math.max(0, used), screenTimeDate: today, screenStatus: status }) : prev);
      if (status === 'locked_limit' && latest.screenStatus !== 'locked_limit') {
        await addAlert(childId, { type: 'screen_time', title: 'Batas companion tercapai', message: 'Batas waktu companion harian telah tercapai.', severity: 'medium' });
      }
    };

    void enforce();
    interval = setInterval(() => { void enforce(); }, 15000);
    return () => { if (interval) clearInterval(interval); };
  }, [childId]);

  useEffect(() => () => {
    mirrorSession.current?.stop(); cameraSession.current?.stop();
    activeCameraStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const declineMedia = useCallback(async () => {
    if (!pendingMedia) return;
    const commandId = pendingMedia.commandId;
    setPendingMedia(null);
    await acknowledgeCommand(commandId, 'rejected', { reason: 'Ditolak di perangkat anak.' });
    if (pendingMedia.kind === 'screen') await updateChildFromAgent(childId, { is_screen_mirroring_requested: false });
  }, [childId, pendingMedia]);

  const sendSos = useCallback(async () => {
    await addAlert(childId, {
      type: 'sos', title: '🚨 DARURAT: SOS ditekan',
      message: `${child?.name || 'Anak'} menekan tombol SOS dari perangkat yang dipasangkan.`, severity: 'critical',
    });
    navigator.vibrate?.([500, 150, 500, 150, 900]);
  }, [child, childId]);

  const requestExtraTime = useCallback(async (minutes: number, reason: string, appName?: string) => {
    await addTimeRequest(childId, minutes, reason, appName);
  }, [childId]);

  const uploadGallery = useCallback(async (file: File, category: any) => {
    await uploadMedia(childId, file, category);
    await refresh();
  }, [childId, refresh]);

  return {
    child, error, pairedLoading, pendingMedia, ringing, activeMediaKind, mediaPreviewStream,
    permissionState, gallerySyncing,
    refresh, acceptMedia, declineMedia, sendSos, requestExtraTime, uploadGallery, requestDevicePermissions, syncNativeGallery,
  };
}
