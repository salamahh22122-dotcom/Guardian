import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Shield, Smartphone, WifiOff } from 'lucide-react';
import { pairChild } from '../lib/supabase';

interface ChildPairingGateProps {
  onPaired: (childId: string) => void;
}

export const ChildPairingGate: React.FC<ChildPairingGateProps> = ({ onPaired }) => {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('pairing') || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pairId = localStorage.getItem('guardkids_paired_child_id');
    if (pairId) onPaired(pairId);
  }, [onPaired]);

  const pair = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = code.trim();
    if (!/^\d{3}-\d{3}$/.test(normalized)) { setError('Kode harus berformat 123-456.'); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await pairChild(
        normalized,
        navigator.userAgent.slice(0, 180),
        navigator.platform
      );
      const childId = data?.child_id as string | undefined;
      if (!childId) throw new Error('Kode pemasangan tidak valid atau sudah kedaluwarsa.');
      if (data?.user_id) localStorage.setItem('guardkids_user_id', String(data.user_id));
      localStorage.setItem('guardkids_paired_child_id', childId);
      const url = new URL(window.location.href);
      url.searchParams.delete('pairing');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      setMessage('Perangkat berhasil dipasangkan.');
      onPaired(childId);
    } catch (e: any) {
      setError(e?.message || 'Pemasangan gagal.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center"><Shield className="w-7 h-7 text-slate-950" /></div>
          <div><h1 className="font-extrabold text-xl">GuardKids Companion</h1><p className="text-xs text-slate-400">Perangkat anak</p></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 mb-5">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold"><Smartphone className="w-4 h-4" />Hubungkan perangkat ini</div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">Masukkan kode yang dibuat dari Portal Orang Tua, atau buka QR pemasangan untuk mengisi kode ini otomatis. Sesudah terhubung, perangkat ini akan mengirim status dan menerima perintah keluarga yang sah.</p>
        </div>
        <form onSubmit={pair} className="space-y-4">
          <div className="relative"><KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input inputMode="numeric" maxLength={7} placeholder="123-456" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9-]/g, '').slice(0,7))} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-3.5 text-lg tracking-[0.22em] font-mono text-white text-center" /></div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}
          {message && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">{message}</div>}
          <button disabled={busy} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{busy ? 'Memasang…' : 'Pasangkan Perangkat'}</button>
        </form>
        <div className="mt-5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 text-xs flex gap-2"><WifiOff className="w-4 h-4 mt-0.5 shrink-0" /><span>Browser harus online selama sinkronisasi aktif.</span></div>
      </div>
    </div>
  );
};
