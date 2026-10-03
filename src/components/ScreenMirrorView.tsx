import React, { useEffect, useRef, useState } from 'react';
import { MonitorUp, Play, Square, Maximize2, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import type { ChildDevice } from '../types';
import { GuardKidsRtcSession } from '../lib/webrtc';

interface ScreenMirrorViewProps {
  child: ChildDevice;
  onRequestMirror: (sessionId?: string) => Promise<void> | void;
  onStopMirror: () => Promise<void> | void;
}

const MAX_SECONDS = 20 * 60;

export const ScreenMirrorView: React.FC<ScreenMirrorViewProps> = ({ child, onRequestMirror, onStopMirror }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rtc = useRef<GuardKidsRtcSession | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(false);
  const [seconds, setSeconds] = useState(MAX_SECONDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current) { videoRef.current.srcObject = stream; if (stream) videoRef.current.play().catch(() => undefined); }
  }, [stream]);
  useEffect(() => () => rtc.current?.stop(), []);
  useEffect(() => {
    if (!child.isScreenMirroringActive) return;
    setSeconds(MAX_SECONDS);
    const id = window.setInterval(() => setSeconds((v) => { if (v <= 1) { void stop(); return MAX_SECONDS; } return v - 1; }), 1000);
    return () => clearInterval(id);
  }, [child.isScreenMirroringActive]);

  const start = async () => {
    setPending(true); setError(null);
    try {
      rtc.current?.stop();
      const session = await GuardKidsRtcSession.startParent(child.id, 'screen', (remote) => setStream(remote), (state) => { if (state === 'failed') setError('Screen sharing gagal terhubung.'); });
      rtc.current = session;
      await onRequestMirror(session.sessionId);
    } catch (e: any) { setError(e?.message || 'Gagal membuat sesi screen sharing.'); rtc.current?.stop(); rtc.current = null; }
    finally { setPending(false); }
  };
  const stop = async () => { rtc.current?.stop(); rtc.current = null; setStream(null); await onStopMirror(); };
  const fullscreen = () => { void videoRef.current?.requestFullscreen?.(); };
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80">
        <div><h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><MonitorUp className="w-6 h-6 text-emerald-400" />Screen Mirroring</h1><p className="text-xs text-slate-400 mt-1">Berbagi layar aktual melalui WebRTC. HP anak harus menyetujui dialog berbagi layar browser.</p></div>
        {child.isScreenMirroringActive ? <button onClick={() => void stop()} className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold flex gap-2 items-center"><Square className="w-4 h-4" />Hentikan</button> : <button onClick={() => void start()} disabled={pending} className="px-4 py-2.5 rounded-xl bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex gap-2 items-center"><Play className="w-4 h-4" />{pending ? 'Menghubungkan…' : 'Minta Berbagi Layar'}</button>}
      </div>
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      <div className="rounded-3xl bg-slate-900 border border-slate-700 p-5">
        <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800"><span className="font-bold text-white">{child.isScreenMirroringActive ? 'LIVE SCREEN' : 'Sesi belum aktif'}</span>{child.isScreenMirroringActive && <span className="text-amber-300 flex items-center gap-1"><Clock className="w-3 h-3" />{time}</span>}</div>
        <div className="relative mt-5 aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800"><video ref={videoRef} playsInline muted className="w-full h-full object-contain" />{!stream && <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm">Belum ada layar live.</div>}{stream && <button onClick={fullscreen} className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/60 text-white"><Maximize2 className="w-4 h-4" /></button>}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs"><div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700"><div className="text-slate-400">Perangkat</div><div className="font-bold text-white mt-1">{child.deviceModel}</div></div><div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700"><div className="text-slate-400">Status privasi</div><div className="font-bold text-emerald-300 mt-1 flex items-center gap-1"><ShieldCheck className="w-4 h-4" />Izin eksplisit</div></div></div>
      </div>
    </div>
  );
};
