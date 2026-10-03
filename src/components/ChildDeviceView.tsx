import React, { useEffect, useRef } from 'react';
import {
  Shield, Heart, Siren, Unlock, Clock3, Camera, MonitorUp, CheckCircle2,
  XCircle, MapPin, Battery, Wifi, Upload, Smartphone, Bell, LockKeyhole,
} from 'lucide-react';
import type { ChildDevice, MediaItem } from '../types';
import type { PendingMediaRequest } from '../hooks/useChildAgent';

interface ChildDeviceViewProps {
  child: ChildDevice;
  pendingMedia: PendingMediaRequest | null;
  ringing: boolean;
  activeMediaKind: 'camera' | 'screen' | null;
  mediaPreviewStream?: MediaStream | null;
  onSendSOS: () => Promise<void> | void;
  onRequestTime: (minutes: number, reason: string, appName?: string) => Promise<void> | void;
  onAcceptMedia: () => Promise<void>;
  onDeclineMedia: () => Promise<void>;
  onUploadGallery: (file: File, category: MediaItem['category']) => Promise<void>;
  onRefresh: () => Promise<void>;
  companionPermissions?: Record<string, boolean> | null;
  gallerySyncing?: boolean;
  onRequestPermissions?: () => Promise<unknown> | void;
  onSyncGallery?: () => Promise<void> | void;
}

export const ChildDeviceView: React.FC<ChildDeviceViewProps> = ({
  child, pendingMedia, ringing, activeMediaKind, mediaPreviewStream, onSendSOS,
  onRequestTime, onAcceptMedia, onDeclineMedia, onUploadGallery, onRefresh,
  companionPermissions, gallerySyncing, onRequestPermissions, onSyncGallery,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = mediaPreviewStream || null;
      if (mediaPreviewStream) videoRef.current.play().catch(() => undefined);
    }
  }, [mediaPreviewStream]);

  const locked = child.screenStatus !== 'unlocked';

  if (locked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-7 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4"><LockKeyhole className="w-8 h-8 text-amber-400" /></div>
          <h1 className="text-2xl font-black text-white">Companion dikunci</h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">{child.lockMessage || 'Perangkat sedang dibatasi oleh pengaturan keluarga.'}</p>
          <div className="grid grid-cols-2 gap-3 mt-6 text-xs">
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700"><Battery className="w-4 h-4 mx-auto mb-1 text-emerald-400" />{child.batteryLevel > 0 ? `${child.batteryLevel}%` : '—'}</div>
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700"><Wifi className="w-4 h-4 mx-auto mb-1 text-sky-400" />{child.networkType}</div>
          </div>
          <button onClick={() => void onRequestTime(15, 'Perlu akses perangkat')} className="mt-5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold">Minta 15 menit akses</button>
          <button onClick={() => void onRefresh()} className="block mx-auto mt-3 text-[11px] text-slate-500 hover:text-emerald-400">Perbarui status</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-2">
      <div className="rounded-[2.3rem] border-[10px] border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
        <div className="px-5 pt-3 pb-2 flex items-center justify-between text-[10px] text-slate-400"><span>GuardKids Companion</span><span>{new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span></div>
        <div className="px-5 pt-2 pb-4">
          <div className="flex items-center gap-3"><div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${child.avatarColor} flex items-center justify-center text-slate-950 font-black`}>{child.name.slice(0,1)}</div><div><div className="text-sm font-bold text-white">{child.name}</div><div className="text-[10px] text-slate-400">Perangkat terhubung • {child.deviceModel}</div></div></div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-[10px]
          "><div className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-center"><Battery className="w-3.5 h-3.5 mx-auto text-emerald-400 mb-1" />{child.batteryLevel > 0 ? `${child.batteryLevel}%` : '—'}</div><div className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-center"><MapPin className="w-3.5 h-3.5 mx-auto text-sky-400 mb-1" />GPS</div><div className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-center"><Wifi className="w-3.5 h-3.5 mx-auto text-teal-400 mb-1" />Online</div></div>
        </div>

        {companionPermissions && (
          <div className="mx-5 mb-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-xs font-bold text-white">Izin perangkat</div><div className="text-[10px] text-slate-500 mt-1">Aktifkan agar fitur orang tua dapat bekerja.</div></div>
              <button onClick={()=>void onRequestPermissions?.()} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-bold">Izinkan / Perbarui</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
              {[
                ['Kamera', companionPermissions.camera],
                ['Mikrofon', companionPermissions.microphone],
                ['Lokasi', companionPermissions.location],
                ['Galeri', companionPermissions.galleryFull || companionPermissions.gallery],
                ['Notifikasi', companionPermissions.notifications],
              ].map(([label, ok]) => <div key={String(label)} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800"><span className="text-slate-300">{label}</span><span className={ok?'text-emerald-400':'text-red-400'}>{ok?'Diizinkan':'Belum'}</span></div>)}
            </div>
            {onSyncGallery && <button onClick={()=>void onSyncGallery()} className="mt-3 w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-semibold">{gallerySyncing?'Meminta izin / menyinkronkan galeri…':'Izinkan & sinkronkan galeri'}</button>}
          </div>
        )}

        {(pendingMedia || ringing || activeMediaKind) && (
          <div className="mx-5 mb-4 space-y-3">
            {ringing && <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center gap-2 animate-pulse"><Bell className="w-4 h-4" />Companion sedang dibunyikan oleh Portal Orang Tua.</div>}
            {pendingMedia && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2 text-white font-bold text-sm">{pendingMedia.kind === 'camera' ? <Camera className="w-4 h-4 text-emerald-400" /> : <MonitorUp className="w-4 h-4 text-emerald-400" />} Permintaan {pendingMedia.kind === 'camera' ? 'kamera' : 'berbagi layar'}</div>
                <p className="text-[11px] text-slate-300 mt-1">Orang tua meminta sesi langsung. Anda harus menyetujui izin browser agar kamera/layar bisa dibagikan.</p>
                <div className="flex gap-2 mt-3"><button onClick={() => void onDeclineMedia()} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"><XCircle className="w-3.5 h-3.5 inline mr-1" />Tolak</button><button onClick={() => void onAcceptMedia()} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Izinkan</button></div>
              </div>
            )}
            {activeMediaKind && mediaPreviewStream && (
              <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-black aspect-video"><video ref={videoRef} muted playsInline className="w-full h-full object-contain" /></div>
            )}
          </div>
        )}

        <div className="px-5 pb-6 space-y-3">
          <button onClick={() => void onSendSOS()} className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"><Siren className="w-5 h-5" />SOS DARURAT</button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => void onRequestTime(15, 'Minta tambahan waktu')} className="py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2"><Clock3 className="w-4 h-4 text-amber-400" />+15 Menit</button>
            <label className="py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"><Upload className="w-4 h-4 text-sky-400" />Kirim Media<input type="file" hidden accept="image/*,video/*" onChange={(e) => { const file=e.target.files?.[0]; if(file) void onUploadGallery(file, 'camera'); e.currentTarget.value=''; }} /></label>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 leading-relaxed flex items-start gap-2"><Heart className="w-3.5 h-3.5 text-emerald-400 mt-0.5" /><span>Semua sesi pemantauan menampilkan indikator di companion dan membutuhkan izin perangkat sesuai kemampuan browser.</span></div>
        </div>
      </div>
      <div className="mt-4 text-center text-[10px] text-slate-600 flex items-center justify-center gap-1"><Shield className="w-3.5 h-3.5" />{child.isOnline ? 'Terhubung ke backend' : 'Offline — menunggu koneksi backend'}</div>
    </div>
  );
};
