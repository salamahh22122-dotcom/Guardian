import React, { useState } from 'react';
import { LockKeyhole, Shield, UserPlus, LogIn, Loader2, Mail, User } from 'lucide-react';
import { isSupabaseConfigured, registerParent, loginParent } from '../lib/supabase';

export const AuthScreen: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(null); setError(null);
    try {
      if (isSignup) {
        await registerParent(email, password, fullName);
        setMessage('Akun berhasil dibuat dan langsung aktif. Silakan gunakan portal.');
      } else {
        await loginParent(email, password);
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message || 'Autentikasi gagal.');
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center">
              <Shield className="w-6 h-6 text-slate-950" />
            </div>
            <div><h1 className="font-extrabold text-xl">GuardKids</h1><p className="text-xs text-slate-400">Mode produksi terhubung ke Supabase</p></div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm leading-relaxed">
            Konfigurasi backend belum diisi. Set <code className="font-mono">VITE_SUPABASE_URL</code> dan <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> dari project Supabase Anda sebelum menjalankan aplikasi.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Shield className="w-7 h-7 text-slate-950" />
          </div>
          <div><h1 className="font-extrabold text-xl">GuardKids</h1><p className="text-xs text-slate-400">Portal Orang Tua</p></div>
        </div>
        <h2 className="text-2xl font-bold text-white">{isSignup ? 'Buat akun orang tua' : 'Masuk ke portal'}</h2>
        <p className="text-sm text-slate-400 mt-1">Data keluarga tersimpan di backend Supabase.</p>

        <form onSubmit={submit} className="space-y-4 mt-6">
          {isSignup && (
            <div>
              <label className="text-xs font-semibold text-slate-300">Nama lengkap</label>
              <div className="relative mt-1"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-3 text-sm text-white" /></div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-300">Email</label>
            <div className="relative mt-1"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-3 text-sm text-white" /></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <div className="relative mt-1"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={isSignup ? 'new-password' : 'current-password'} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-3 text-sm text-white" /></div>
          </div>

          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>}
          {message && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">{message}</div>}

          <button disabled={busy} type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isSignup ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {isSignup ? 'Daftar' : 'Masuk'}
          </button>
        </form>

        <button onClick={() => { setIsSignup(!isSignup); setError(null); setMessage(null); }} className="w-full mt-4 text-xs text-slate-400 hover:text-emerald-400 transition">
          {isSignup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
        </button>
      </div>
    </div>
  );
};
