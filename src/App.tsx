/**
 * GuardKids production migration.
 * Real device data is stored in Supabase; no embedded sample state remains.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Shield, Smartphone } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ParentDashboard } from './components/ParentDashboard';
import { ScreenTimeManager } from './components/ScreenTimeManager';
import { ScreenMirrorView } from './components/ScreenMirrorView';
import { RemoteCameraView } from './components/RemoteCameraView';
import { LocationTracker } from './components/LocationTracker';
import { AlertsManager } from './components/AlertsManager';
import { GalleryMonitorView } from './components/GalleryMonitorView';
import { ChildDeviceView } from './components/ChildDeviceView';
import { PairingModal } from './components/PairingModal';
import { PrivacyGuideModal } from './components/PrivacyGuideModal';
import { AuthScreen } from './components/AuthScreen';
import { ChildPairingGate } from './components/ChildPairingGate';
import { useChildAgent } from './hooks/useChildAgent';
import { getCurrentSession, signOut, requireSupabase, isSupabaseConfigured } from './lib/supabase';
import {
  clearAlerts,
  insertSafeZone,
  loadAlerts,
  loadChildren,
  loadTimeRequests,
  markAlertsRead,
  resolveTimeRequest,
  sendCommand,
  updateChild,
  disconnectChild,
} from './lib/guardkidsApi';
import type { AlertNotification, ChildDevice, SafeZone, TimeRequest } from './types';

const isChildMode = new URLSearchParams(window.location.search).get('mode') === 'child';

function AppLoader({ label = 'Memuat GuardKids…' }: { label?: string }) {
  return <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center"><div className="flex items-center gap-2 text-sm"><Loader2 className="w-5 h-5 animate-spin text-emerald-400" />{label}</div></div>;
}

const ParentApp: React.FC<{ userId: string }> = ({ userId }) => {
  const [childrenList, setChildrenList] = useState<ChildDevice[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [timeRequests, setTimeRequests] = useState<TimeRequest[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'screentime' | 'mirror' | 'camera' | 'location' | 'alerts' | 'gallery' | 'compliance'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [children, nextAlerts, nextRequests] = await Promise.all([
        loadChildren(userId), loadAlerts(userId), loadTimeRequests(userId),
      ]);
      setChildrenList(children);
      setAlerts(nextAlerts);
      setTimeRequests(nextRequests);
      setSelectedChildId((current) => current && children.some((c) => c.id === current) ? current : (children[0]?.id ?? null));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Gagal memuat data keluarga.');
    } finally { setIsSyncing(false); }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const db = requireSupabase();
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const queueReload = () => {
      if (reloadTimer) return;
      reloadTimer = setTimeout(() => { reloadTimer = null; void refresh(); }, 350);
    };
    const channel = db.channel(`parent-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'child_devices', filter: `parent_id=eq.${userId}` }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `parent_id=eq.${userId}` }, queueReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_requests', filter: `parent_id=eq.${userId}` }, queueReload)
      .subscribe();
    return () => { if (reloadTimer) clearTimeout(reloadTimer); void channel.unsubscribe(); };
  }, [refresh, userId]);

  const selectedChild = useMemo(() => childrenList.find((c) => c.id === selectedChildId) || null, [childrenList, selectedChildId]);

  

  const patchChild = async (patch: Record<string, unknown>, message: string, command?: { name: string; payload?: Record<string, unknown> }) => {
    if (!selectedChild) return;
    await updateChild(selectedChild.id, patch);
    if (command) await sendCommand(selectedChild.id, command.name, command.payload || {});
    showToast(message);
    await refresh();
  };

  const toggleLock = async () => {
    if (!selectedChild) return;
    const locked = selectedChild.screenStatus === 'unlocked';
    await patchChild({ screen_status: locked ? 'locked_manual' : 'unlocked' }, locked ? `Companion ${selectedChild.name} dikunci.` : `Companion ${selectedChild.name} dibuka.`, { name: locked ? 'lock_device' : 'unlock_device' });
  };

  const ringDevice = async () => {
    if (!selectedChild) return;
    setIsRinging(true);
    try { await sendCommand(selectedChild.id, 'ring'); showToast(`Perintah bunyi dikirim ke ${selectedChild.name}.`); }
    finally { window.setTimeout(() => setIsRinging(false), 3200); }
  };

  const requestMirror = async (sessionId?: string) => {
    if (!selectedChild || !sessionId) return;
    await patchChild({ is_screen_mirroring_requested: true }, 'Permintaan screen mirroring dikirim.', { name: 'request_screen_mirror', payload: { sessionId } });
  };
  const stopMirror = async () => {
    if (!selectedChild) return;
    await sendCommand(selectedChild.id, 'stop_screen_mirror');
    await updateChild(selectedChild.id, { is_screen_mirroring_active: false, is_screen_mirroring_requested: false });
    showToast('Sesi screen mirroring dihentikan.'); await refresh();
  };
  const toggleCamera = async (sessionId?: string) => {
    if (!selectedChild) return;
    if (sessionId) {
      await patchChild({ is_camera_active: false }, 'Permintaan kamera dikirim. Perangkat anak harus menyetujui izin browser.', { name: 'request_camera', payload: { sessionId } });
    } else {
      await sendCommand(selectedChild.id, 'stop_camera');
      await updateChild(selectedChild.id, { is_camera_active: false, is_flashlight_on: false });
      showToast('Kamera dimatikan.'); await refresh();
    }
  };
  const switchFacing = async (facing: 'front' | 'back') => {
    if (!selectedChild) return;
    await sendCommand(selectedChild.id, 'switch_camera', { facing });
    await updateChild(selectedChild.id, { camera_facing: facing, is_camera_active: false });
    showToast(`Permintaan kamera ${facing === 'front' ? 'depan' : 'belakang'} dikirim.`); await refresh();
  };
  const toggleFlashlight = async () => {
    if (!selectedChild) return;
    await sendCommand(selectedChild.id, 'toggle_flashlight', { currentOn: Boolean(selectedChild.isFlashlightOn) });
    showToast('Perintah senter dikirim ke perangkat.');
  };
  const toggleBlockApp = async (_appId: string) => {
    showToast('Kontrol aplikasi sistem memerlukan companion Android native. Companion web tidak memalsukan pemblokiran aplikasi.');
  };

  const updateLimit = async (minutes: number) => {
    if (!selectedChild) return;
    await patchChild({ screen_time_limit_minutes: minutes }, `Batas layar ${minutes} menit.`, { name: 'set_screen_time_limit', payload: { minutes } });
  };
  const updateBedtime = async (start: string, end: string, enabled: boolean) => {
    if (!selectedChild) return;
    await patchChild({ bedtime_start: start, bedtime_end: end, is_bedtime_enabled: enabled }, 'Jadwal waktu tidur disimpan.', { name: 'set_bedtime', payload: { start, end, enabled } });
  };
  const updateAppLimit = async (_appId: string, _minutes: number) => {
    showToast('Batas per aplikasi memerlukan companion Android native. Companion web tidak memalsukan kontrol aplikasi sistem.');
  };
  const updateLockMessage = async (message: string) => {
    if (!selectedChild) return;
    await updateChild(selectedChild.id, { lock_message: message });
  };
  const addSafeZone = async (zone: Omit<SafeZone, 'id'|'isInside'>) => {
    if (!selectedChild) return;
    await insertSafeZone(selectedChild.id, zone);
    await sendCommand(selectedChild.id, 'refresh_safe_zones');
    showToast(`Zona aman "${zone.name}" ditambahkan.`); await refresh();
  };
  const markAllRead = async () => { await markAlertsRead(userId); await refresh(); showToast('Semua notifikasi ditandai dibaca.'); };
  const clearAll = async () => { await clearAlerts(userId); await refresh(); showToast('Riwayat notifikasi dibersihkan.'); };
  const approve = async (id: string) => { await resolveTimeRequest(id, 'approved'); await refresh(); showToast('Permintaan tambahan waktu disetujui.'); };
  const reject = async (id: string) => { await resolveTimeRequest(id, 'rejected'); await refresh(); showToast('Permintaan tambahan waktu ditolak.'); };
  const refreshLocation = async () => { await refresh(); };

  const disconnectSelectedChild = async () => {
    if (!selectedChild) return;
    const confirmed = window.confirm(
      `Putuskan akun anak "${selectedChild.name}" dari perangkat ini? Perangkat anak akan langsung kehilangan akses ke akun tersebut dan harus dipasangkan ulang dengan kode baru.`
    );
    if (!confirmed) return;
    try {
      await disconnectChild(selectedChild.id);
      setActiveTab('dashboard');
      showToast(`Akun ${selectedChild.name} berhasil diputuskan.`);
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Gagal memutuskan akun anak.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {toast && <div className="fixed bottom-5 right-5 z-[70] bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold">{toast}</div>}
      <Navbar
        childrenList={childrenList} selectedChild={selectedChild} onSelectChild={(child) => setSelectedChildId(child.id)}
        activeTab={activeTab} setActiveTab={setActiveTab} alerts={alerts} onOpenPairing={() => setPairingOpen(true)}
        onOpenPrivacyGuide={() => setPrivacyOpen(true)} onRefreshSync={refresh} isSyncing={isSyncing} onRingDevice={ringDevice}
        isRinging={isRinging} onDisconnectChild={() => void disconnectSelectedChild()} onSignOut={() => void signOut()}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadError && <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex gap-2"><AlertTriangle className="w-4 h-4" />{loadError}</div>}
        {!childrenList.length ? (
          <div className="min-h-[65vh] flex items-center justify-center"><div className="max-w-lg text-center bg-slate-900 border border-slate-800 rounded-3xl p-8"><div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Smartphone className="w-8 h-8 text-emerald-400" /></div><h1 className="text-2xl font-black text-white mt-5">Belum ada perangkat anak</h1><p className="text-sm text-slate-400 mt-2">Buat profil perangkat pertama untuk mendapatkan kode pemasangan nyata.</p><button onClick={()=>setPairingOpen(true)} className="mt-6 px-5 py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-2"><Plus className="w-4 h-4" />Tambah perangkat</button></div></div>
        ) : !selectedChild ? <AppLoader label="Memilih perangkat…" /> : (
          <>
            {activeTab === 'dashboard' && <ParentDashboard child={selectedChild} alerts={alerts} timeRequests={timeRequests} onToggleLock={toggleLock} onRingDevice={ringDevice} isRinging={isRinging} onApproveRequest={approve} onRejectRequest={reject} onToggleBlockApp={toggleBlockApp} onNavigateTab={(tab) => tab === 'compliance' ? setPrivacyOpen(true) : setActiveTab(tab)} />}
            {activeTab === 'mirror' && <ScreenMirrorView child={selectedChild} onRequestMirror={requestMirror} onStopMirror={stopMirror} />}
            {activeTab === 'camera' && <RemoteCameraView child={selectedChild} onToggleCamera={toggleCamera} onSwitchFacing={switchFacing} onToggleFlashlight={toggleFlashlight} />}
            {activeTab === 'gallery' && <GalleryMonitorView child={selectedChild} onRefresh={refresh} />}
            {activeTab === 'screentime' && <ScreenTimeManager child={selectedChild} onUpdateLimit={updateLimit} onUpdateBedtime={updateBedtime} onToggleBlockApp={toggleBlockApp} onUpdateAppLimit={updateAppLimit} onUpdateLockMessage={updateLockMessage} />}
            {activeTab === 'location' && <LocationTracker child={selectedChild} onAddSafeZone={addSafeZone} onRefreshLocation={refreshLocation} />}
            {activeTab === 'alerts' && <AlertsManager alerts={alerts} timeRequests={timeRequests} onApproveRequest={approve} onRejectRequest={reject} onMarkAllAsRead={markAllRead} onClearAlerts={clearAll} />}
            {activeTab === 'compliance' && <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5"><span className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 px-3 py-1 rounded-full font-bold">Kepatuhan & Privasi</span><h2 className="text-2xl font-bold text-white">Kontrol perangkat transparan</h2><div className="grid md:grid-cols-3 gap-4 text-xs"><div className="p-4 rounded-2xl bg-slate-800 border border-slate-700"><b className="text-teal-300">Izin eksplisit</b><p className="text-slate-300 mt-2 leading-relaxed">Kamera dan screen sharing hanya dimulai setelah izin browser pada perangkat anak.</p></div><div className="p-4 rounded-2xl bg-slate-800 border border-slate-700"><b className="text-teal-300">Data tersentral</b><p className="text-slate-300 mt-2 leading-relaxed">Lokasi, status, perintah, dan media tersimpan di Supabase dengan RLS per keluarga.</p></div><div className="p-4 rounded-2xl bg-slate-800 border border-slate-700"><b className="text-teal-300">Tidak ada data bawaan</b><p className="text-slate-300 mt-2 leading-relaxed">Perangkat baru dimulai kosong dan hanya terisi setelah dipasangkan serta melaporkan data nyata.</p></div></div></div>}
          </>
        )}
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-4 text-center text-[10px] text-slate-600">GuardKids • Production Data &amp; Device Companion</footer>
      <PairingModal isOpen={pairingOpen} onClose={()=>setPairingOpen(false)} selectedChild={selectedChild} parentId={userId} onChildCreated={(child)=>{setChildrenList(prev=>[...prev.filter(c=>c.id!==child.id), child]);setSelectedChildId(child.id);}} onPairingCode={() => undefined} />
      <PrivacyGuideModal isOpen={privacyOpen} onClose={()=>setPrivacyOpen(false)} />
    </div>
  );
};

const ChildApp: React.FC = () => {
  const [pairedChildId, setPairedChildId] = useState<string | null>(() => localStorage.getItem('guardkids_paired_child_id'));
  if (!pairedChildId) return <ChildPairingGate onPaired={setPairedChildId} />;
  return <ChildAgentScreen childId={pairedChildId} onReset={() => { localStorage.removeItem('guardkids_paired_child_id'); setPairedChildId(null); }} />;
};

const ChildAgentScreen: React.FC<{ childId: string; onReset: () => void }> = ({ childId, onReset }) => {
  const agent = useChildAgent(childId);
  if (agent.pairedLoading && !agent.child) return <AppLoader label="Menghubungkan perangkat…" />;
  if (!agent.child) return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-5"><div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-3xl p-6 text-center"><div className="text-red-300 text-sm font-bold">Perangkat tidak terhubung</div><p className="text-xs text-slate-500 mt-2">{agent.error || 'Hubungan dengan server tidak tersedia.'}</p><button onClick={onReset} className="mt-5 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold">Pasangkan ulang</button></div></div>;

  return <div className="min-h-screen bg-slate-950 text-slate-100"><div className="max-w-xl mx-auto px-3 pt-3 flex justify-end"><button onClick={()=>void agent.refresh()} className="text-[10px] text-slate-500 hover:text-emerald-400">Segarkan</button></div><main className="px-3 pb-10"><ChildDeviceView child={agent.child} pendingMedia={agent.pendingMedia} ringing={agent.ringing} activeMediaKind={agent.activeMediaKind} mediaPreviewStream={agent.mediaPreviewStream} onSendSOS={agent.sendSos} onRequestTime={agent.requestExtraTime} onAcceptMedia={async()=>{try{await agent.acceptMedia();}catch(e:any){window.alert(e?.message||'Izin media gagal.');}}} onDeclineMedia={agent.declineMedia} onUploadGallery={agent.uploadGallery} onRefresh={agent.refresh} companionPermissions={agent.permissionState || agent.child.companionPermissions} gallerySyncing={agent.gallerySyncing} onRequestPermissions={agent.requestDevicePermissions} onSyncGallery={agent.syncNativeGallery} /></main></div>;
};

export default function App() {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void getCurrentSession().then(setSession).finally(() => setLoading(false));
  }, []);
  if (!isSupabaseConfigured) return <AuthScreen />;
  if (isChildMode) return <ChildApp />;
  if (loading) return <AppLoader />;
  if (!session) return <AuthScreen />;
  return <ParentApp userId={session.user.id} />;
}
