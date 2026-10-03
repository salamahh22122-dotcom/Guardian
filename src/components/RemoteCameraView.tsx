import React, { useEffect, useRef, useState } from 'react';
import { Camera, SwitchCamera, Zap, ZapOff, Square, Play, Download, Maximize2, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import type { ChildDevice } from '../types';
import { GuardKidsRtcSession } from '../lib/webrtc';

interface RemoteCameraViewProps {
  child: ChildDevice;
  onToggleCamera: (sessionId?: string) => Promise<void> | void;
  onSwitchFacing: (facing: 'front' | 'back') => Promise<void> | void;
  onToggleFlashlight: () => Promise<void> | void;
}

const MAX_SECONDS = 20 * 60;

export const RemoteCameraView: React.FC<RemoteCameraViewProps> = ({ child, onToggleCamera, onSwitchFacing, onToggleFlashlight }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rtc = useRef<GuardKidsRtcSession | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(MAX_SECONDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      if (stream) videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => { rtc.current?.stop(); }, []);

  useEffect(() => {
    if (!child.isCameraActive) return;
    setSeconds(MAX_SECONDS);
    const id = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          void stop();
          return MAX_SECONDS;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [child.isCameraActive]);

  const start = async () => {
    setPending(true); setError(null);
    try {
      rtc.current?.stop();
      const session = await GuardKidsRtcSession.startParent(child.id, 'camera', (remote) => setStream(remote), (state) => {
        if (state === 'failed') setError('Sesi kamera gagal terhubung. Pastikan HP anak online dan izin kamera diberikan.');
      });
      rtc.current = session;
      await onToggleCamera(session.sessionId);
    } catch (e: any) {
      setError(e?.message || 'Gagal membuat sesi kamera.');
      rtc.current?.stop(); rtc.current = null;
    } finally { setPending(false); }
  };

  const stop = async () => {
    rtc.current?.stop(); rtc.current = null; setStream(null);
    await onToggleCamera();
  };

  const switchFacing = async () => {
    const facing = child.cameraFacing === 'front' ? 'back' : 'front';
    await stop();
    await onSwitchFacing(facing);
    // Starting a new offer makes the new camera direction a clean WebRTC session.
    setTimeout(() => void start(), 50);
  };

  const snapshot = () => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.download = `guardkids-camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92); link.click();
  };

  const fullscreen = () => { void videoRef.current?.requestFullscreen?.(); };
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80">
        <div><h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Camera className="w-6 h-6 text-emerald-400" />Kamera Jarak Jauh</h1><p className="text-xs text-slate-400 mt-1">Sesi kamera aktual melalui WebRTC; di perangkat anak harus disetujui secara eksplisit.</p></div>
        {child.isCameraActive ? <button onClick={() => void stop()} className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-2"><Square className="w-4 h-4" />Matikan Kamera</button> : <button onClick={() => void start()} disabled={pending} className="px-4 py-2.5 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2"><Play className="w-4 h-4" />{pending ? 'Menunggu…' : 'Minta Kamera'}</button>}
      </div>

      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-3xl bg-slate-900 border border-slate-700 p-5">
          <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800"><span className="font-bold text-white flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${child.isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />{child.isCameraActive ? 'LIVE CAMERA' : 'Kamera nonaktif'}</span>{child.isCameraActive && <span className="text-amber-300 flex items-center gap-1"><Clock className="w-3 h-3" />{time}</span>}</div>
          <div className="relative mt-5 aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800"><video ref={videoRef} playsInline controls={false} className="w-full h-full object-contain" />{!stream && <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">Belum ada video live.</div>}
            {stream && <><div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 text-[10px] text-white font-mono">{child.cameraFacing === 'front' ? 'FRONT' : 'BACK'} • {child.deviceModel}</div><div className="absolute bottom-3 right-3 flex gap-2"><button onClick={fullscreen} className="p-2 rounded-xl bg-black/60 text-white" title="Fullscreen"><Maximize2 className="w-4 h-4" /></button><button onClick={snapshot} className="p-2 rounded-xl bg-black/60 text-white" title="Ambil snapshot"><Download className="w-4 h-4" /></button></div></>}
          </div>
          <div className="flex flex-wrap gap-2 mt-3"><button onClick={() => void switchFacing()} disabled={!child.isCameraActive} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5"><SwitchCamera className="w-4 h-4" />Ganti Kamera</button><button onClick={() => void onToggleFlashlight()} disabled={!child.isCameraActive} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5">{child.isFlashlightOn ? <ZapOff className="w-4 h-4 text-amber-400" /> : <Zap className="w-4 h-4" />}{child.isFlashlightOn ? 'Matikan Senter' : 'Nyalakan Senter'}</button></div>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><div className="text-xs text-slate-400">Status Perangkat</div><div className="text-sm font-bold text-white mt-1">{child.isOnline ? 'Online' : 'Offline'}</div><div className="text-[11px] text-slate-500 mt-1">Perintah kamera dikirim ke perangkat yang dipasangkan.</div></div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2"><div className="font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" />Privasi</div><p>Sesi berhenti otomatis setelah 20 menit atau saat salah satu perangkat menutup koneksi.</p></div>
          <button onClick={snapshot} disabled={!stream} className="w-full py-3 rounded-xl bg-sky-600 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4" />Simpan Snapshot</button>
        </div>
      </div>
    </div>
  );
};
